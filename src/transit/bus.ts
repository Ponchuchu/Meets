// Время на автобусе «примерно» — без расписаний и чужих сервисов (docs/V6.md §4.5).
// Время = пешком до остановки + ожидание + поездка (с поправкой на пробки) + остановки + пешком от остановки.

export interface LatLon { lat: number; lon: number }
export interface BusStop extends LatLon { id: string; name: string }
/** Маршрут в одну сторону: остановки по порядку. */
export interface BusDirection { ref: string; stops: BusStop[] }

export interface BusEstimate {
  ref: string;
  /** Минуты по частям — для строк «4 мин пешком», «Автобус 63 · ~6 мин ждать», «3 мин пешком». */
  walkTo: number; wait: number; ride: number; walkFrom: number;
  total: number;
  board: BusStop; alight: BusStop; stopsCount: number;
}

const WALK_M_PER_MIN = 75; // 4,5 км/ч
const WALK_DETOUR = 1.2; // улицы не по прямой
const ROAD_DETOUR = 1.25; // автобус едет по дорогам, а не между остановками по прямой
const STOP_MIN = 0.3; // ~20 с на каждую остановку
export const MAX_WALK_M = 700;

/** Час по Алматы (UTC+5). */
export function almatyHour(at: Date): number {
  return (at.getUTCHours() + 5) % 24;
}

/** Интервал в минутах по времени суток. null — автобусы не ходят (23:00–6:00). */
export function intervalMin(at: Date): number | null {
  const h = almatyHour(at);
  if (h >= 23 || h < 6) return null;
  if ((h >= 7 && h < 10) || (h >= 17 && h < 20)) return 10;
  if (h >= 20) return 20;
  return 12;
}

/** Ходят ли автобусы сейчас и с какого часа начнут (6:00–23:00 по Алматы). */
export function busService(at: Date): { running: boolean; startsAt: string } {
  return { running: intervalMin(at) != null, startsAt: '06:00' };
}

/** Средняя скорость автобуса, км/ч: в час пик медленнее. */
export function busSpeedKmh(at: Date): number {
  const h = almatyHour(at);
  if ((h >= 7 && h < 10) || (h >= 17 && h < 20)) return 15;
  if (h >= 20 || h < 7) return 21;
  return 18;
}

export function distanceM(a: LatLon, b: LatLon): number {
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLon = (b.lon - a.lon) * rad;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export function walkMin(m: number): number {
  return Math.max(1, Math.round((m * WALK_DETOUR) / WALK_M_PER_MIN));
}

export interface TripParts {
  walkToM: number; walkFromM: number; rideM: number; stopsCount: number; at: Date;
  /** Во сколько раз пробки замедляют дорогу на этом участке (TomTom). 1 — свободно. */
  traffic?: number;
  /** Настоящее ожидание, если известно (Bustime «через 4 мин»). */
  waitMin?: number;
}

/** Минуты по частям или null, если автобусы сейчас не ходят. */
export function estimateParts(p: TripParts): Omit<BusEstimate, 'ref' | 'board' | 'alight' | 'stopsCount'> | null {
  const interval = intervalMin(p.at);
  if (interval === null) return null;
  const walkTo = walkMin(p.walkToM);
  const walkFrom = walkMin(p.walkFromM);
  const wait = Math.round(p.waitMin ?? interval / 2);
  const ride = Math.round(((p.rideM / 1000) / busSpeedKmh(p.at)) * 60 * Math.max(1, p.traffic ?? 1) + STOP_MIN * p.stopsCount);
  return { walkTo, wait, ride, walkFrom, total: walkTo + wait + ride + walkFrom };
}

/** Лучший автобус без пересадки от точки до точки. null — нет маршрута с остановками ближе 700 м с обеих сторон. */
export function bestDirectBus(dirs: BusDirection[], from: LatLon, to: LatLon, at: Date, traffic = 1): BusEstimate | null {
  let best: BusEstimate | null = null;
  for (const d of dirs) {
    const near = (p: LatLon) => d.stops.map((s, i) => ({ i, m: distanceM(p, s) })).filter((x) => x.m <= MAX_WALK_M);
    const boards = near(from);
    const alights = near(to);
    for (const b of boards) {
      for (const a of alights) {
        if (a.i <= b.i) continue;
        let rideM = 0;
        for (let k = b.i; k < a.i; k++) rideM += distanceM(d.stops[k], d.stops[k + 1]) * ROAD_DETOUR;
        const parts = estimateParts({ walkToM: b.m, walkFromM: a.m, rideM, stopsCount: a.i - b.i, at, traffic });
        if (!parts) return null;
        if (!best || parts.total < best.total) {
          best = { ref: d.ref, ...parts, board: d.stops[b.i], alight: d.stops[a.i], stopsCount: a.i - b.i };
        }
      }
    }
  }
  return best;
}
