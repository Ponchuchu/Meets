// Обложки для одобренных событий без картинки (.github/workflows/covers.yml, каждые 2 часа).
// Сначала картинка всегда берётся со страницы события (search.ts). Если её нет и событие ОДОБРЕНО —
// рисуем иллюстрацию Gemini (платно: ~0,03–0,07 $ за картинку, на бесплатном ключе недоступно — тогда пропускаем,
// приложение покажет обложку раздела). Без лиц, текста и логотипов: это иллюстрация, а не «афиша» события.
// Запуск: GEMINI_API_KEY=… SUPABASE_URL=… SUPABASE_SECRET_KEY=… node worker/src/covers.ts
import type { Category } from './types.ts';

const CAT_RU: Record<Category, string> = {
  music: 'живая музыка', standup: 'стендап-вечер', art: 'выставка', hike: 'поход в горы', games: 'вечер настольных игр',
  food: 'гастрономическое событие', sport: 'спортивное событие', talks: 'встреча и разговор', theatre: 'театр',
  lecture: 'лекция', meetup: 'городская встреча', party: 'вечеринка', bike: 'велопрогулка', concert: 'концерт',
};

export interface EventRow { id: string; title: string; category: Category; about: string | null; venues: { name: string } | null }

export function coverPrompt(e: EventRow): string {
  return `Иллюстрация-обложка для карточки события в Алматы: ${CAT_RU[e.category] ?? 'городское событие'} «${e.title}»${e.venues?.name ? `, место — ${e.venues.name}` : ''}.
${e.about ? `Настроение: ${e.about.slice(0, 200)}` : ''}
Покажи атмосферу через место, предметы, свет и силуэты со спины. Нельзя: текст, буквы, цифры, логотипы, узнаваемые лица и реальные артисты.
Стиль: современная плоская иллюстрация с мягким зерном, тёплый свет. Палитра: оранжевый #F0521F, графит #17161A, кремовый #F3F0E8 плюс 1–2 акцента. Вертикальный кадр 4:5.`;
}

/** Ответ Gemini с картинкой → base64 и тип. */
export function readImage(body: unknown): { data: string; mime: string } | null {
  const parts = (body as { candidates?: { content?: { parts?: { inlineData?: { data?: string; mimeType?: string } }[] } }[] }).candidates?.[0]?.content?.parts ?? [];
  const img = parts.find((p) => p.inlineData?.data)?.inlineData;
  return img?.data ? { data: img.data, mime: img.mimeType ?? 'image/png' } : null;
}

async function draw(prompt: string, key: string, model: string): Promise<{ data: string; mime: string }> {
  const call = (withConfig: boolean) => fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ['IMAGE'], ...(withConfig ? { imageConfig: { aspectRatio: '4:5' } } : {}) },
    }),
    signal: AbortSignal.timeout(90_000),
  });
  let res = await call(true);
  if (res.status === 400 && /imageConfig|aspect/i.test(await res.clone().text())) res = await call(false);
  if (!res.ok) throw Object.assign(new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`), { status: res.status });
  const img = readImage(await res.json());
  if (!img) throw new Error('Gemini не вернул картинку');
  return img;
}

async function main() {
  const key = process.env.GEMINI_API_KEY;
  const url = process.env.SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const model = process.env.GEMINI_IMAGE_MODEL || 'gemini-3.1-flash-lite-image';
  const limit = Number(process.env.COVERS_PER_RUN || 10);
  if (!key || !url || !secret) {
    console.log('Нет GEMINI_API_KEY или ключей Supabase — обложки пропущены (docs/KEYS.md).');
    return;
  }
  const headers: Record<string, string> = { apikey: secret, 'content-type': 'application/json' };
  if (secret.split('.').length === 3) headers.Authorization = `Bearer ${secret}`;
  const now = new Date().toISOString();
  const res = await fetch(`${url}/rest/v1/events?select=id,title,category,about,venues(name)&status=eq.published&cover_url=is.null&starts_at=gte.${now}&order=starts_at&limit=${limit}`, { headers });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const rows = (await res.json()) as EventRow[];
  console.log(`Одобренных событий без картинки: ${rows.length}`);
  let made = 0;
  for (const e of rows) {
    try {
      const img = await draw(coverPrompt(e), key, model);
      const ext = img.mime.includes('jpeg') ? 'jpg' : img.mime.includes('webp') ? 'webp' : 'png';
      const path = `${e.id}.${ext}`;
      const up = await fetch(`${url}/storage/v1/object/covers/${path}`, {
        method: 'POST',
        headers: { ...headers, 'content-type': img.mime, 'x-upsert': 'true' },
        body: Buffer.from(img.data, 'base64'),
      });
      if (!up.ok) throw new Error(`Storage ${up.status}: ${(await up.text()).slice(0, 200)}`);
      const cover = `${url}/storage/v1/object/public/covers/${path}`;
      const patch = await fetch(`${url}/rest/v1/events?id=eq.${e.id}`, { method: 'PATCH', headers: { ...headers, Prefer: 'return=minimal' }, body: JSON.stringify({ cover_url: cover, cover_ai: true }) });
      if (!patch.ok) throw new Error(`Supabase ${patch.status}: ${(await patch.text()).slice(0, 200)}`);
      made++;
      console.log(`  ✚ ${e.title}`);
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (status === 403 || status === 429 || /billing|free tier|quota|not available/i.test((err as Error).message)) {
        console.log(`Генерация картинок недоступна на этом ключе (${(err as Error).message.slice(0, 120)}). Нужна оплата в Google AI Studio — до этого в приложении обложка раздела.`);
        break;
      }
      console.log(`  ✕ ${e.title}: ${(err as Error).message}`);
    }
  }
  console.log(`Нарисовано обложек: ${made}`);
}

if (process.argv[1]?.endsWith('covers.ts')) void main();
