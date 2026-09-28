// Модель админки (docs/PIPELINE.md §5, макеты Admin и TasteAdmin). Чистые функции — покрыты тестами.
import { almaty } from '../lib/clock';

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
  address: string | null;
  about: string;
  priceMin: number | null;
  priceMax: number | null;
  isFree: boolean;
}

export interface QueueStats {
  waiting: number;
  onMap: number;
  filtered: number;
  lastRun: string | null; // ISO
}

export interface SourceItem {
  id: string;
  kind: 'telegram' | 'site' | 'threads' | 'manual' | 'user';
  title: string;
  note: string | null;
  trusted: boolean;
  autoPublish: boolean;
  enabled: boolean;
}

const WD = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
const hm = (d: Date) => `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
const money = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

/** Строка под названием в очереди: день(и), время, место, цена — как в макете Admin. */
export function metaLine(e: { startsAt: string; endsAt?: string | null; place: string | null; priceMin: number | null; priceMax: number | null; isFree: boolean }): string {
  const s = almaty(e.startsAt);
  const end = e.endsAt ? almaty(e.endsAt) : null;
  const sameDay = !end || end.toISOString().slice(0, 10) === s.toISOString().slice(0, 10);
  const days = sameDay ? WD[s.getUTCDay()] : `${WD[s.getUTCDay()]}–${WD[end!.getUTCDay()]}`;
  const time = end ? `${hm(s)}–${hm(end)}` : hm(s);
  const price = e.isFree ? 'бесплатно' : e.priceMin != null ? `${e.priceMax && e.priceMax !== e.priceMin ? 'от ' : ''}${money(e.priceMin)} ₸` : null;
  return [`${days}, ${time}`, e.place, price].filter(Boolean).join(' · ');
}

export function sourceLabel(kind: SourceItem['kind'], handle: string, title: string, suggestedBy?: string | null): string {
  if (kind === 'user') return `ПРЕДЛОЖИЛ ПОЛЬЗОВАТЕЛЬ${suggestedBy ? ` · ${suggestedBy}` : ''}`.toUpperCase();
  if (kind === 'telegram') return `TELEGRAM · @${handle}`.toUpperCase();
  if (kind === 'threads') return `THREADS · @${handle}`.toUpperCase();
  return title.toUpperCase();
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
  { id: 's-ya', kind: 'site', title: 'Яндекс Афиша · Алматы', note: 'ссылка на раздел города', trusted: true, autoPublish: true, enabled: true },
  { id: 's-th', kind: 'threads', title: 'Threads · @almaty.weekend', note: 'посты и картинки-афиши', trusted: false, autoPublish: false, enabled: true },
  { id: 's-tg', kind: 'telegram', title: 'Telegram · @afisha_almaty', note: 'канал читается целиком', trusted: false, autoPublish: false, enabled: true },
];
