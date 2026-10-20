// Чистая логика геолокации альфы (V6.md §3.2, §9): скачки GPS, статусы, клетки «Где я был», подписи «2 мин».
// Покрыта тестами — src/__tests__/geo.test.ts.

export interface Pt { lat: number; lon: number; at: number; accuracy?: number | null; speed?: number | null; heading?: number | null }

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

/** Статус для друзей: в пути (скорость), дома / на работе (из «Моих мест», 150 м), иначе — нет.
 *  Ночью (23:00–07:00 по Алматы, `hour`) дома и без движения — «Спит» (FIX3 Ф10). */
export function statusOf(p: { lat: number; lon: number; speed?: number | null }, places: Place[], hour?: number): string | null {
  if (p.speed != null && p.speed >= 2.5) return 'moving';
  const near = places.find((x) => distM(x, p) <= 150);
  if (near?.kind === 'home' && hour != null && (hour >= 23 || hour < 7) && (p.speed ?? 0) < 0.5) return 'sleep';
  return near ? near.kind : null;
}

const STATUS_TEXT: Record<string, string> = {
  moving: 'В пути', sleep: 'Спит', home: 'Дома', work: 'На работе', study: 'На учёбе', gym: 'В зале', dacha: 'На даче', other: 'В своём месте',
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
export function sendInterval(foreground: boolean, battery: number | null, moving: boolean | null = null): number {
  const low = battery != null && battery >= 0 && battery < 0.1;
  if (foreground) return low ? 15000 : 4000;
  return low ? (moving === false ? 1800000 : 300000) : moving === false ? 900000 : moving === true ? 180000 : 300000;
}

/** Контуры открытых мест: клетки склеены в общие пятна (общие стороны соседей убраны), без внутренних швов.
 *  Кольца в целых координатах сетки [col, row], обход против часовой. */
export function cellOutlines(cells: string[]): [number, number][][] {
  const set = new Set(cells);
  const edges = new Map<string, [number, number, number, number][]>(); // начало → рёбра
  const key = (x: number, y: number) => `${x},${y}`;
  const has = (i: number, j: number) => set.has(`${i}:${j}`);
  for (const id of set) {
    const [i, j] = id.split(':').map(Number);
    // Ребро рисуем, только если с той стороны нет открытой клетки.
    const add = (x1: number, y1: number, x2: number, y2: number) => {
      const k = key(x1, y1);
      const list = edges.get(k) ?? [];
      list.push([x1, y1, x2, y2]);
      edges.set(k, list);
    };
    if (!has(i - 1, j)) add(j, i, j + 1, i);
    if (!has(i, j + 1)) add(j + 1, i, j + 1, i + 1);
    if (!has(i + 1, j)) add(j + 1, i + 1, j, i + 1);
    if (!has(i, j - 1)) add(j, i + 1, j, i);
  }
  const rings: [number, number][][] = [];
  for (const [start, list] of edges) {
    while (list.length) {
      const first = list.pop()!;
      const ring: [number, number][] = [[first[0], first[1]]];
      let [, , x, y] = first;
      let guard = 0;
      while (key(x, y) !== start && guard++ < 100000) {
        ring.push([x, y]);
        const next = edges.get(key(x, y))?.pop();
        if (!next) break;
        [, , x, y] = next;
      }
      rings.push(dropCollinear(ring));
    }
  }
  return rings;
}

function dropCollinear(ring: [number, number][]): [number, number][] {
  const n = ring.length;
  return ring.filter((p, k) => {
    const a = ring[(k - 1 + n) % n], b = ring[(k + 1) % n];
    return (p[0] - a[0]) * (b[1] - p[1]) - (p[1] - a[1]) * (b[0] - p[0]) !== 0;
  });
}

/** Сглаживание Чайкина: углы срезаются, «ступеньки» клеток становятся плавными пятнами. */
export function chaikin(ring: [number, number][], times = 3): [number, number][] {
  let r = ring;
  for (let t = 0; t < times; t++) {
    const out: [number, number][] = [];
    for (let k = 0; k < r.length; k++) {
      const a = r[k], b = r[(k + 1) % r.length];
      out.push([0.75 * a[0] + 0.25 * b[0], 0.75 * a[1] + 0.25 * b[1]], [0.25 * a[0] + 0.75 * b[0], 0.25 * a[1] + 0.75 * b[1]]);
    }
    r = out;
  }
  return r;
}

/** Туман «Где я был» (V6MapLensExplore): весь город под вуалью, открытые места — плавными дырками. GeoJSON Polygon. */
export function fogPolygon(cells: string[]): { type: 'Feature'; properties: Record<string, never>; geometry: { type: 'Polygon'; coordinates: number[][][] } } {
  const pad = 0.3;
  const outer = [[ALMATY_BOX.w - pad, ALMATY_BOX.s - pad], [ALMATY_BOX.e + pad, ALMATY_BOX.s - pad], [ALMATY_BOX.e + pad, ALMATY_BOX.n + pad], [ALMATY_BOX.w - pad, ALMATY_BOX.n + pad], [ALMATY_BOX.w - pad, ALMATY_BOX.s - pad]];
  const holes = cellOutlines([...new Set(cells)]).map((ring) => {
    const pts = chaikin(ring).map(([x, y]) => [Math.round(x * CELL.lon * 1e6) / 1e6, Math.round(y * CELL.lat * 1e6) / 1e6]);
    return [...pts, pts[0]];
  });
  return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [outer, ...holes] } };
}

/** Плитки пробок TomTom (Traffic Flow, относительная скорость). Нет ключа — слоя нет. */
export const trafficTiles = (key: string) => (key ? `https://api.tomtom.com/traffic/map/4/tile/flow/relative0/{z}/{x}/{y}.png?key=${key}&tileSize=256` : null);
