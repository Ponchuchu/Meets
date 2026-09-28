// Площадки: сначала своя таблица venues (с алиасами «ТРЦ Mega», «Мега Алма-Ата»), потом геокодер.
// Размытый адрес («в парке», «в центре») — флаг needs_pin: точку ставит модератор.
import { normalize, similarity } from './dedupe.ts';
import type { Point } from './types.ts';

export interface VenueRow {
  id: string;
  name: string;
  aliases: string[];
  lat: number | null;
  lon: number | null;
}

export function matchVenue(name: string | null, address: string | null, venues: VenueRow[]): VenueRow | null {
  const probes = [name, address].filter((x): x is string => !!x).map(normalize);
  if (!probes.length) return null;
  let best: { v: VenueRow; s: number } | null = null;
  for (const v of venues) {
    for (const label of [v.name, ...v.aliases]) {
      const l = normalize(label);
      for (const p of probes) {
        const s = p === l ? 1 : p.includes(l) || l.includes(p) ? 0.8 : similarity(p, l);
        if (s >= 0.6 && (!best || s > best.s)) best = { v, s };
      }
    }
  }
  return best?.v ?? null;
}

/** Адрес без улицы и дома — модератору. */
export function isVague(address: string | null): boolean {
  if (!address) return true;
  return !/\d/.test(address) || /в центре|в парке|уточн|по запросу|в лс|в директ/i.test(address);
}

const VIEWBOX = '76.70,43.40,77.20,43.05';
const CENTER = { lat: 43.2389, lon: 76.8897 };
let last = 0;

/** Nominatim (OSM): не чаще раза в секунду, только в рамке Алматы. */
export async function geocode(query: string): Promise<Point | null> {
  const wait = 1100 - (Date.now() - last);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  last = Date.now();
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=kz&accept-language=ru&bounded=1&viewbox=${VIEWBOX}&q=${encodeURIComponent(`${query}, Алматы`)}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'ryadom-worker/0.1 (https://github.com/Ponchuchu/ryadom)' } });
  if (!res.ok) return null;
  const [hit] = (await res.json()) as { lat: string; lon: string }[];
  if (!hit) return null;
  const p = { lat: Number(hit.lat), lon: Number(hit.lon) };
  // Дальше 40 км от центра — не Алматы, промах геокодера.
  const km = Math.hypot((p.lat - CENTER.lat) * 111, (p.lon - CENTER.lon) * 81);
  return km < 40 ? p : null;
}
