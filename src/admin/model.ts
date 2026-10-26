// Модель админки (docs/PIPELINE.md §5, макеты Admin и TasteAdmin). Чистые функции — покрыты тестами.
import { almaty } from '../lib/clock';
import type {Category} from '../data/types';
import { eventFacts } from '../event/facts';

export type QueueFlag = 'needs_pin' | 'check_price' | 'cancel_reported';

export interface QueueItem {
  id: string;
  /** «THREADS · @ALMATY.WEEKEND», «ПРЕДЛОЖИЛ ПОЛЬЗОВАТЕЛЬ · АЙНУРА». */
  source: string;
  confidence: number | null; // 0–100
  title: string;
  meta: string; // «сб–вс, 11:00–21:00 · ТРЦ · 2 500 ₸»
  flags: QueueFlag[];
  startsAt: string;
  endsAt?: string | null;
  address: string | null;
  about: string;
  priceMin: number | null;
  priceMax: number | null;
  isFree: boolean;
  point?: { lat: number; lon: number } | null;
  coverUrl?: string | null;
  category?: Category;
}

export interface QueueStats {
  waiting: number;
  onMap: number;
  filtered: number;
  lastRun: string | null; // ISO
}

export interface SourceItem {
  id: string;
  kind: 'telegram' | 'site' | 'threads' | 'instagram' | 'manual' | 'user' | 'search';
  /** Папка в панели: Афиши, Площадки, ТЦ, Театры… (миграция 51). */
  folder?: string;
  /** Место по умолчанию у страницы площадки («Almaty Arena»). */
  venueName?: string | null;
  /** Итоги последнего сбора: когда работало, ошибка, сколько постов и событий, профиль страницы. */
  stats?: { ok_at?: string; error?: string | null; error_at?: string; posts?: number; events?: number; dups?: number; junk?: number; name?: string | null; followers?: number | null; avatar?: string | null; last_post_at?: string } | null;
  /** Отчёт из базы: всего событий, на карте сейчас, ждут проверки, за неделю. */
  report?: { total: number; live: number; drafts: number; week: number; postsWeek: number };
  lastRunAt?: string | null;
  /** Адрес/ник: по нему отличаем Sxodim от Яндекса. */
  handle?: string;
  title: string;
  note: string | null;
  trusted: boolean;
  autoPublish: boolean;
  enabled: boolean;
}

const WD = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
const hm = (d: Date) => `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;

/** Строка под названием в очереди: день(и), время, место, цена — как в макете Admin. */
export function metaLine(e: { startsAt: string; endsAt?: string | null; place: string | null; priceMin: number | null; priceMax: number | null; isFree: boolean }): string {
  const f = eventFacts({ startsAt: e.startsAt, venueName: e.place, priceMin: e.priceMin, priceMax: e.priceMax, isFree: e.isFree });
  let when = f.when;
  if (!f.whenMissing && !f.when.includes('время не указано')) {
    const s = almaty(e.startsAt);
    const end = e.endsAt ? almaty(e.endsAt) : null;
    const sameDay = !end || end.toISOString().slice(0, 10) === s.toISOString().slice(0, 10);
    const days = sameDay ? WD[s.getUTCDay()] : `${WD[s.getUTCDay()]}–${WD[end!.getUTCDay()]}`;
    when = `${days}, ${end ? `${hm(s)}–${hm(end)}` : hm(s)}`;
  }
  return [when, f.place, f.price].join(' · ');
}

export function sourceLabel(kind: SourceItem['kind'], handle: string, title: string, suggestedBy?: string | null): string {
  if (kind === 'user') return `ПРЕДЛОЖИЛ ПОЛЬЗОВАТЕЛЬ${suggestedBy ? ` · ${suggestedBy}` : ''}`.toUpperCase();
  if (kind === 'telegram') return `TELEGRAM · @${handle}`.toUpperCase();
  if (kind === 'threads') return `THREADS · @${handle}`.toUpperCase();
  // Сайты и поиск: название источника без города («Яндекс Афиша · Алматы» → «ЯНДЕКС АФИША»), поиск ИИ — «ИИ-ПОИСК».
  if (kind === 'search') return 'ИИ-ПОИСК';
  return title.replace(/\s*·\s*Алматы\s*$/i, '').toUpperCase();
}

const MONTHS = ['январ', 'феврал', 'март', 'апрел', 'ма', 'июн', 'июл', 'август', 'сентябр', 'октябр', 'ноябр', 'декабр'];

/** «Пт, 2 октября» + «20:00» → ISO по Алматы. Год — ближайший будущий. null, если не разобрать. */
export function parseRuDate(date: string, time: string, now: Date): string | null {
  const m = /(\d{1,2})\s+([а-яё]+)/i.exec(date);
  const t = /(\d{1,2}):(\d{2})/.exec(time);
  if (!m) return null;
  const month = MONTHS.findIndex((x) => m[2].toLowerCase().startsWith(x));
  if (month < 0) return null;
  const local = almaty(now);
  let year = local.getUTCFullYear();
  if (month < local.getUTCMonth() - 2) year++;
  const [h, mm] = t ? [Number(t[1]), Number(t[2])] : [12, 0];
  return new Date(Date.UTC(year, month, Number(m[1]), h, mm) - 5 * 3600e3).toISOString();
}

// ——— Демо: очередь и источники как в макетах Admin и Pipeline ———

export const DEMO_STATS: QueueStats = { waiting: 4, onMap: 48, filtered: 27, lastRun: null };

export function demoQueue(now: Date): QueueItem[] {
  const day = (offset: number, h: number, m = 0) => {
    const d = almaty(now);
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + offset, h, m) - 5 * 3600e3).toISOString();
  };
  const nextWd = (wd: number) => (wd - almaty(now).getUTCDay() + 7) % 7 || 7;
  const base = { address: null, about: '', flags: [] as QueueFlag[] };
  const item = (x: Partial<QueueItem> & Pick<QueueItem, 'id' | 'source' | 'confidence' | 'title' | 'startsAt'> & { endsAt?: string; place: string | null; priceMin?: number | null; isFree?: boolean }): QueueItem => ({
    ...base,
    priceMin: x.priceMin ?? null,
    priceMax: null,
    isFree: x.isFree ?? false,
    ...x,
    meta: metaLine({ startsAt: x.startsAt, endsAt: x.endsAt, place: x.place, priceMin: x.priceMin ?? null, priceMax: null, isFree: x.isFree ?? false }),
  });
  return [
    item({ id: 'q-anime', source: 'THREADS · @ALMATY.WEEKEND', confidence: 94, title: 'Аниме-выставка «Токио в Алматы»', startsAt: day(nextWd(6), 11), endsAt: day(nextWd(6) + 1, 21), place: 'ТРЦ', priceMin: 2500, about: 'Косплей, мастер-классы по манге и фотозона.' }),
    item({ id: 'q-exo', source: 'ЯНДЕКС АФИША', confidence: 99, title: 'Лекция «Как искать экзопланеты»', startsAt: day(nextWd(4), 19), place: 'библиотека', isFree: true, about: 'Астрофизик расскажет, как находят планеты у других звёзд.' }),
    item({ id: 'q-roof', source: 'TELEGRAM · @AFISHA_ALMATY', confidence: 81, title: 'Вечеринка на крыше', startsAt: day(nextWd(5), 22), place: 'адрес «в центре»', priceMin: 5000, flags: ['needs_pin'], address: 'в центре' }),
    item({ id: 'q-flea', source: 'ПРЕДЛОЖИЛ ПОЛЬЗОВАТЕЛЬ · АЙНУРА', confidence: 88, title: 'Барахолка винтажа во дворе', startsAt: day(nextWd(0), 12), endsAt: day(nextWd(0), 18), place: 'Панфилова', isFree: true }),
  ].map((x) => (x.id === 'q-flea' ? { ...x, meta: x.meta.replace('бесплатно', 'вход свободный') } : x));
}

export const DEMO_SOURCES: SourceItem[] = [
  { id: 's-arena', kind: 'instagram', handle: 'almatyarena', title: 'Almaty Arena', folder: 'venue', venueName: 'Almaty Arena', note: null, trusted: true, autoPublish: true, enabled: true,
    stats: { ok_at: new Date(Date.now() - 2 * 3600e3).toISOString(), posts: 8, events: 4, followers: 128000, last_post_at: new Date(Date.now() - 5 * 3600e3).toISOString() }, report: { total: 4, live: 4, drafts: 0, week: 4, postsWeek: 8 } },
  { id: 's-total', kind: 'instagram', handle: 'total_theater', title: 'Тотальный театр', folder: 'theatre', venueName: 'Тотальный театр', note: null, trusted: true, autoPublish: true, enabled: true,
    stats: { ok_at: new Date(Date.now() - 2 * 3600e3).toISOString(), posts: 25, events: 6 }, report: { total: 6, live: 5, drafts: 1, week: 6, postsWeek: 25 } },
  { id: 's-mega', kind: 'instagram', handle: 'mega_center', title: 'MEGA Alma-Ata', folder: 'mall', venueName: 'MEGA Alma-Ata', note: null, trusted: true, autoPublish: false, enabled: true,
    stats: { ok_at: new Date(Date.now() - 2 * 3600e3).toISOString(), posts: 30, events: 0 }, report: { total: 0, live: 0, drafts: 0, week: 0, postsWeek: 30 } },
  { id: 's-monte', kind: 'instagram', handle: 'monte_almaty', title: 'Monte · походы в горы', folder: 'hike', note: null, trusted: false, autoPublish: false, enabled: true,
    stats: { ok_at: new Date(Date.now() - 2 * 3600e3).toISOString(), posts: 4, events: 2 }, report: { total: 2, live: 2, drafts: 1, week: 2, postsWeek: 4 } },
  { id: 's-ya', kind: 'site', handle: 'afisha.yandex.kz/almaty', title: 'Яндекс Афиша · Алматы', folder: 'afisha', note: 'ссылка на раздел города', trusted: true, autoPublish: true, enabled: true, report: { total: 64, live: 19, drafts: 0, week: 12, postsWeek: 30 } },
  { id: 's-th', kind: 'threads', handle: 'almaty.weekend', title: 'Threads · @almaty.weekend', folder: 'afisha', note: 'посты и картинки-афиши', trusted: false, autoPublish: false, enabled: true,
    stats: { error: 'Нет ключа THREADS_TOKEN — как получить, в docs/KEYS.md', error_at: new Date().toISOString() } },
  { id: 's-tg', kind: 'telegram', handle: 'afisha_almaty', title: 'Telegram · @afisha_almaty', folder: 'afisha', note: 'канал читается целиком', trusted: false, autoPublish: false, enabled: true },
];
