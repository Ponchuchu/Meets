// Разбор постов Instagram и Threads без ИИ (26 октября: «всё по скрипту»).
// Один пост → ноль, одно или несколько событий (афиша недели: «27 октября — …, 28 октября — …»).
// Понимает русский, казахский и английский: «5 ноября | 20:00», «29 қарашада», «October 24 · 9 PM», «31 октября — 1 ноября», «до 30 ноября».
// Место: строка с 📍/«Где:», известная площадка в тексте (таблица venues) или место страницы по умолчанию (страница театра, ТЦ).
import { normalize } from './dedupe.ts';
import type { Category, Extraction } from './types.ts';
import type { VenueRow } from './venues.ts';

const TZ = '+05:00';
const pad = (n: number) => String(n).padStart(2, '0');

/** Месяцы: основа слова → номер (0–11). Русские, казахские, английские. */
const MONTHS: [RegExp, number][] = [
  [/^(январ|қаңтар|jan)/, 0], [/^(феврал|ақпан|feb)/, 1], [/^(март|наурыз|mar)/, 2], [/^(апрел|сәуір|apr)/, 3],
  [/^(ма[йя]|мамыр|may)/, 4], [/^(июн|маусым|jun)/, 5], [/^(июл|шілде|jul)/, 6], [/^(август|тамыз|aug)/, 7],
  [/^(сентябр|қыркүйек|sep)/, 8], [/^(октябр|қазан|oct)/, 9], [/^(ноябр|қараша|nov)/, 10], [/^(декабр|желтоқсан|dec)/, 11],
];
const MONTH_WORD = '(январ[яь]|феврал[яь]|марта?|апрел[яь]|ма[йя]|июн[яь]|июл[яь]|августа?|сентябр[яь]|октябр[яь]|ноябр[яь]|декабр[яь]|қаңтар\\S*|ақпан\\S*|наурыз\\S*|сәуір\\S*|мамыр\\S*|маусым\\S*|шілде\\S*|тамыз\\S*|қыркүйек\\S*|қазан\\S*|қараша\\S*|желтоқсан\\S*|january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)';
const monthOf = (w: string): number => MONTHS.find(([re]) => re.test(w.toLowerCase()))?.[1] ?? -1;

// «5 ноября», «31 октября — 1 ноября», «5–7 ноября», «29 қарашада»
const RU_DATE = new RegExp(`(?<![\\d:.])(\\d{1,2})(?:\\s*(?:[–—-]|по|и)\\s*(\\d{1,2}))?\\s+${MONTH_WORD}(?![a-zа-яё])(?:\\s*[–—-]\\s*(\\d{1,2})\\s+${MONTH_WORD})?`, 'iu');
// «October 24», «Nov 5»
const EN_DATE = /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sept?|oct|nov|dec)\.?\s+(\d{1,2})(?:st|nd|rd|th)?\b/i;
// «03.11», «03.11.2026»
const NUM_DATE = /(?<![\d:.])(\d{1,2})\.(\d{1,2})(?:\.(\d{2,4}))?(?![\d:])/;
const TIME = /(?<![\d.])([01]?\d|2[0-3])[:.]([0-5]\d)(?![\d.])|\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i;

export interface When { starts: string; ends: string | null; timeKnown: boolean }

/** Год для дня без года: ближайший не раньше, чем за сутки до поста. */
function yearFor(month: number, day: number, ref: Date): number {
  const local = new Date(ref.getTime() + 5 * 3600e3);
  let y = local.getUTCFullYear();
  if (Date.UTC(y, month, day) < Date.UTC(y, local.getUTCMonth(), local.getUTCDate()) - 86400e3) y++;
  return y;
}

function timeIn(s: string): [number, number] | null {
  // Номера телефонов и цены («7 000 тг») не время: берём только то, что похоже на часы.
  for (const m of s.matchAll(new RegExp(TIME.source, 'gi'))) {
    if (m[1] != null) {
      // «19.30» — время, а «03.11» — дата: точку принимаем, только если месяц быть не может.
      if (m[0].includes('.') && Number(m[2]) <= 12 && !/^(00|15|30|45)$/.test(m[2])) continue;
      return [Number(m[1]), Number(m[2])];
    }
    let h = Number(m[3]) % 12;
    if (m[5].toLowerCase() === 'pm') h += 12;
    return [h, Number(m[4] ?? 0)];
  }
  return null;
}

/** Первая дата в строке: [день, месяц, конец?]. */
export function dateIn(s: string): { day: number; month: number; endDay?: number; endMonth?: number; year?: number; index: number } | null {
  const ru = RU_DATE.exec(s);
  if (ru) {
    const month = monthOf(ru[3]);
    if (month >= 0) {
      const endMonth = ru[5] ? monthOf(ru[5]) : month;
      const endDay = ru[4] ? Number(ru[4]) : ru[2] ? Number(ru[2]) : undefined;
      return { day: Number(ru[1]), month, endDay, endMonth: endDay ? endMonth : undefined, index: ru.index };
    }
  }
  const en = EN_DATE.exec(s);
  if (en) return { day: Number(en[2]), month: monthOf(en[1]), index: en.index };
  const num = NUM_DATE.exec(s);
  if (num && Number(num[2]) >= 1 && Number(num[2]) <= 12 && Number(num[1]) >= 1 && Number(num[1]) <= 31) {
    const y = num[3] ? Number(num[3].length === 2 ? `20${num[3]}` : num[3]) : undefined;
    return { day: Number(num[1]), month: Number(num[2]) - 1, year: y, index: num.index };
  }
  return null;
}

/** Когда: дата из текста, время — первое после даты (или в соседней строке). «сегодня / завтра / бүгін / ертең» — от даты поста. */
export function whenOf(text: string, posted: Date): When | null {
  const t = text.replace(/ /g, ' ');
  let d = dateIn(t);
  if (!d) {
    const rel = /(сегодня|бүгін|today)|(завтра|ертең|tomorrow)/i.exec(t);
    if (!rel) return null;
    const local = new Date(posted.getTime() + 5 * 3600e3 + (rel[2] ? 86400e3 : 0));
    d = { day: local.getUTCDate(), month: local.getUTCMonth(), index: rel.index };
  }
  if (d.month < 0 || d.day < 1 || d.day > 31) return null;
  const year = d.year ?? yearFor(d.month, d.day, posted);
  const tm = timeIn(t.slice(d.index)) ?? timeIn(t);
  const [h, m] = tm ?? [12, 0];
  const starts = `${year}-${pad(d.month + 1)}-${pad(d.day)}T${pad(h)}:${pad(m)}:00${TZ}`;
  let ends: string | null = null;
  if (d.endDay) {
    const em = d.endMonth ?? d.month;
    const ey = em < d.month ? year + 1 : year;
    ends = `${ey}-${pad(em + 1)}-${pad(d.endDay)}T21:00:00${TZ}`;
  } else {
    // «до 30 ноября» — выставка или акция идёт до этой даты.
    const until = new RegExp(`(?:до|по|дейін|until|till)\\s+(\\d{1,2})\\s+${MONTH_WORD}`, 'iu').exec(t);
    if (until && monthOf(until[2]) >= 0) {
      const um = monthOf(until[2]);
      ends = `${yearFor(um, Number(until[1]), posted)}-${pad(um + 1)}-${pad(Number(until[1]))}T21:00:00${TZ}`;
    }
  }
  if (ends && Date.parse(ends) <= Date.parse(starts)) ends = null;
  return { starts, ends, timeKnown: !!tm };
}

// ——— Текст поста ———

const KAZ = /[әғқңөұүһі]/gi;
const RUS = /[ыэъё]/gi;

/** Двуязычные посты делят чертой («———», «____»). Берём русскую часть; нет русской — самую длинную. */
export function russianPart(text: string): string {
  const parts = text.split(/\n\s*[-—–_─=•.*]{2,}\s*\n|\n\s*(?:—|_{1,2})\s*\n/).map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return text.trim();
  const score = (p: string) => (p.match(RUS)?.length ?? 0) * 2 + (/[а-я]/i.test(p) ? 1 : 0) - (p.match(KAZ)?.length ?? 0) * 3;
  const ranked = [...parts].sort((a, b) => score(b) - score(a) || b.length - a.length);
  return ranked[0];
}

const EMOJI = /[\p{Extended_Pictographic}\u{FE0F}\u{200D}\u{20E3}\u{1F1E6}-\u{1F1FF}]/gu;
const stripEmoji = (s: string) => s.replace(EMOJI, '').replace(/[•▪️►▶︎➡️👉]+/g, '').replace(/\s+/g, ' ').trim();

/** «ХАМДАМ СОБИРОВ ВПЕРВЫЕ НА ALMATY ARENA» → «Хамдам Собиров впервые на Almaty Arena»: регистр слов берём из остального текста. */
export function tidyTitle(line: string, context: string): string {
  let s = stripEmoji(line).replace(/^[«"“]+|[»"”]+$/g, (q) => q).replace(/[!.:]+$/, '').replace(/\s*\|\s*$/, '').trim();
  const letters = s.replace(/[^A-Za-zА-Яа-яЁёӘәҒғҚқҢңӨөҰұҮүҺһІі]/g, '');
  const upper = letters.replace(/[^A-ZА-ЯЁӘҒҚҢӨҰҮҺІ]/g, '').length;
  if (letters.length > 6 && upper / letters.length > 0.7) {
    const words = s.split(/(\s+)/);
    s = words.map((w, i) => {
      if (/^\s+$/.test(w)) return w;
      const bare = w.replace(/[^\p{L}\d-]/gu, '');
      if (!bare) return w;
      // Короткие латинские аббревиатуры (DJ, ATP) оставляем.
      if (/^[A-Z\d]{2,4}$/.test(bare)) return w;
      const lower = bare.toLowerCase();
      const capital = lower.charAt(0).toUpperCase() + lower.slice(1);
      // Имя собственное, если в тексте оно встречается с большой буквы не в начале предложения.
      const proper = new RegExp(`[^.!?\\n][\\s«"(]${capital.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'u').test(context) || /^[A-Za-z]/.test(bare);
      return w.replace(bare, i === 0 || proper ? capital : lower);
    }).join('');
  }
  return s.slice(0, 90);
}

// ——— Что за пост ———

const GIVEAWAY = /розыгрыш|разыгрываем|ұтыс|giveaway|конкурс.{0,30}(подпис|репост|отмет)|ваш шанс|выиграть|выигрыш|призов[оы]й фонд|сохраняйте чеки/i;
const NOT_EVENT = /поздравля|құтты болсын|с днём рождения|с днем рождения|режим работы|график работы|будет открыт c|будет открыт с|работает (по|с|в)|скидк[аиу]|распродаж|промокод|акци[яи] действует|вакансия|ищем в команду|требуется/i;
const EVENT_WORDS = /концерт|спектакл|премьер|показ|выставк|лекци|мастер-класс|воркшоп|workshop|встреч|вечеринк|party|квиз|игр[аы]|турнир|забег|поход|восхожден|фестивал|ярмарк|маркет|шоу|show|stand.?up|стендап|open decks|dj|диджей|экскурси|кинопоказ|кино|сеанс|клуб|чтени|разговорн|speaking|билет|вход|регистрац|кіру|тегін|өтеді|басталуы|start/i;

/** Строки с местом: «📍 …», «Где:», «Адрес:», «Өтетін орны:», «Локация:». */
const PLACE_LINE = /📍|^\s*(где|место|адрес|локация|location|venue|өтетін орны|мекенжай|сбор|место сбора)\s*[:—-]/im;

function placeIn(block: string, venues: VenueRow[]): { venue: VenueRow | null; name: string | null; address: string | null } {
  const line = block.split('\n').find((l) => PLACE_LINE.test(l));
  const raw = line ? stripEmoji(line.replace(PLACE_LINE, '')).replace(/^[:\s—-]+/, '') : '';
  const hay = normalize(`${raw} ${block}`);
  // Известная площадка в строке места или в тексте: самая длинная из совпавших (чтобы «Arena» не перебила «Tennisi Arena Pub»).
  let venue: VenueRow | null = null;
  let best = 0;
  for (const v of venues) {
    for (const label of [v.name, ...(v.aliases ?? [])]) {
      const l = normalize(label);
      if (l.length < 4) continue;
      const inPlace = raw && normalize(raw).includes(l);
      if ((inPlace || new RegExp(`(^| )${l.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}( |$)`).test(hay)) && l.length + (inPlace ? 100 : 0) > best) {
        venue = v;
        best = l.length + (inPlace ? 100 : 0);
      }
    }
  }
  if (!raw) return { venue, name: venue?.name ?? null, address: null };
  const parts = raw.split(/[,·|]/).map((x) => x.trim()).filter(Boolean);
  const named = parts.length > 1 && !/\d/.test(parts[0]) ? parts[0] : !/\d/.test(raw) ? raw : null;
  const address = named && parts.length > 1 ? parts.slice(1).join(', ') : /\d/.test(raw) ? raw : null;
  return { venue, name: venue?.name ?? named, address };
}

export function priceIn(text: string): { min: number | null; max: number | null; free: boolean } {
  const t = text.toLowerCase().replace(/ /g, ' ');
  if (/бесплатн|вход свободный|свободный вход|тегін|free entry|free admission|вход free|кіру тегін|\bfree\b/.test(t) && !/(\d[\d\s]{2,7})\s*(₸|тг|тенге|kzt)/.test(t)) return { min: null, max: null, free: true };
  const num = (x: string) => Number(x.replace(/\s/g, ''));
  const nums = [...t.matchAll(/(?:от\s*)?(\d{1,3}(?:[\s.]\d{3})+|\d{3,6})\s*(₸|тг\.?|тенге|kzt|tg)(?![a-zа-я])/g)].map((m) => num(m[1].replace(/\./g, ''))).filter((n) => n >= 300 && n < 1_000_000);
  if (/бесплатн|тегін|(?<![a-z])free(?![a-z])/.test(t) && !nums.length) return { min: null, max: null, free: true };
  if (!nums.length) return { min: null, max: null, free: false };
  return { min: Math.min(...nums), max: nums.length > 1 ? Math.max(...nums) : null, free: false };
}

const FOLDER_CATEGORY: Record<string, Category> = { theatre: 'theatre', standup: 'standup', cinema: 'movie', art: 'art', hike: 'hike', sport: 'sport', music: 'music' };
const WORD_CATEGORY: [Category, RegExp][] = [
  ['standup', /стендап|stand.?up|импров|комик/i],
  ['games', /квиз|quiz|настолк|мафи|игротек|квест/i],
  ['hike', /поход|восхожден|треккинг|хайкинг|ущель|вершин|горы|жорық/i],
  ['theatre', /спектакл|(?<!кино)театр|мюзикл|балет|опер[аы](?![а-я])/i],
  ['movie', /кинопоказ|фильм|кино(?!парк)|сеанс|premiere|премьера фильма/i],
  ['concert', /концерт|оркестр|симфони|tour\b|тур в алматы/i],
  ['party', /вечеринк|party|рейв|техно|open decks|dj|диджей|b2b/i],
  ['art', /выставк|экспозиц|галере|арт-|art\b|музей/i],
  ['lecture', /лекци|мастер-класс|воркшоп|workshop|семинар|курс/i],
  ['talks', /разговорн|speaking|книжн|клуб|дискусс|встреча/i],
  ['food', /маркет|ярмарк|фуд|food|гастро|дегустац/i],
  ['sport', /забег|марафон|турнир|матч|йога|пробежк|теннис|футбол/i],
  ['music', /джаз|jazz|живая музыка|музыкальн|акустик|music|хиты/i],
];
const FOLDER_FIRST = new Set(['theatre', 'standup', 'cinema', 'hike']);
export function categoryFor(text: string, folder: string): Category {
  if (FOLDER_FIRST.has(folder)) return FOLDER_CATEGORY[folder];
  return WORD_CATEGORY.find(([, re]) => re.test(text))?.[0] ?? FOLDER_CATEGORY[folder] ?? 'meetup';
}

const WEEKDAY = /^(понедельник|вторник|сред[аы]|четверг|пятниц[аы]|суббот[аы]|воскресенье|сб|вс|пн|вт|ср|чт|пт|дүйсенбі|сейсенбі|сәрсенбі|бейсенбі|жұма|сенбі|жексенбі|mon|tue|wed|thu|fri|sat|sun)(?![а-яәіңғүұқөһa-z])/i;
const GENERIC = /^(дата(?![а-я])|время(?![а-я])|место(?![а-я])|адрес|цена|стоимость|формат(?![а-я])|локация|программа(?![а-я])|уважаем|приходите|не пропустите|успейте|спешите|покупайте|важн|внимание|информац|анонс|новост|расписание|афиша|подборк|когда|где|сколько|итоги|напоминаем|друзья|дорогие|ждем|ждём|скоро|сегодня|завтра)/i;

/** Название события в блоке: «…» рядом с датой, хвост строки с датой (расписание), заголовок поста, строка у даты. */
function titleIn(block: string, dateLine: number, context: string, reject: string[]): string {
  const lines = block.split('\n').map((l) => l.trim());
  const banned = reject.map((r) => normalize(r));
  const ok = (raw: string | undefined): string | null => {
    if (!raw) return null;
    const s = stripEmoji(raw).replace(/^\[([^\]]+)\]\s*#?\d*$/, '$1').replace(/^\[([^\]]+)\]\s*/, '$1 ').replace(/\s#?\d{1,4}$/, '').trim();
    if (s.length < 3 || s.length > 80 || s.endsWith('?') || PLACE_LINE.test(raw) || dateIn(s) || timeIn(s) || WEEKDAY.test(s) || GENERIC.test(s)) return null;
    if (/билет|ссылк|шапк|регистрац|бронир|\+7|тг\b|₸|^\d+\+$|^#|^(когда|где|сколько|цена|кто|что)(?![а-я])/i.test(s)) return null;
    // Начало фразы с маленькой буквы — обрывок предложения, а не название. Длинная фраза с точкой — текст, а не заголовок.
    if (/^[а-яёәіңғүұқөһ]/.test(s) || (s.length > 50 && /[.]$/.test(s))) return null;
    // «BAKR | Almaty Arena» → «BAKR»: площадку и имя страницы из названия убираем.
    const parts = s.split(/\s+\|\s+/).filter((x) => !banned.includes(normalize(stripEmoji(x))));
    const t = tidyTitle(parts.join(' · ') || s, context).replace(/^«([^»]+)»$/, '$1');
    if (!t || banned.includes(normalize(t))) return null;
    return t;
  };
  const near = (i: number) => Math.abs(i - dateLine) <= 2;
  // «…» после «на стадионе», «в ТРЦ», «в клубе» — это место, а не название.
  const placeQuote = (line: string, q: RegExpExecArray) => /(стадион\S*|трц|тц|клуб\S*|бар\S*|площадк\S*|зал\S*|парк\S*|центр\S*|театр\S*|кинотеатр\S*|ресторан\S*|кафе|галере\S*|музе\S*)\s*$/i.test(line.slice(0, q.index));
  for (let i = 0; i < lines.length; i++) {
    const q = /«([^»]{3,80})»/.exec(lines[i]);
    if (q && near(i) && !placeQuote(lines[i], q)) { const t = ok(q[1]); if (t) return t; }
  }
  const tail = lines[dateLine]?.replace(RU_DATE, '').replace(EN_DATE, '').replace(new RegExp(TIME.source, 'gi'), '').replace(/^[\s,.|—–:-]+|[\s,.|—–:-]+$/g, '');
  const fromTail = ok(tail);
  if (fromTail && dateLine === 0) return fromTail;
  const headline = lines.find((l) => stripEmoji(l).length >= 3);
  const fromHead = ok(headline);
  if (fromHead && stripEmoji(headline ?? '').length <= 70) return fromHead;
  if (fromTail) return fromTail;
  for (const i of [dateLine - 1, dateLine + 1, dateLine + 2, dateLine - 2]) { const t = ok(lines[i]); if (t) return t; }
  for (let i = 0; i < lines.length; i++) {
    const q = /«([^»]{3,80})»/.exec(lines[i]);
    if (q && !placeQuote(lines[i], q)) { const t = ok(q[1]); if (t) return t; }
  }
  return '';
}

/** Описание: русская часть без хэштегов, «ссылка в шапке» и служебных строк. */
export function aboutOf(text: string): string {
  return text.split('\n')
    .filter((l) => !/^\s*(#\S+\s*)+$/.test(l) && !/ссылк[аеи] в шапке|link in bio|в шапке профиля/i.test(l))
    .join('\n').replace(/(^|\s)#[\p{L}\d_]+/gu, '').replace(/\n{3,}/g, '\n\n').trim().slice(0, 1500);
}

export interface SocialSource { folder: string; venue_name: string | null; title?: string }
export type SocialResult = { kind: 'junk'; cls: 'ad' | 'meme' | 'not_almaty' | 'past' } | { kind: 'events'; items: Extraction[] };

/** Дата в этой строке — не день события: продажа билетов, итоги конкурса, дедлайн регистрации. */
const NOT_EVENT_DATE = /продаж|presale|доступ к билетам|итоги|дедлайн|регистраци[яю] до|заявки до|скидк|с \d{1,2} \S+ (музей|театр|мы) (будет|работа)|будет открыт|откроется доступ/i;
const OTHER_CITY = /астан[аеыу]|нур-султан|шымкент|караганд|бишкек|ташкент|тараз|актобе|атырау|актау|павлодар|усть-каменогорск|қарағанды|ақтөбе/i;
const CITY_WORDS = /^(г\.?\s*)?(алматы|алма-ата)(\s+қаласы)?$|^алматы облысы$|^алматинская область$/i;
const SHOW = new Set<Category>(['theatre', 'concert', 'standup', 'movie', 'music', 'party']);
const DAY = 86400e3;

/** Пост → события. Несколько дат в разных строках с названиями → несколько событий (афиша недели). */
export function parseSocial(text: string, postedAt: string, source: SocialSource, venues: VenueRow[], now = new Date()): SocialResult {
  const posted = new Date(postedAt);
  const ru = russianPart(text);
  if (GIVEAWAY.test(text)) return { kind: 'junk', cls: 'ad' };
  if (NOT_EVENT.test(ru) && !(EVENT_WORDS.test(ru) && TIME.test(ru))) return { kind: 'junk', cls: 'meme' };
  const lines = ru.split('\n');
  const dateLines = lines.map((l, i) => (dateIn(l) && !NOT_EVENT_DATE.test(l) ? i : -1)).filter((i) => i >= 0);
  if (!dateLines.length) return { kind: 'junk', cls: 'meme' };
  if (!EVENT_WORDS.test(ru) && !TIME.test(ru) && !source.venue_name) return { kind: 'junk', cls: 'meme' };

  // Расписание: три и больше строк с датами или две с разными днями и временем у каждой. Иначе пост — одно событие.
  const days = new Set(dateLines.map((i) => { const d = dateIn(lines[i])!; return `${d.month}-${d.day}`; }));
  const timed = lines.filter((l) => timeIn(l)).length;
  const schedule = days.size >= 2 && (dateLines.length >= 3 || timed >= 2) && dateLines.every((i, k) => k === 0 || i - dateLines[k - 1] <= 8);
  const blocks: { text: string; dateLine: number }[] = schedule
    ? dateLines.map((start, k) => {
      const end = dateLines[k + 1] ?? Math.min(lines.length, start + 6);
      // Название может стоять строкой выше даты («Отдел маркетинга / 26 октября, 21:30»).
      const prev = lines[start - 1]?.trim();
      const from = prev && (k === 0 || start - 1 > dateLines[k - 1]) && !dateIn(prev) && stripEmoji(prev).length <= 60 ? start - 1 : start;
      return { text: lines.slice(from, end).join('\n'), dateLine: start - from };
    })
    : [{ text: ru, dateLine: dateLines[0] }];

  const reject = [source.title ?? '', source.venue_name ?? '', ...venues.filter((v) => v.name).map((v) => v.name)].filter(Boolean);
  const items: Extraction[] = [];
  let past = 0;
  let away = 0;
  for (const b of blocks) {
    // Гастроли: блок про другой город (и без Алматы) — не наш.
    if (OTHER_CITY.test(b.text) && !/алмат/i.test(b.text)) { away++; continue; }
    let when = whenOf(schedule ? b.text : lines.slice(dateLines[0]).join('\n'), posted);
    if (!when) continue;
    // «до 17 января» без даты начала — выставка уже идёт: с сегодня до этой даты.
    const first = dateIn(b.text);
    if (first && /(?:до|по|дейін|until|till)\s*$/i.test(b.text.slice(Math.max(0, first.index - 8), first.index)) && !when.ends) {
      const startDay = new Date(Math.max(posted.getTime(), now.getTime()) + 5 * 3600e3).toISOString().slice(0, 10);
      when = { starts: `${startDay}T10:00:00${TZ}`, ends: when.starts.replace(/T\d{2}:\d{2}/, 'T21:00'), timeKnown: false };
    }
    // Дата далеко после поста — это рассказ о прошедшем (год угадан неверно).
    if (Date.parse(when.starts) - posted.getTime() > 240 * DAY) { past++; continue; }
    if (Date.parse(when.ends ?? when.starts) < now.getTime() - 3 * 3600e3) { past++; continue; }
    const title = titleIn(b.text, b.dateLine, text, reject) || (schedule ? '' : titleIn(ru, 0, text, reject));
    if (!title) continue;
    const place = placeIn(b.text, venues);
    // В расписании площадка часто стоит строкой со временем: «Mad Murphy’s 19:30».
    if (schedule && !place.venue && !place.name) {
      const withTime = b.text.split('\n').find((l) => timeIn(l) && !dateIn(l));
      const name = withTime ? stripEmoji(withTime.replace(new RegExp(TIME.source, 'gi'), '')).replace(/[\s,.|—–:-]+$/, '') : '';
      if (name.length >= 3 && name.length <= 50) place.name = name;
    }
    if (place.name && CITY_WORDS.test(place.name.trim())) place.name = null;
    const own = !place.venue && !place.address && !place.name && source.venue_name ? venues.find((v) => normalize(v.name) === normalize(source.venue_name!)) ?? null : null;
    const venue = place.venue ?? own;
    const price = priceIn(b.text.length > 40 ? b.text : ru);
    let fullTitle = title;
    // «Кино и музыка» у квиза — это «Квиз, плиз! Кино и музыка».
    if (schedule && source.title && fullTitle.length < 28 && !normalize(fullTitle).includes(normalize(source.title).split(' ')[0])) fullTitle = `${source.title}: ${fullTitle}`;
    const category = categoryFor(`${fullTitle}\n${b.text}`, source.folder);
    const span = when.ends ? Date.parse(when.ends) - Date.parse(when.starts) : 0;
    // Спектакль «31 октября — 1 ноября» — это два показа, а не одно длинное событие.
    const showDays = SHOW.has(category) && span > 0 && span < 3 * DAY ? Math.round(span / DAY) + 1 : 1;
    const isLong = !!when.ends && showDays === 1 && span > 20 * 3600e3;
    const hasPlace = !!venue || !!place.address || !!place.name || !!source.venue_name;
    let confidence = 0.6;
    if (when.timeKnown || isLong) confidence += 0.2;
    if (venue) confidence += 0.16; else if (hasPlace) confidence += 0.08;
    // Несколько показов («31 октября — 1 ноября») — одна карточка со списком дат.
    const sessions: string[] = [];
    for (let d = 0; d < showDays; d++) {
      const at = Date.parse(when.starts) + d * DAY;
      if (at >= now.getTime() - 3 * 3600e3) sessions.push(`${new Date(at + 5 * 3600e3).toISOString().slice(0, 19)}${TZ}`);
    }
    if (!sessions.length) { past++; continue; }
    items.push({
      class: 'event',
      title: fullTitle,
      category,
      tags: source.folder === 'kids' ? ['дети'] : [],
      starts_at: sessions[0],
      ends_at: showDays > 1 ? null : when.ends,
      is_long: isLong,
      venue_name: venue?.name ?? place.name ?? source.venue_name,
      address: venue?.address ?? place.address,
      address_note: null,
      price_min: price.min,
      price_max: price.max,
      is_free: price.free,
      price_unsure: !price.free && price.min == null,
      about: aboutOf(schedule ? `${b.text}\n\n${lines.slice(0, Math.max(dateLines[0], 1)).join('\n')}` : ru),
      organizer: source.title ?? null,
      confidence: Math.min(confidence, 0.96),
      cancel_of: null,
      lat: venue?.lat ?? null,
      lon: venue?.lon ?? null,
      time_known: when.timeKnown || isLong,
      sessions,
    });
  }
  // Одно и то же в расписании несколько раз («Классика» во вторник и в четверг в одном баре) — одна карточка с датами.
  const merged: Extraction[] = [];
  for (const x of items) {
    const same = merged.find((m) => normalize(m.title) === normalize(x.title) && normalize(m.venue_name ?? '') === normalize(x.venue_name ?? ''));
    if (!same) { merged.push(x); continue; }
    const all = [...new Set([...(same.sessions ?? []), ...(x.sessions ?? [])])].sort((p, q) => Date.parse(p) - Date.parse(q));
    same.sessions = all;
    same.starts_at = all[0];
  }
  items.length = 0;
  items.push(...merged);
  if (items.length) return { kind: 'events', items };
  return { kind: 'junk', cls: away ? 'not_almaty' : past ? 'past' : 'meme' };
}
