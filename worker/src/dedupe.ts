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

const dayOf = (iso: string) => new Date(new Date(iso).getTime() + 5 * 3600e3).toISOString().slice(0, 10);

/** Дубль, если тот же день и название похоже; площадка, если известна у обоих, должна совпадать. */
export function findDuplicate(e: { title: string; starts_at: string; venue_name: string | null; is_long?: boolean }, known: KnownEvent[]): KnownEvent | null {
  const day = dayOf(e.starts_at);
  let best: { k: KnownEvent; s: number } | null = null;
  for (const k of known) {
    if (dayOf(k.starts_at) !== day) continue;
    // Одинаковые названия не склеивают два разных сеанса. Длинная выставка остаётся одним событием.
    if (!e.is_long && !k.is_long && Math.floor(Date.parse(e.starts_at) / 60000) !== Math.floor(Date.parse(k.starts_at) / 60000)) continue;
    if (e.venue_name && k.venue_name && similarity(e.venue_name, k.venue_name) < 0.3) continue;
    const s = similarity(e.title, k.title);
    if (s >= 0.5 && (!best || s > best.s)) best = { k, s };
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
