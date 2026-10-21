// Маршрут на общественном транспорте с пересадками (FIX3): автобусы + метро, до 3 пересадок, пешком до 700 м
// к первой остановке и от последней, пересадка пешком до 400 м. Без расписаний: ожидание — половина интервала,
// поездка — по расстоянию и скорости (в час пик медленнее). Алгоритм — раунды как в RAPTOR: раунд = ещё одна посадка.
import { busSpeedKmh, distanceM, intervalMin, walkMin, type BusDirection, type BusStop, type LatLon } from './bus';

export type Mode = 'bus' | 'metro';
export interface Line { id: string; ref: string; mode: Mode; stops: BusStop[] }
export interface Leg {
  kind: 'walk' | 'ride'; minutes: number;
  /** Для поездки: номер, вид, где сесть и выйти, сколько остановок, ожидание. */
  ref?: string; mode?: Mode; from?: BusStop; to?: BusStop; stops?: number; wait?: number;
  path: [number, number][];
  metres?: number;
}
export interface TransitOption { legs: Leg[]; total: number; transfers: number; walkMin: number; tag?: 'fast' | 'simple' | 'walk' }

const ACCESS_M = 700, TRANSFER_M = 400, ROAD_DETOUR = 1.25, STOP_MIN = 0.3, TRANSFER_PENALTY = 3;
const METRO_KMH = 36;

export function metroInterval(at: Date): number | null {
  const h = (at.getUTCHours() + 5) % 24;
  if (h < 6) return null;
  return h >= 21 ? 12 : 7;
}

export function buildLines(dirs: BusDirection[], metro: BusStop[]): Line[] {
  const lines: Line[] = dirs.filter(d => d.stops.length >= 2).map((d, i) => ({ id: `b${i}`, ref: d.ref, mode: 'bus', stops: d.stops }));
  if (metro.length >= 2) {
    lines.push({ id: 'm1', ref: 'М', mode: 'metro', stops: metro });
    lines.push({ id: 'm2', ref: 'М', mode: 'metro', stops: [...metro].reverse() });
  }
  return lines;
}

interface Label { t: number; parent?: { kind: 'walk' | 'ride'; from: string; line?: Line; i?: number; j?: number; wait?: number; metres?: number } }

/** Варианты пути: самый быстрый, с меньшим числом пересадок и с меньшей ходьбой — без повторов. */
export function planTransit(lines: Line[], from: LatLon, to: LatLon, at: Date, maxTransfers = 3): TransitOption[] {
  const busWait = intervalMin(at), metroWait = metroInterval(at);
  const stopById = new Map<string, BusStop>();
  const lineAt = new Map<string, { line: Line; i: number }[]>();
  for (const l of lines) l.stops.forEach((s, i) => { stopById.set(s.id, s); const a = lineAt.get(s.id) ?? []; a.push({ line: l, i }); lineAt.set(s.id, a); });
  const all = [...stopById.values()];
  // Сетка ~400 м для поиска соседних остановок.
  const cell = (p: LatLon) => `${Math.floor(p.lat / 0.0036)}:${Math.floor(p.lon / 0.005)}`;
  const grid = new Map<string, BusStop[]>();
  for (const s of all) { const k = cell(s); const a = grid.get(k) ?? []; a.push(s); grid.set(k, a); }
  const near = (p: LatLon, r: number) => {
    const [a, b] = cell(p).split(':').map(Number);
    const out: { s: BusStop; m: number }[] = [];
    const span = Math.ceil(r / 350);
    for (let x = -span; x <= span; x++) for (let y = -span; y <= span; y++) for (const s of grid.get(`${a + x}:${b + y}`) ?? []) { const m = distanceM(p, s); if (m <= r) out.push({ s, m }); }
    return out;
  };
  const rideMin = (l: Line, i: number, j: number) => {
    let m = 0;
    for (let k = i; k < j; k++) m += distanceM(l.stops[k], l.stops[k + 1]) * (l.mode === 'bus' ? ROAD_DETOUR : 1.05);
    const kmh = l.mode === 'metro' ? METRO_KMH : busSpeedKmh(at);
    return (m / 1000 / kmh) * 60 + STOP_MIN * (j - i);
  };
  const waitFor = (l: Line) => { const w = l.mode === 'metro' ? metroWait : busWait; return w == null ? null : w / 2; };

  // rounds[k] — лучшее время прибытия к остановке после k посадок (минуты от старта).
  const rounds: Map<string, Label>[] = [new Map()];
  for (const { s, m } of near(from, ACCESS_M)) rounds[0].set(s.id, { t: walkMin(m), parent: { kind: 'walk', from: 'origin', metres: m } });
  const best = new Map<string, number>();
  for (const [id, l] of rounds[0]) best.set(id, l.t);
  for (let k = 1; k <= maxTransfers + 1; k++) {
    const prev = rounds[k - 1];
    const cur = new Map<string, Label>();
    const marked = [...prev.keys()];
    // Поездки: от каждой отмеченной остановки — по всем линиям через неё, дальше по ходу.
    for (const id of marked) {
      const base = prev.get(id)!;
      for (const { line, i } of lineAt.get(id) ?? []) {
        const wait = waitFor(line);
        if (wait == null) continue;
        const pen = k > 1 ? TRANSFER_PENALTY : 0;
        for (let j = i + 1; j < line.stops.length; j++) {
          const t = base.t + wait + pen + rideMin(line, i, j);
          const sid = line.stops[j].id;
          if (t < (best.get(sid) ?? Infinity) && t < (cur.get(sid)?.t ?? Infinity)) cur.set(sid, { t, parent: { kind: 'ride', from: id, line, i, j, wait } });
        }
      }
    }
    // Пересадки пешком к соседним остановкам.
    for (const [id, l] of [...cur]) {
      for (const { s, m } of near(stopById.get(id)!, TRANSFER_M)) {
        if (s.id === id) continue;
        const t = l.t + walkMin(m);
        if (t < (cur.get(s.id)?.t ?? Infinity) && t < (best.get(s.id) ?? Infinity)) cur.set(s.id, { t, parent: { kind: 'walk', from: id, metres: m } });
      }
    }
    for (const [id, l] of cur) if (l.t < (best.get(id) ?? Infinity)) best.set(id, l.t);
    rounds.push(cur);
    if (!cur.size) break;
  }

  // Конец пути: для каждого раунда — лучшая остановка выхода + пешком до цели.
  const egress = near(to, ACCESS_M);
  const options: TransitOption[] = [];
  for (let k = 1; k < rounds.length; k++) {
    let pick: { id: string; total: number; m: number } | null = null;
    for (const { s, m } of egress) {
      const l = rounds[k].get(s.id);
      if (!l || l.parent?.kind !== 'ride' && l.parent?.kind !== 'walk') continue;
      const total = l.t + walkMin(m);
      if (!pick || total < pick.total) pick = { id: s.id, total, m };
    }
    if (!pick) continue;
    const legs = unwind(rounds, k, pick.id, stopById, from);
    if (!legs) continue;
    const last = stopById.get(pick.id)!;
    legs.push({ kind: 'walk', minutes: walkMin(pick.m), metres: pick.m, path: [[last.lon, last.lat], [to.lon, to.lat]] });
    const rides = legs.filter(l => l.kind === 'ride').length;
    const walk = legs.filter(l => l.kind === 'walk').reduce((a, l) => a + l.minutes, 0);
    options.push({ legs: mergeWalks(legs), total: Math.round(pick.total), transfers: Math.max(0, rides - 1), walkMin: walk });
  }
  return chooseOptions(options);
}

function unwind(rounds: Map<string, Label>[], k: number, id: string, stops: Map<string, BusStop>, origin: LatLon): Leg[] | null {
  const legs: Leg[] = [];
  let round = k, cur = id, guard = 0;
  while (guard++ < 40) {
    const l = rounds[round]?.get(cur);
    if (!l?.parent) return null;
    const p = l.parent;
    const here = stops.get(cur)!;
    if (p.from === 'origin') { legs.unshift({ kind: 'walk', minutes: walkMin(p.metres ?? 0), metres: p.metres, path: [[origin.lon, origin.lat], [here.lon, here.lat]] }); return legs; }
    const there = stops.get(p.from)!;
    if (p.kind === 'walk') {
      legs.unshift({ kind: 'walk', minutes: walkMin(p.metres ?? 0), metres: p.metres, path: [[there.lon, there.lat], [here.lon, here.lat]] });
    } else {
      const line = p.line!, i = p.i!, j = p.j!;
      const seg = line.stops.slice(i, j + 1);
      const total = l.t - (rounds[round - 1].get(p.from)?.t ?? 0);
      legs.unshift({ kind: 'ride', ref: line.ref, mode: line.mode, from: line.stops[i], to: line.stops[j], stops: j - i, wait: Math.round(p.wait ?? 0), minutes: Math.max(1, Math.round(total)), path: seg.map(s => [s.lon, s.lat] as [number, number]) });
      round--;
    }
    cur = p.from;
  }
  return null;
}

function mergeWalks(legs: Leg[]): Leg[] {
  const out: Leg[] = [];
  for (const l of legs) {
    const prev = out[out.length - 1];
    if (prev && prev.kind === 'walk' && l.kind === 'walk') { prev.minutes += l.minutes; prev.metres = (prev.metres ?? 0) + (l.metres ?? 0); prev.path = [...prev.path, ...l.path.slice(1)]; }
    else out.push({ ...l, path: [...l.path] });
  }
  return out.filter(l => l.kind === 'ride' || l.minutes > 0);
}

/** До трёх вариантов: быстрый, проще (меньше пересадок), меньше ходьбы. Медленнее быстрого больше чем вдвое — не предлагаем. */
export function chooseOptions(list: TransitOption[]): TransitOption[] {
  if (!list.length) return [];
  const fast = [...list].sort((a, b) => a.total - b.total)[0];
  const ok = list.filter(o => o.total <= fast.total * 2 + 5);
  const simple = [...ok].sort((a, b) => a.transfers - b.transfers || a.total - b.total)[0];
  const walk = [...ok].sort((a, b) => a.walkMin - b.walkMin || a.total - b.total)[0];
  const out: TransitOption[] = [{ ...fast, tag: 'fast' }];
  const key = (o: TransitOption) => o.legs.map(l => `${l.kind}:${l.ref ?? ''}:${l.from?.id ?? ''}`).join('|');
  if (key(simple) !== key(fast)) out.push({ ...simple, tag: 'simple' });
  if (!out.some(o => key(o) === key(walk))) out.push({ ...walk, tag: 'walk' });
  return out;
}
