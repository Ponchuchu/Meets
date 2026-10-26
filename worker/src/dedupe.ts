// Дубли: одно событие из трёх каналов = одна точка. Сравниваем название, день и площадку.
import type { KnownEvent } from './types.ts';

const STOP = new Set(['в', 'на', 'и', 'с', 'по', 'для', 'из', 'от', 'до', 'the', 'a', 'вечер', 'событие']);

export function normalize(s: string): string {
  return s.toLowerCase().replace(/ё/g, 'е').replace(/[«»"'“”„.,!?:;()\-–—/\\]/g, ' ').replace(/\s+/g, ' ').trim();
}

export function tokens(s: string): Set<string> {
  return new Set(normalize(s).split(' ').filter((w) => w.length > 1 && !STOP.has(w)).map((w) => w.slice(0, 6)));
}

/** Похожесть названий 0–1 (Жаккар по основам слов). */
export function similarity(a: string, b: string): number {
  const x = tokens(a);
  const y = tokens(b);
  if (!x.size || !y.size) return 0;
  let common = 0;
  x.forEach((w) => y.has(w) && common++);
  return common / (x.size + y.size - common);
}

/** Доля общих слов от короткого названия: «Хамдам Собиров» и «Хамдам Собиров впервые на Almaty Arena» — одно. */
export function overlap(a: string, b: string): number {
  const x = tokens(a);
  const y = tokens(b);
  if (!x.size || !y.size) return 0;
  let common = 0;
  x.forEach((w) => y.has(w) && common++);
  return common / Math.min(x.size, y.size);
}

/** Время не написано в посте — стоит полдень по Алматы. */
const noon = (iso: string) => new Date(Date.parse(iso) + 5 * 3600e3).toISOString().slice(11, 16) === '12:00';

const dayOf = (iso: string) => new Date(new Date(iso).getTime() + 5 * 3600e3).toISOString().slice(0, 10);

/** Дубль, если тот же день и название похоже; площадка, если известна у обоих, должна совпадать. */
export function findDuplicate(e: { title: string; starts_at: string; venue_name: string | null; is_long?: boolean; time_known?: boolean }, known: KnownEvent[]): KnownEvent | null {
  const day = dayOf(e.starts_at);
  let best: { k: KnownEvent; s: number } | null = null;
  for (const k0 of known) {
    // У события с несколькими датами сравниваем с каждой.
    const at = (k0.sessions?.length ? k0.sessions : [k0.starts_at]).find((x) => dayOf(x) === day);
    if (!at) continue;
    const k = { ...k0, starts_at: at };
    // Одинаковые названия не склеивают два разных сеанса. Длинная выставка остаётся одним событием.
    // Время неизвестно у одного из двух (пост без часов) — сравниваем по дню.
    const anyTime = e.time_known === false || noon(k.starts_at);
    if (!anyTime && !e.is_long && !k.is_long && Math.floor(Date.parse(e.starts_at) / 60000) !== Math.floor(Date.parse(k.starts_at) / 60000)) continue;
    const sameVenue = !!e.venue_name && !!k.venue_name && (similarity(e.venue_name, k.venue_name) >= 0.5 || normalize(e.venue_name).includes(normalize(k.venue_name)) || normalize(k.venue_name).includes(normalize(e.venue_name)));
    if (e.venue_name && k.venue_name && !sameVenue && similarity(e.venue_name, k.venue_name) < 0.3) continue;
    // На той же площадке в тот же день хватает общих слов короткого названия (имя артиста, название спектакля).
    let s = similarity(e.title, k.title);
    if (s < 0.5 && sameVenue && overlap(e.title, k.title) >= 0.6) s = 0.5;
    if (s >= 0.5 && (!best || s > best.s)) best = { k: k0, s };
  }
  return best?.k ?? null;
}

/**
 * То же событие в другой день: спектакль, квиз или стендап-шоу повторяется на той же площадке.
 * Тогда это не новая карточка, а ещё одна дата у прежней. Площадка обязана совпасть, название — почти целиком.
 */
export function findSeries(e: { title: string; starts_at: string; venue_name: string | null; is_long?: boolean }, known: KnownEvent[]): KnownEvent | null {
  if (!e.venue_name || e.is_long) return null;
  const at = Date.parse(e.starts_at);
  let best: { k: KnownEvent; s: number } | null = null;
  for (const k of known) {
    if (!k.venue_name || k.is_long || k.id.startsWith('new:gone') || k.id.startsWith('new:orig')) continue;
    if (Math.abs(Date.parse(k.starts_at) - at) > 60 * 86400e3) continue;
    const v = normalize(e.venue_name), w = normalize(k.venue_name);
    if (!(v === w || v.includes(w) || w.includes(v) || similarity(v, w) >= 0.6)) continue;
    const s = Math.max(similarity(e.title, k.title), overlap(e.title, k.title) >= 0.9 && Math.min(tokens(e.title).size, tokens(k.title).size) >= 2 ? 0.8 : 0);
    if (s >= 0.75 && (!best || s > best.s)) best = { k, s };
  }
  return best?.k ?? null;
}

/** Для отмены: какое из известных событий имеется в виду (без учёта дня — дату в отмене часто не пишут). */
export function findByTitle(title: string, known: KnownEvent[]): KnownEvent | null {
  let best: { k: KnownEvent; s: number } | null = null;
  for (const k of known) {
    const s = similarity(title, k.title);
    if (s >= 0.5 && (!best || s > best.s)) best = { k, s };
  }
  return best?.k ?? null;
}
