// Очистка текста карточек из постов Instagram и афиш (27 окт., просьба владельца): без эмодзи-«стикеров»,
// без строк, которые повторяют название, дату, время, место и цену — они уже есть на плашках карточки.

const EMOJI = /[\p{Extended_Pictographic}‍️⃣\u{1F1E6}-\u{1F1FF}\u{1F3FB}-\u{1F3FF}]/gu;
export const stripEmoji = (s: string): string => s.replace(EMOJI, '').replace(/[ \t]{2,}/g, ' ').trim();

const MONTHS = 'января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря|қаңтар|ақпан|наурыз|сәуір|мамыр|маусым|шілде|тамыз|қыркүйек|қазан|қараша|желтоқсан|january|february|march|april|june|july|august|september|october|november|december';
// Строка целиком про дату/время/место/цену: «31 октября (суббота)», «19:00», «Дата: …», «Место: …», «Вход свободный», «Билеты от 2000 ₸».
const FACT_LINE = new RegExp([
  `^(дата|время|место|адрес|начало|цена|стоимость|билеты?|вход|формат|сбор|локация|где|когда|date|time|place|venue|price|tickets?)\\s*[:\\-–—]`,
  `^\\d{1,2}[./]\\d{1,2}([./]\\d{2,4})?\\s*[;,·|]?\\s*(\\d{1,2}[:.]\\d{2})?$`,
  `^\\d{1,2}[:.]\\d{2}(\\s*[-–—]\\s*\\d{1,2}[:.]\\d{2})?$`,
  `^\\d{1,2}\\s+(${MONTHS})(\\s*[(/,].*)?$`,
  `^(сегодня|завтра|понедельник|вторник|среда|четверг|пятница|суббота|воскресенье)[,\\s].*(\\d{1,2}[:.]\\d{2}|${MONTHS})`,
  `^(бесплатно|вход свободный|вход бесплатный|тегін|free)\\.?$`,
].join('|'), 'i');
const ONLY_TAGS = /^(#[\p{L}\p{N}_]+[\s,]*)+$/u;

/** Описание без эмодзи и без строк-повторов (название, дата, время, место, цена, хештеги). Если ничего не осталось — исходный текст без эмодзи. */
export function cleanAbout(about: string, title = ''): string {
  const t = stripEmoji(title).toLowerCase().replace(/[«»"']/g, '').trim();
  const lines = about.replace(/\r/g, '').split('\n').map((l) => stripEmoji(l));
  const kept: string[] = [];
  for (const l of lines) {
    const bare = l.replace(/[«»"']/g, '').trim();
    if (bare && (bare.toLowerCase() === t || FACT_LINE.test(bare) || ONLY_TAGS.test(bare))) continue;
    // Строка из нескольких языков через « / »: оставляем русскую часть.
    const parts = bare.split(/\s+\/\s+/);
    const ru = parts.length > 1 ? parts.find((p) => /[а-яё]/i.test(p) && !/[әғқңөұүһі]/i.test(p)) : null;
    kept.push(ru ?? l);
  }
  const out = kept.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  return out || stripEmoji(about);
}

/** Название без эмодзи и висячих знаков; «Дата», «Встреча» и подобные общие слова — не названия. */
export function cleanTitle(title: string): string {
  const t = stripEmoji(title).replace(/^[\s\-–—:·|]+|[\s\-–—:·|]+$/g, '');
  return t || title;
}

/** Текст похож на казахский: заметная доля специальных букв. */
export function looksKazakh(text: string): boolean {
  const kk = (text.match(/[әғқңөұүһі]/gi) ?? []).length;
  const cyr = (text.match(/[а-яёәғқңөұүһі]/gi) ?? []).length;
  return kk >= 3 && kk / Math.max(1, cyr) > 0.06;
}
