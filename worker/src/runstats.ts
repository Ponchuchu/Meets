// Итоги запуска для панели разработчика: что пришло с сайтов, что отсеяно, какого качества то, что легло в очередь.
// Пишутся в robot_runs.stats (jsonb) и в журнал строками «Источник · имя · итог». Чистые функции, есть тесты.
import { readFile } from 'node:fs/promises';
import type { Outcome } from './pipeline.ts';
import type { SearchReport } from './search.ts';

/** Что реально попало в базу из этого запуска. */
export interface QueueStats {
  /** Новых карточек (черновиков + опубликованных сразу). */
  added: number;
  /** Из них сразу на карте (источник с доверием, 95%+). */
  published: number;
  /** Уже были в базе (дубли). */
  duplicates: number;
  /** Не получилось собрать карточку (нет даты и т. п.). */
  unclear: number;
  /** Не принято: событие уже прошло. */
  past: number;
  withPhoto: number;
  /** Есть точка: площадка из базы или найденные координаты. */
  withPoint: number;
  withPrice: number;
  /** Нужна ручная точка. */
  needPin: number;
}

export interface TelegramStat {
  name: string;
  posts: number;
  events: number;
  ad: number;
  meme: number;
  notAlmaty: number;
  duplicates: number;
  cancels: number;
  unclear: number;
}

export interface RunStats extends Partial<SearchReport> {
  queue: QueueStats;
  /** Удалено просроченных черновиков в начале запуска. */
  purged: number;
  telegram?: TelegramStat[];
}

export function queueStats(results: Outcome[]): QueueStats {
  const q: QueueStats = { added: 0, published: 0, duplicates: 0, unclear: 0, past: 0, withPhoto: 0, withPoint: 0, withPrice: 0, needPin: 0 };
  for (const r of results) {
    if (r.kind === 'draft') {
      const d = r.draft;
      q.added++;
      if (d.status === 'published') q.published++;
      if (d.cover_url) q.withPhoto++;
      if (d.venue_id || d.point) q.withPoint++;
      if (d.price_min != null || d.is_free) q.withPrice++;
      if (d.flags.includes('needs_pin')) q.needPin++;
    } else if (r.kind === 'duplicate') q.duplicates++;
    else if (r.kind === 'unclear') { if (r.reason === 'уже прошло') q.past++; else q.unclear++; }
  }
  return q;
}

export function runStats(results: Outcome[], report: SearchReport | null, purged: number): RunStats {
  return { ...(report ?? {}), queue: queueStats(results), purged };
}

/** Читает отчёт шага поиска (его пишет search.ts). Нет файла — поиск упал до отчёта. */
export async function readReport(file = process.env.SEARCH_REPORT || 'search-report.json'): Promise<SearchReport | null> {
  try { return JSON.parse(await readFile(file, 'utf8')) as SearchReport; } catch { return null; }
}

export function telegramStat(handle: string, results: Outcome[]): TelegramStat {
  const t: TelegramStat = { name: `Telegram @${handle}`, posts: results.length, events: 0, ad: 0, meme: 0, notAlmaty: 0, duplicates: 0, cancels: 0, unclear: 0 };
  for (const r of results) {
    if (r.kind === 'draft') t.events++;
    else if (r.kind === 'junk') { if (r.cls === 'ad') t.ad++; else if (r.cls === 'meme') t.meme++; else t.notAlmaty++; }
    else if (r.kind === 'duplicate') t.duplicates++;
    else if (r.kind === 'cancel') t.cancels++;
    else t.unclear++;
  }
  return t;
}

const word = (n: number, a: string, b: string, c: string) => { const m = n % 10, k = n % 100; return m === 1 && k !== 11 ? a : m >= 2 && m <= 4 && (k < 10 || k >= 20) ? b : c; };

/** «Источник · Telegram @afisha_almaty · 3 события, реклама 5, мемы 2»: строка журнала, панель разбирает её по « · ». */
export function telegramLine(t: TelegramStat): string {
  if (!t.posts) return `Источник · ${t.name} · новых постов нет`;
  const parts = [`${t.events} ${word(t.events, 'событие', 'события', 'событий')}`];
  if (t.ad) parts.push(`реклама ${t.ad}`);
  if (t.meme) parts.push(`мемы ${t.meme}`);
  if (t.notAlmaty) parts.push(`не Алматы ${t.notAlmaty}`);
  if (t.duplicates) parts.push(`дубли ${t.duplicates}`);
  return `Источник · ${t.name} · ${parts.join(', ')}`;
}
