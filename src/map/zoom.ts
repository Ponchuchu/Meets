// «Физика» карты: чем дальше камера, тем мельче точки и меньше подписей. Точки в одном месте — одной группой.
import type { EventItem } from '../data/types';

/** Размер пина от масштаба: вдали ~55%, у города 100%, вблизи чуть крупнее. */
export function pinScale(zoom: number): number {
  return Math.max(0.55, Math.min(1.15, 0.55 + (zoom - 11) * 0.19));
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
