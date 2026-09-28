// Разбор поста без ИИ: демо-режим, тесты и запасной путь, если Anthropic API недоступен.
// Грубее, чем ИИ, поэтому уверенность ниже 0.9 — такие черновики всегда идут модератору.
import type { Category, Extraction, PostClass } from './types.ts';

const MONTHS = ['январ', 'феврал', 'март', 'апрел', 'ма[йя]', 'июн', 'июл', 'август', 'сентябр', 'октябр', 'ноябр', 'декабр'];
const MONTH_RE = MONTHS.join('|');
const TZ = '+05:00';

const CATEGORY_WORDS: [Category, RegExp][] = [
  ['standup', /стендап|stand-?up|открытый микрофон|комик/i],
  ['concert', /концерт|оркестр|филармони|тур в алматы/i],
  ['music', /джаз|jazz|dj|диджей|живая музыка|акустик|рок|инди|вечеринк/i],
  ['hike', /поход|треккинг|восхождени|ущель|пик |горы|озеро/i],
  ['bike', /вело|байк|bike/i],
  ['games', /настолк|квиз|квест|мафи|игротек/i],
  ['art', /выставк|галере|арт|музей|аниме|экспозици/i],
  ['theatre', /спектакл|театр|премьер|мюзикл/i],
  ['lecture', /лекци|семинар|мастер-класс|воркшоп|workshop/i],
  ['talks', /разговор|дискусси|встреча с автором|подкаст|клуб/i],
  ['food', /маркет|фуд|ярмарк|барахолк|дегустац|бранч|гастро/i],
  ['sport', /забег|турнир|матч|йога|пробежк|футбол|баскетбол/i],
  ['party', /party|пати|рейв|техно|клуб /i],
];

const pad = (n: number) => String(n).padStart(2, '0');

export function classify(text: string): PostClass {
  const t = text.toLowerCase();
  if (/отмен[аяеё]н|отменяется|не состоится|перенос(ится|ен)/.test(t)) return 'cancel';
  const hasDate = new RegExp(`\\d{1,2}\\s*(${MONTH_RE})|\\b\\d{1,2}\\.\\d{1,2}\\b|сегодня|завтра`, 'i').test(t);
  const hasTime = /\b\d{1,2}:\d{2}\b/.test(t);
  if (/промокод|скидк[аиу]|распродаж|доставк|закажи|купи(те)?\b|реклам/.test(t) && !(hasDate && hasTime)) return 'ad';
  if (/астан[аеы]|шымкент|караганд|бишкек|ташкент/.test(t) && !/алмат/.test(t)) return 'not_almaty';
  if (hasDate && (hasTime || /вход|билет|регистрац|начало|бесплатно/.test(t))) return 'event';
  return 'meme';
}

/** Дата и время начала/конца по Алматы. `ref` — когда вышел пост (для года и «сегодня/завтра»). */
export function parseWhen(text: string, ref: Date): { starts: string | null; ends: string | null } {
  const t = text.toLowerCase();
  const times = [...t.matchAll(/\b(\d{1,2}):(\d{2})\b/g)].map((m) => [Number(m[1]), Number(m[2])] as const).filter(([h, m]) => h < 24 && m < 60);
  let day: number | null = null;
  let endDay: number | null = null;
  let month: number | null = null;
  const named = new RegExp(`(\\d{1,2})(?:\\s*[–—-]\\s*(\\d{1,2}))?\\s*(${MONTH_RE})`, 'i').exec(t);
  // Время пишут через двоеточие, дату — через точку: «03.10 в 19:30».
  const numeric = /\b(\d{1,2})\.(\d{1,2})(?:\.\d{2,4})?\b/.exec(t);
  const refLocal = new Date(ref.getTime() + 5 * 3600e3);
  if (named) {
    day = Number(named[1]);
    endDay = named[2] ? Number(named[2]) : null;
    month = MONTHS.findIndex((m) => new RegExp(`^${m}`, 'i').test(named[3]));
  } else if (numeric && Number(numeric[2]) >= 1 && Number(numeric[2]) <= 12) {
    day = Number(numeric[1]);
    month = Number(numeric[2]) - 1;
  } else if (/сегодня/.test(t) || /завтра/.test(t)) {
    const d = new Date(refLocal.getTime() + (/завтра/.test(t) ? 86400e3 : 0));
    day = d.getUTCDate();
    month = d.getUTCMonth();
  }
  if (day == null || month == null || month < 0) return { starts: null, ends: null };
  // Год: если месяц сильно раньше месяца поста — это следующий год.
  let year = refLocal.getUTCFullYear();
  if (month < refLocal.getUTCMonth() - 2) year++;
  const [h, m] = times[0] ?? [12, 0];
  const starts = `${year}-${pad(month + 1)}-${pad(day)}T${pad(h)}:${pad(m)}:00${TZ}`;
  let ends: string | null = null;
  if (endDay != null || times[1]) {
    const [eh, em] = times[1] ?? [21, 0];
    ends = `${year}-${pad(month + 1)}-${pad(endDay ?? day)}T${pad(eh)}:${pad(em)}:00${TZ}`;
    if (new Date(ends) <= new Date(starts)) ends = null;
  }
  return { starts, ends };
}

export function parsePrice(text: string): { min: number | null; max: number | null; free: boolean; unsure: boolean } {
  const t = text.toLowerCase();
  if (/бесплатно|вход свободный|free\b|вход — 0/.test(t)) return { min: null, max: null, free: true, unsure: false };
  const num = (x: string) => Number(x.replace(/\s/g, ''));
  const range = /(\d[\d\s]{0,7}?)\s*[–—-]\s*(\d[\d\s]{0,7}?)\s*(₸|тг|тенге|kzt)/.exec(t);
  if (range) return { min: num(range[1]), max: num(range[2]), free: false, unsure: false };
  const nums = [...t.matchAll(/(\d[\d\s]{1,7})\s*(₸|тг|тенге|kzt)/g)].map((m) => num(m[1])).filter((n) => n > 0 && n < 1_000_000);
  if (!nums.length) return { min: null, max: null, free: false, unsure: /билет|вход/.test(t) };
  return { min: Math.min(...nums), max: nums.length > 1 ? Math.max(...nums) : null, free: false, unsure: /от\s*\d/.test(t) };
}

export function parsePlace(text: string): { venue: string | null; address: string | null; note: string | null } {
  const line = text.split('\n').find((l) => /📍|где:|место:|адрес:/i.test(l));
  if (!line) return { venue: null, address: null, note: null };
  const clean = line.replace(/📍|где:|место:|адрес:/gi, '').trim();
  const note = /(\d+\s*этаж|вход со двора|во дворе|[\w-]+ зал)/i.exec(clean)?.[1] ?? null;
  const parts = clean.split(/[,·]/).map((x) => x.trim()).filter(Boolean);
  const hasNumber = (s: string) => /\d/.test(s);
  const venue = parts.length > 1 && !hasNumber(parts[0]) ? parts[0] : null;
  const address = venue ? parts.slice(1).join(', ') : clean;
  return { venue, address: address || null, note };
}

function titleOf(text: string): string {
  const first = text.split('\n').map((l) => l.replace(/[\p{Extended_Pictographic}\u{FE0F}#*_]/gu, '').trim()).find((l) => l.length > 3) ?? '';
  return first.replace(/[.!]+$/, '').slice(0, 90);
}

export function categoryOf(text: string): Category {
  return CATEGORY_WORDS.find(([, re]) => re.test(text))?.[0] ?? 'meetup';
}

export function extract(text: string, postedAt: string | null): Extraction {
  const cls = classify(text);
  const ref = postedAt ? new Date(postedAt) : new Date();
  const when = parseWhen(text, ref);
  const price = parsePrice(text);
  const place = parsePlace(text);
  const title = titleOf(text);
  const category = categoryOf(text);
  const about = text.split('\n').slice(1).join(' ').replace(/\s+/g, ' ').trim().slice(0, 280);
  const isLong = !!when.ends && new Date(when.ends).getTime() - new Date(when.starts ?? when.ends).getTime() > 8 * 3600e3;
  let confidence = cls === 'event' ? 0.55 : 0.8;
  if (cls === 'event') {
    if (when.starts) confidence += 0.15;
    if (place.address) confidence += 0.1;
    if (price.free || price.min != null) confidence += 0.05;
  }
  return {
    class: cls,
    title,
    category,
    tags: [],
    starts_at: when.starts,
    ends_at: when.ends,
    is_long: isLong,
    venue_name: place.venue,
    address: place.address,
    address_note: place.note,
    price_min: price.min,
    price_max: price.max,
    is_free: price.free,
    price_unsure: price.unsure,
    about,
    organizer: null,
    confidence: Math.min(confidence, 0.89),
    cancel_of: cls === 'cancel' ? title.replace(/^(отмена|перенос)\s*[:—-]?\s*/i, '') : null,
  };
}
