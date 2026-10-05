// Чистая логика геолокации альфы (V6.md §3.2, §9): скачки GPS, статусы, клетки «Где я был», подписи «2 мин».
// Покрыта тестами — src/__tests__/geo.test.ts.

export interface Pt { lat: number; lon: number; at: number; accuracy?: number | null; speed?: number | null }

/** Расстояние в метрах. */
export function distM(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const la = (a.lat * Math.PI) / 180;
  const lb = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la) * Math.cos(lb) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Скачок GPS: точность хуже 150 м или «скорость» между точками выше 250 км/ч. Такие точки не рисуем и не шлём. */
export function isJump(prev: Pt | null, next: Pt): boolean {
  if (next.accuracy != null && next.accuracy > 150) return true;
  if (!prev) return false;
  const dt = Math.max(1, (next.at - prev.at) / 1000);
  return distM(prev, next) / dt > 70;
}

export type Place = { kind: 'home' | 'work' | 'study' | 'gym' | 'dacha' | 'other'; lat: number; lon: number };

/** Статус для друзей: в пути (скорость), дома / на работе (из «Моих мест», 150 м), иначе — нет. */
export function statusOf(p: { lat: number; lon: number; speed?: number | null }, places: Place[]): string | null {
  if (p.speed != null && p.speed >= 2.5) return 'moving';
  const near = places.find((x) => distM(x, p) <= 150);
  return near ? near.kind : null;
}

const STATUS_TEXT: Record<string, string> = {
  moving: 'В пути', home: 'Дома', work: 'На работе', study: 'На учёбе', gym: 'В зале', dacha: 'На даче', other: 'В своём месте',
};

/** Подпись под другом: «В пути · 38 км/ч», «Дома», «2 мин», «Давно не в сети». */
export function friendLine(status: string | null, speedKmh: number | undefined, minutesAgo: number): string {
  if (minutesAgo >= 60) return 'Давно не в сети';
  if (status === 'moving' && speedKmh) return `В пути · ${speedKmh} км/ч`;
  if (status && STATUS_TEXT[status]) return STATUS_TEXT[status];
  return minutesAgo < 1 ? 'Сейчас' : `${minutesAgo} мин`;
}

// ——— «Где я был»: клетки ~550 × 400 м по Алматы ———
export const CELL = { lat: 0.005, lon: 0.005 };
export const ALMATY_BOX = { s: 43.15, n: 43.37, w: 76.75, e: 77.1 };

export function cellOf(lat: number, lon: number): string {
  return `${Math.floor(lat / CELL.lat)}:${Math.floor(lon / CELL.lon)}`;
}

export function cellBounds(id: string): [number, number, number, number] {
  const [a, b] = id.split(':').map(Number);
  return [a * CELL.lat, b * CELL.lon, (a + 1) * CELL.lat, (b + 1) * CELL.lon];
}

export const ALMATY_CELLS = Math.round(((ALMATY_BOX.n - ALMATY_BOX.s) / CELL.lat) * ((ALMATY_BOX.e - ALMATY_BOX.w) / CELL.lon));

export function inAlmaty(id: string): boolean {
  const [s, w] = cellBounds(id);
  return s >= ALMATY_BOX.s && s < ALMATY_BOX.n && w >= ALMATY_BOX.w && w < ALMATY_BOX.e;
}

/** Процент открытого города: «2,4 %». */
export function exploredPct(cells: string[]): string {
  const n = cells.filter(inAlmaty).length;
  const pct = (n / ALMATY_CELLS) * 100;
  return `${pct < 10 ? pct.toFixed(1).replace('.', ',') : Math.round(pct)} %`;
}

/** Как часто слать точку: открыто — 4 с, закрыто — 2,5 мин; батарея < 10 % — реже. */
export function sendInterval(foreground: boolean, battery: number | null): number {
  const low = battery != null && battery >= 0 && battery < 0.1;
  if (foreground) return low ? 15000 : 4000;
  return low ? 300000 : 150000;
}

/** Туман «Где я был»: весь город под вуалью, открытые клетки — дырками. GeoJSON Polygon. */
export function fogPolygon(cells: string[]): { type: 'Feature'; properties: Record<string, never>; geometry: { type: 'Polygon'; coordinates: number[][][] } } {
  const pad = 0.3;
  const outer = [[ALMATY_BOX.w - pad, ALMATY_BOX.s - pad], [ALMATY_BOX.e + pad, ALMATY_BOX.s - pad], [ALMATY_BOX.e + pad, ALMATY_BOX.n + pad], [ALMATY_BOX.w - pad, ALMATY_BOX.n + pad], [ALMATY_BOX.w - pad, ALMATY_BOX.s - pad]];
  const holes = [...new Set(cells)].map((id) => {
    const [s, w, n, e] = cellBounds(id);
    return [[w, s], [w, n], [e, n], [e, s], [w, s]];
  });
  return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [outer, ...holes] } };
}

/** Плитки пробок TomTom (Traffic Flow, относительная скорость). Нет ключа — слоя нет. */
export const trafficTiles = (key: string) => (key ? `https://api.tomtom.com/traffic/map/4/tile/flow/relative0/{z}/{x}/{y}.png?key=${key}&tileSize=256` : null);
