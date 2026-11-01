import type { MapSymbol } from './symbols';
import { colors } from '../theme';

export const CLUSTER_PALETTE = { fill: '#FFF6EA', stroke: colors.accent, text: colors.ink } as const;

/** Cluster rendered icons, never attendance/session counts or private/friend markers. */
export function clusterMapSymbols(input: MapSymbol[], zoom: number) {
  const symbols = input.filter(s => Number.isFinite(s.lat) && Number.isFinite(s.lon) && Math.abs(s.lat) <= 90 && Math.abs(s.lon) <= 180)
    .slice().sort((a, b) => b.sort - a.sort || a.id.localeCompare(b.id));
  const z = Number.isFinite(zoom) ? Math.max(0, Math.min(22, Math.round(zoom * 2) / 2)) : 13.5;
  const world = 512 * 2 ** z;
  const radius = Math.max(34, Math.min(64, symbols.reduce((max, s) => Math.max(max, s.size + 4), 0)));
  const columns = Math.max(1, Math.floor(world / radius));
  const cell = world / columns;
  const points = symbols.map(s => {
    const lat = Math.max(-85.05112878, Math.min(85.05112878, s.lat));
    const sin = Math.sin(lat * Math.PI / 180);
    return { x: ((s.lon + 180) % 360) / 360 * world, y: Math.max(0, Math.min(world, (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * world)) };
  });
  // Fixed anchors avoid transitive chains swallowing a whole street into one distant cluster.
  const groups: number[][] = [];
  const buckets = new Map<string, number[]>();
  for (let i = 0; i < points.length; i++) {
    const p = points[i], x = Math.floor(p.x / cell), y = Math.floor(p.y / cell);
    let best: number | undefined;
    let nearest = radius;
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      for (const groupIndex of buckets.get(`${(x + dx + columns) % columns}:${y + dy}`) ?? []) {
        const q = points[groups[groupIndex][0]];
        const delta = Math.abs(p.x - q.x);
        const distance = Math.hypot(Math.min(delta, world - delta), p.y - q.y);
        if (distance <= nearest) { nearest = distance; best = groupIndex; }
      }
    }
    if (best != null) { groups[best].push(i); continue; }
    const groupIndex = groups.length;
    groups.push([i]);
    const key = `${x}:${y}`;
    const bucket = buckets.get(key);
    if (bucket) bucket.push(groupIndex); else buckets.set(key, [groupIndex]);
  }
  const members = new Map<string, MapSymbol[]>();
  const shown: MapSymbol[] = [];
  for (const indices of groups) {
    if (indices.length === 1) { shown.push({ ...symbols[indices[0]], count: 1 }); continue; }
    const group = indices.map(i => symbols[i]);
    const reference = points[indices[0]].x;
    let x = 0, y = 0;
    for (const i of indices) {
      let delta = points[i].x - reference;
      if (delta > world / 2) delta -= world;
      if (delta < -world / 2) delta += world;
      x += reference + delta; y += points[i].y;
    }
    x = ((x / indices.length) % world + world) % world; y /= indices.length;
    const id = `cluster:${group.map(s => s.id).sort().join('|')}`;
    members.set(id, group);
    const first = group.reduce((a, b) => b.sort > a.sort ? b : a);
    shown.push({ ...first, id, lon: x / world * 360 - 180, lat: Math.atan(Math.sinh(Math.PI * (1 - 2 * y / world))) * 180 / Math.PI,
      count: group.length, eventCount: group.reduce((n, s) => n + (s.eventCount ?? 0), 0), dot: CLUSTER_PALETTE.fill, text: '', label: `Места и события рядом: ${group.length}` });
  }
  return { symbols: shown, members };
}

/** Friend position frames must not invalidate static icon clustering. */
export function sameMapSymbols(a: MapSymbol[], b: MapSymbol[]) {
  return a.length === b.length && a.every((s, i) => {
    const t = b[i];
    return s.id === t.id && s.lat === t.lat && s.lon === t.lon && s.icon === t.icon && s.size === t.size && s.sort === t.sort
      && s.dot === t.dot && s.count === t.count && s.eventCount === t.eventCount && s.text === t.text && s.label === t.label
      && s.textColor === t.textColor && s.halo === t.halo && s.faded === t.faded;
  });
}
