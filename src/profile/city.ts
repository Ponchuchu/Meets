// «Открытый город»: соты h3 разрешения 8 (≈0.74 км², ребро ≈ 460 м). Сота открывается отметкой «Я на месте».
// % города — от сот, где вообще бывают события.
import { latLngToCell } from '../lib/h3';

export const H3_RES = 8;

export function cellOf(lat: number, lon: number): string {
  return latLngToCell(lat, lon, H3_RES);
}

export function cityPercent(visited: Iterable<string>, eventCells: Iterable<string>): number {
  const all = new Set(eventCells);
  if (!all.size) return 0;
  let n = 0;
  for (const c of new Set(visited)) if (all.has(c)) n++;
  return Math.round((n / all.size) * 100);
}

export interface Level {
  n: number;
  name: string;
  from: number;
  to: number | null;
}

// Уровни города (PRODUCT.md, раздел 10) — владелец может поменять.
export const LEVELS: Level[] = [
  { n: 1, name: 'Турист', from: 0, to: 5 },
  { n: 2, name: 'Гость', from: 5, to: 10 },
  { n: 3, name: 'Прохожий', from: 10, to: 15 },
  { n: 4, name: 'Горожанин', from: 15, to: 25 },
  { n: 5, name: 'Знаток', from: 25, to: 40 },
  { n: 6, name: 'Старожил', from: 40, to: 60 },
  { n: 7, name: 'Легенда', from: 60, to: null },
];

export function levelOf(pct: number): Level {
  return [...LEVELS].reverse().find((l) => pct >= l.from) ?? LEVELS[0];
}

/** «до 25% — ещё 6 мест»: сколько сот до следующего уровня. */
export function nextLevelHint(visitedCount: number, totalCells: number): string | null {
  const pct = (visitedCount / totalCells) * 100;
  const l = levelOf(pct);
  if (l.to == null) return null;
  const need = Math.max(1, Math.ceil((l.to / 100) * totalCells) - visitedCount);
  return `до ${l.to}% — ещё ${need} ${need % 10 === 1 && need % 100 !== 11 ? 'место' : need % 10 >= 2 && need % 10 <= 4 && (need % 100 < 10 || need % 100 >= 20) ? 'места' : 'мест'}`;
}

/** Прогресс внутри уровня 0..1 — для полоски. */
export function levelProgress(pct: number): number {
  const l = levelOf(pct);
  if (l.to == null) return 1;
  return Math.max(0, Math.min(1, (pct - l.from) / (l.to - l.from)));
}
