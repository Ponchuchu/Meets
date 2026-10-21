// Описание карточки как у редактора афиши (FIX3, просьба владельца): Kimi переписывает полный текст со страницы
// события в живое описание — без выдумок, только из того, что есть в тексте. Пачками по 8, чтобы экономить запросы.
// Нет ключа или ИИ недоступен — остаётся аккуратно обрезанный исходный текст (по границе предложения).
import { KIMI_DEFAULT_MODEL, kimiPost } from './kimi.ts';
import type { Found } from './search.ts';

const SYSTEM = `Ты редактор городской афиши Алматы в приложении Meets. Перепиши описание события так, чтобы захотелось пойти.
Правила:
- Только факты из исходного текста. Ничего не придумывай: ни имён, ни цен, ни времени, ни программы.
- По-русски, живо и просто, без канцелярита и без эмодзи. Можно «ты».
- Структура: первая строка — короткий цепляющий абзац (1–2 предложения), что это и почему стоит. Затем 1–2 абзаца: что будет, для кого, атмосфера.
  Если в тексте есть практичное (возраст, длительность, что взять, дресс-код, как попасть) — последней строкой «Важно: …».
- Абзацы разделяй пустой строкой. 300–700 символов всего. Без заголовков и списков.
- Если исходного текста почти нет — 1–2 честных предложения по названию и месту.
- Исходный текст может быть на казахском или английском: описание всё равно пиши по-русски (переведи смысл). Название не трогай.
- Определи, на каком языке пройдёт само событие (спектакль, концерт, лекция): "ru", "kk", "en" или "mix"; не ясно — "ru".
Ответ — JSON {"items":[{"i":0,"about":"…","lang":"ru"}]} для всех событий по порядку.`;

/** Без ИИ: казахские буквы в названии или тексте — событие, скорее всего, на казахском. */
export function guessLang(text: string): 'kk' | 'ru' | 'en' {
  const kk = (text.match(/[әғқңөұүһі]/gi) ?? []).length;
  if (kk >= 3) return 'kk';
  const cyr = (text.match(/[а-яё]/gi) ?? []).length, lat = (text.match(/[a-z]/gi) ?? []).length;
  return lat > 40 && lat > cyr * 3 ? 'en' : 'ru';
}

/** Пометка для карточки: на каком языке событие (русский не пишем). */
export const LANG_TAG: Record<string, string> = { kk: 'на казахском', en: 'на английском', mix: 'на казахском и русском' };

/** Обрезка без обрыва на полуслове: до границы предложения, не длиннее max. */
export function tidy(text: string, max = 700): string {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
  return end > max * 0.5 ? cut.slice(0, end + 1) : `${cut.slice(0, cut.lastIndexOf(' '))}…`;
}

export async function polishAbouts(found: Found[], key = process.env.KIMI_API_KEY): Promise<{ polished: number }> {
  for (const f of found) { f.about = tidy(f.about ?? '', 1500); f.lang ??= guessLang(`${f.title} ${f.about}`); }
  if (!key || process.env.POLISH === 'off') { for (const f of found) f.about = tidy(f.about ?? ''); return { polished: 0 }; }
  let polished = 0;
  for (let s = 0; s < found.length; s += 8) {
    const batch = found.slice(s, s + 8);
    const user = batch.map((f, i) => `#${i}. ${f.title}\nКогда: ${f.starts_at ?? '—'}\nГде: ${[f.venue_name, f.address].filter(Boolean).join(', ') || '—'}\nТекст со страницы: ${f.about || '—'}`).join('\n\n');
    try {
      const body = await kimiPost(key, { model: process.env.KIMI_MODEL || KIMI_DEFAULT_MODEL, max_tokens: 4000, response_format: { type: 'json_object' },
        messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: user }] }, 180_000);
      const raw = body.choices?.[0]?.message?.content ?? '';
      const json = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1)) as { items?: { i: number; about: string; lang?: string }[] };
      for (const it of json.items ?? []) {
        const f = batch[it.i];
        const text = (it.about ?? '').trim();
        if (f && it.lang && /^(ru|kk|en|mix)$/.test(it.lang)) f.lang = it.lang;
        if (f && text.length >= 40 && text.length <= 1200) { f.about = text; polished++; }
      }
    } catch (err) {
      console.error(`  Описания: Kimi не ответил (${(err as Error).message.slice(0, 120)}) — оставляю исходный текст`);
    }
    for (const f of batch) if ((f.about ?? '').length > 900) f.about = tidy(f.about ?? '');
  }
  return { polished };
}
