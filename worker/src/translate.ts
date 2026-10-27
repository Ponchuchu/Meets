// Перевод карточек с казахского на русский (26–27 октября, просьба владельца): в приложении текст всегда по-русски,
// у карточки метка «Қазақша», оригинал — по кнопке «Показать оригинал».
// Язык определяется без ИИ (казахские буквы). Переводят по очереди, что есть: Gemini (GEMINI_API_KEY) → Kimi (KIMI_API_KEY) →
// бесплатный переводчик Google (без ключа, может не отвечать). Ничего не ответило — карточка остаётся на казахском с пометкой
// и переводится при следующем сборе.
//   node worker/src/translate.ts --run
import { guessLang } from './polish.ts';
import { kimiPost, KIMI_DEFAULT_MODEL, paceKimi } from './kimi.ts';
import { robotLog } from './robot.ts';

export type Lang = 'ru' | 'kk' | 'en';
const MARKERS = /(^|[^а-яёәғқңөұүһі])(және|үшін|өтеді|өтті|тегін|кіру|билеттер|концерті|кеші|сахнасында|басталуы|күні|орны|қараша|қазан|қаңтар|ақпан|наурыз|сәуір|мамыр|маусым|шілде|тамыз|қыркүйек|желтоқсан|келіңіз|күтеміз)($|[^а-яёәғқңөұүһі])/;
export const detectLang = (title: string, about = ''): Lang => {
  const own = guessLang(title);
  // Название по-казахски — этого достаточно; иначе решает описание (длинный русский текст с казахским словом — русский).
  if (own === 'kk') return 'kk';
  const t = `${title}\n${about}`;
  const kk = (t.match(/[әғқңөұүһі]/gi) ?? []).length;
  const cyr = (t.match(/[а-яёәғқңөұүһі]/gi) ?? []).length;
  if (kk >= 3 && kk / Math.max(1, cyr) > 0.07) return 'kk';
  // Короткий казахский текст: пара специальных букв и типичное слово («кіру тегін», «концерті өтеді»).
  if (kk >= 1 && kk / Math.max(1, cyr) > 0.07 && MARKERS.test(t.toLowerCase())) return 'kk';
  const lat = (t.match(/[a-z]/gi) ?? []).length;
  return lat > 40 && lat > cyr * 3 ? 'en' : 'ru';
};

export interface Translation { title: string; about: string }

const PROMPT = `Переведи карточку события с казахского на русский.
Правила: только перевод, ничего не добавляй и не выдумывай. Имена людей и групп, названия мест, заведений, фильмов и спектаклей, числа, даты, время и цены оставляй как в оригинале (названия можно писать латиницей или кириллицей, как в оригинале). Абзацы сохрани. Без эмодзи. Верни только JSON {"title":"…","about":"…"}.`;

/** Ответ модели → перевод. Достаёт JSON, даже если он обёрнут в текст или ```. Пустое или слишком короткое — null. */
export function parseTranslation(raw: string, src: Translation): Translation | null {
  const m = /\{[\s\S]*\}/.exec(raw);
  if (!m) return null;
  try {
    const j = JSON.parse(m[0]) as { title?: unknown; about?: unknown };
    const title = typeof j.title === 'string' ? j.title.trim().slice(0, 140) : '';
    const about = typeof j.about === 'string' ? j.about.trim().slice(0, 2500) : '';
    if (!title || (src.about.trim() && about.length < src.about.trim().length * 0.2)) return null;
    // Перевод, который так и остался казахским, — не перевод.
    if (detectLang(title, about) === 'kk') return null;
    return { title, about };
  } catch { return null; }
}

async function viaGemini(src: Translation, key: string): Promise<Translation | null> {
  const model = process.env.GEMINI_TRANSLATE_MODEL || 'gemini-2.5-flash';
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': key }, signal: AbortSignal.timeout(60_000),
    body: JSON.stringify({ contents: [{ parts: [{ text: `${PROMPT}\n\n${JSON.stringify(src)}` }] }], generationConfig: { responseMimeType: 'application/json', temperature: 0.1 } }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}`);
  const body = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  return parseTranslation((body.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? '').join(''), src);
}

async function viaKimi(src: Translation, key: string): Promise<Translation | null> {
  await paceKimi();
  const r = await kimiPost(key, { model: process.env.KIMI_MODEL || KIMI_DEFAULT_MODEL, max_tokens: 3000, messages: [{ role: 'system', content: PROMPT }, { role: 'user', content: JSON.stringify(src) }] }, 120_000);
  return parseTranslation(r.choices?.[0]?.message?.content ?? '', src);
}

/** Кусок текста для бесплатного переводчика: по абзацам, не длиннее ~1500 знаков. */
export function chunks(text: string, max = 1500): string[] {
  const out: string[] = [];
  let cur = '';
  for (const p of text.split(/\n/)) {
    if (cur && cur.length + p.length + 1 > max) { out.push(cur); cur = ''; }
    cur = cur ? `${cur}\n${p}` : p;
    while (cur.length > max) { out.push(cur.slice(0, max)); cur = cur.slice(max); }
  }
  if (cur) out.push(cur);
  return out;
}

async function gtx(q: string): Promise<string> {
  const res = await fetch('https://translate.googleapis.com/translate_a/single?client=gtx&sl=kk&tl=ru&dt=t', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ q }), signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok || !(res.headers.get('content-type') ?? '').includes('json')) throw new Error(`Переводчик Google ${res.status}`);
  return ((await res.json()) as [string, string][][])[0].map((x) => x[0]).join('');
}
async function viaGoogle(src: Translation): Promise<Translation | null> {
  const title = (await gtx(src.title)).trim();
  const about = src.about.trim() ? (await Promise.all(chunks(src.about).map(gtx))).join('\n').trim() : '';
  return title && detectLang(title, about) !== 'kk' ? { title, about } : null;
}

/** Перевод одной карточки по цепочке. Возвращает перевод и чем переведено, либо null. */
export async function translateKk(src: Translation, env: Record<string, string | undefined> = process.env): Promise<{ t: Translation; by: string } | null> {
  const errors: string[] = [];
  const tries: [string, () => Promise<Translation | null>][] = [];
  if (env.GEMINI_API_KEY) tries.push(['Gemini', () => viaGemini(src, env.GEMINI_API_KEY!)]);
  const kimi = env.KIMI_API_KEY || env.KIMI;
  if (kimi) tries.push(['Kimi', () => viaKimi(src, kimi)]);
  tries.push(['Google', () => viaGoogle(src)]);
  for (const [name, run] of tries) {
    try { const t = await run(); if (t) return { t, by: name }; errors.push(`${name}: пусто`); } catch (e) { errors.push(`${name}: ${(e as Error).message}`); }
  }
  console.log(`  перевод не удался (${errors.join('; ')})`);
  return null;
}

interface Row { id: string; title: string; about: string | null; lang: string | null; orig_about: string | null; orig_title: string | null }

export async function run(url: string, key: string, log: (t: string, level?: string) => Promise<void> = async () => undefined): Promise<{ checked: number; translated: number; kk: number }> {
  const h: Record<string, string> = { apikey: key, 'Content-Type': 'application/json' };
  if (key.split('.').length === 3) h.Authorization = `Bearer ${key}`;
  const now = new Date().toISOString();
  const alive = `status=in.(draft,published)&or=(ends_at.gte.${now},and(ends_at.is.null,starts_at.gte.${new Date(Date.now() - 3 * 3600e3).toISOString()}))`;
  const sel = 'id,title,about,lang,orig_about,orig_title';
  const get = async (q: string): Promise<Row[]> => {
    const r = await fetch(`${url}/rest/v1/events?select=${sel}&${alive}&${q}&limit=150`, { headers: h });
    if (!r.ok) throw new Error(`Supabase ${r.status}: ${(await r.text()).slice(0, 120)}`);
    return (await r.json()) as Row[];
  };
  const patch = (id: string, body: Record<string, unknown>) => fetch(`${url}/rest/v1/events?id=eq.${id}`, { method: 'PATCH', headers: { ...h, Prefer: 'return=minimal' }, body: JSON.stringify(body) });
  // Новые карточки (язык ещё не определён) и казахские, которые не удалось перевести раньше.
  const rows = [...(await get('lang=is.null')), ...(await get('lang=eq.kk&orig_about=is.null&order=starts_at.asc'))];
  let translated = 0, kk = 0;
  for (const r of rows) {
    const lang = r.lang === 'kk' ? 'kk' : detectLang(r.title, r.about ?? '');
    if (lang !== 'kk') { await patch(r.id, { lang }); continue; }
    kk++;
    const src = { title: r.title, about: r.about ?? '' };
    const res = await translateKk(src);
    if (!res) { await patch(r.id, { lang: 'kk' }); continue; }
    // Оригинал — рядом: название в orig_title (по нему же склеиваются дубли), описание — в orig_about.
    await patch(r.id, { lang: 'kk', title: res.t.title, about: res.t.about || r.about, orig_title: r.orig_title ?? src.title, orig_about: src.about || '—' });
    translated++;
    console.log(`  ${res.by}: «${src.title.slice(0, 40)}» → «${res.t.title.slice(0, 40)}»`);
  }
  await log(`Казахские карточки: найдено ${kk}, переведено ${translated}`, kk && !translated ? 'warn' : 'ok');
  return { checked: rows.length, translated, kk };
}

if (process.argv[1]?.endsWith('translate.ts') && process.argv.includes('--run')) {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) console.log('Нет SUPABASE_URL / SUPABASE_SECRET_KEY — перевод пропускаю');
  else void run(url, key, async (t, level) => { console.log(t); await robotLog(t, level).catch(() => undefined); }).then((r) => console.log('Перевод:', r)).catch((e) => { console.error(e instanceof Error ? e.message : e); process.exitCode = 1; });
}
