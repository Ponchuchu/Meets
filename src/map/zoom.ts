// «Физика» карты: чем дальше камера, тем мельче точки и меньше подписей. Точки в одном месте — одной группой.
import type { EventItem } from '../data/types';

/** Размер пина от масштаба: вдали ~55%, у города 100%, вблизи чуть крупнее. */
export function pinScale(zoom: number): number {
  return Math.max(0.55, Math.min(1.15, 0.55 + (zoom - 11) * 0.19));
}

/** Сколько точек событий рисовать: вдали — самые важные, с приближением — плавно больше (FIX3: без «всё сразу»). */
export function pinBudget(zoom: number): number {
  if (zoom >= 15) return Infinity;
  return Math.round(14 * 2 ** Math.max(0, zoom - 11));
}

export type Detail = 'far' | 'mid' | 'near';

/** far — только иконки; mid — подписи у своих и дружеских событий; near — подписи у всех. */
export function detailOf(zoom: number): Detail {
  if (zoom < 12.6) return 'far';
  if (zoom < 14.6) return 'mid';
  return 'near';
}

export function showPinLabel(detail: Detail, important: boolean): boolean {
  if (detail === 'near') return true;
  return detail === 'mid' && important;
}

/** Масштаб, к которому приближаемся по тапу на точку: не отдаляем, если уже ближе. */
export const focusZoom = (zoom: number) => Math.max(zoom, 15);

/** Группы событий в одной точке (одна площадка: ТРЦ, кинотеатр) — ~15 м. */
export function groupByPoint<T extends Pick<EventItem, 'lat' | 'lon' | 'startsAt'>>(events: T[]): T[][] {
  const groups = new Map<string, T[]>();
  for (const e of events) {
    const key = `${e.lat.toFixed(4)}:${e.lon.toFixed(4)}`;
    groups.set(key, [...(groups.get(key) ?? []), e]);
  }
  return [...groups.values()].map((g) => [...g].sort((a, b) => Date.parse(a.startsAt)-Date.parse(b.startsAt)));
}

/** Сколько градусов широты в `px` пикселях при масштабе `zoom` (тайлы 512 px, как у Mapbox GL). */
export function pxToLat(px: number, zoom: number, lat: number): number {
  const metersPerPx = (78271.517 * Math.cos((lat * Math.PI) / 180)) / 2 ** zoom;
  return (px * metersPerPx) / 111320;
}

/**
 * Подписи без наложений (FIX5, как в Apple Maps): идём от важных к обычным и ставим подпись справа от значка,
 * только если её прямоугольник не задевает уже поставленные подписи и чужие значки (друзей, места, события).
 * Координаты — в пикселях экрана на этом масштабе (Меркатор, тайлы 512 px).
 */
export interface LabelCandidate { id: string; lat: number; lon: number; w: number; h?: number }
export interface Obstacle { lat: number; lon: number; r: number }
export function placeLabels(cands: LabelCandidate[], obstacles: Obstacle[], zoom: number, gap = 4): Set<string> {
  const k = (512 * 2 ** zoom) / 360;
  const px = (lat: number, lon: number) => {
    const y = Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) * (180 / Math.PI);
    return { x: lon * k, y: -y * k };
  };
  const boxes: { x1: number; y1: number; x2: number; y2: number }[] = obstacles.map((o) => {
    const p = px(o.lat, o.lon);
    return { x1: p.x - o.r, y1: p.y - o.r, x2: p.x + o.r, y2: p.y + o.r };
  });
  const hit = (b: { x1: number; y1: number; x2: number; y2: number }, skip?: { x1: number; y1: number; x2: number; y2: number }) =>
    boxes.some((o) => o !== skip && b.x1 < o.x2 + gap && b.x2 + gap > o.x1 && b.y1 < o.y2 + gap && b.y2 + gap > o.y1);
  const out = new Set<string>();
  for (const c of cands) {
    const p = px(c.lat, c.lon);
    const h = c.h ?? 28;
    const own = { x1: p.x - 26, y1: p.y - 26, x2: p.x + 26, y2: p.y + 26 };
    const box = { x1: p.x + 26, y1: p.y - h / 2, x2: p.x + 20 + c.w, y2: p.y + h / 2 };
    // Свой значок — не препятствие для своей подписи.
    const self = boxes.find((o) => Math.abs(o.x1 - own.x1) < 0.5 && Math.abs(o.y1 - own.y1) < 0.5);
    if (hit(box, self)) continue;
    boxes.push(box);
    out.add(c.id);
  }
  return out;
}

/** Подпись времени под значком (FIX5): «идёт», «19:30» (сегодня), другой день — «26.10», у долгих (выставки) — ничего. */
export function pinTime(e: Pick<EventItem, 'startsAt' | 'endsAt' | 'isLong'>, now: Date): { text: string; live: boolean } | null {
  const start = Date.parse(e.startsAt);
  const end = e.endsAt ? Date.parse(e.endsAt) : start + 2 * 3600e3;
  const t = now.getTime();
  if (e.isLong && end - start > 12 * 3600e3) return null;
  if (t >= start && t < end) return { text: 'идёт', live: true };
  const day = (x: number) => Math.floor((x + 5 * 3600e3) / 86400e3);
  const a = new Date(start + 5 * 3600e3);
  const hm = `${String(a.getUTCHours()).padStart(2, '0')}:${String(a.getUTCMinutes()).padStart(2, '0')}`;
  if (day(start) === day(t)) return { text: hm, live: false };
  // Другой день — коротко датой «26.10» (FIX5: без «завтра», маленькой и тихой подписью).
  return { text: `${a.getUTCDate()}.${String(a.getUTCMonth() + 1).padStart(2, '0')}`, live: false };
}
