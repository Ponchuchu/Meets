// Площадки: сначала своя таблица venues (с алиасами «ТРЦ Mega», «Мега Алма-Ата»), потом геокодер.
// Размытый адрес («в парке», «в центре») — флаг needs_pin: точку ставит модератор.
import { readFileSync } from 'node:fs';
import { normalize, similarity } from './dedupe.ts';
import type { Point } from './types.ts';
import { ruAddress } from './ruAddress.ts';

export interface VenueRow {
  id: string;
  name: string;
  aliases: string[];
  address?: string | null;
  lat: number | null;
  lon: number | null;
}

export function matchVenue(name: string | null, address: string | null, venues: VenueRow[]): VenueRow | null {
  const probes = [name, address].filter((x): x is string => !!x).map(normalize);
  if (!probes.length) return null;
  let best: { v: VenueRow; s: number } | null = null;
  for (const v of venues) {
    if (address && v.address) {
      const a = splitQuery(address), b = splitQuery(v.address);
      if (a.house && b.house && a.house.toLowerCase() !== b.house.toLowerCase()) continue;
    }
    for (const label of [v.name, ...v.aliases]) {
      const l = normalize(label);
      for (const p of probes) {
        const s = p === l ? 1 : p.includes(l) || l.includes(p) ? 0.9 : similarity(p, l);
        if (s >= 0.85 && (!best || s > best.s)) best = { v, s };
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
const cache = new Map<string, Point | null>();
const inCity = (p: Point) => Math.hypot((p.lat - CENTER.lat) * 111, (p.lon - CENTER.lon) * 81) < 18;
const STREET = /^(ул\.?|улица|пр\.?|пр-т|проспект|мкр\.?|микрорайон|бульвар|б-р|пер\.?|переулок|пл\.?|площадь|шоссе|наб\.?|набережная|к\.?|көш\w*)(\s|$)/i;

/** «Джаз-клуб EverJazz, ул. Жандосова, 1/1, Алматы» → площадка, улица, дом. Чистим «ул.», «к.», лишние точки и опечатки. */
export function splitQuery(q: string): { venue: string | null; street: string | null; house: string | null } {
  const parts = q.replace(/[\u200b]/g, '').split(/,(?![^«]*»)/).map((x) => x.trim()).filter((x) => x && !/^(г\.?\s*)?(алматы|алма-ата)$/i.test(x));
  const at = parts.findIndex((x) => STREET.test(x) || /\d/.test(x));
  const venue = (at < 0 ? parts : parts.slice(0, at)).join(', ') || null;
  const addr = (at < 0 ? [] : parts.slice(at)).join(' ')
    .replace(/\([^)]*\)/g, ' ').replace(/(^|\s)\d+\s*-?\s*(этаж|эт)\.?(?=\s|$)/gi, ' ').replace(/(^|\s)(офис|оф|кв|зал|вход)\.?\s*[^\s,]*/gi, ' ')
    .replace(/Әуезов[^\s,]*/gi, 'Ауэзова').replace(/\.(?=\s|$)/g, ' ').replace(/\s+/g, ' ').trim();
  const house = addr.match(/(?:^|\s)(\d+(?:\s?\/\s?\d+)?\s?[а-яa-z]?)(?=\s|,|$)(?!.*\d)/i)?.[1]?.replace(/\s+/g, '') ?? null;
  const street = addr.replace(house ? new RegExp(`(^|\\s)${house.replace('/', '\\s?/\\s?')}(?=\\s|$)`, 'i') : /$^/, ' ').replace(STREET, '').replace(/\s+(к|көш[^\s]*)\s*$/i, '').replace(/\s+/g, ' ').trim();
  return { venue, street: street || null, house };
}

const houseKey = (s: string) => s.toLowerCase().replace(/\s/g, '');

async function nominatim(params: Record<string, string>, house?: string): Promise<Point | null> {
  const wait = 1100 - (Date.now() - last);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  last = Date.now();
  const qs = new URLSearchParams({ format: 'jsonv2', addressdetails: '1', limit: '1', countrycodes: 'kz', 'accept-language': 'ru', bounded: '1', viewbox: VIEWBOX, ...params });
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${qs}`, { headers: { 'User-Agent': 'ryadom-worker/0.2 (https://github.com/Ponchuchu/ryadom)' }, signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return null;
    const [hit] = (await res.json()) as { lat: string; lon: string; address?: { house_number?: string } }[];
    if (house && houseKey(hit?.address?.house_number ?? '') !== houseKey(house)) return null;
    const p = hit ? { lat: Number(hit.lat), lon: Number(hit.lon) } : null;
    return p && inCity(p) ? p : null; // дальше 18 км от центра — пригород или промах геокодера
  } catch { return null; }
}

/** Mapbox (публичный токен из config/public-keys.json или MAPBOX_TOKEN): берём только уверенные совпадения — «low» у него часто ошибка. */
async function mapbox(q: string, house?: string): Promise<Point | null> {
  let token = process.env.MAPBOX_TOKEN;
  if (!token) { try { token = (JSON.parse(readFileSync(new URL('../../config/public-keys.json', import.meta.url), 'utf8')) as { mapboxPublicToken?: string }).mapboxPublicToken; } catch { /* файла нет */ } }
  if (!token) return null;
  const qs = new URLSearchParams({ q: `${q}, Алматы`, proximity: `${CENTER.lon},${CENTER.lat}`, bbox: '76.70,43.05,77.20,43.40', country: 'kz', language: 'ru', limit: '1', access_token: token });
  try {
    const res = await fetch(`https://api.mapbox.com/search/geocode/v6/forward?${qs}`, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return null;
    const f = ((await res.json()) as { features?: { geometry: { coordinates: [number, number] }; properties: { feature_type?: string; match_code?: { confidence?: string; address_number?: string } } }[] }).features?.[0];
    if (!f || !['exact', 'high', 'medium'].includes(f.properties.match_code?.confidence ?? '')) return null;
    if (house && (f.properties.feature_type !== 'address' || f.properties.match_code?.address_number !== 'matched')) return null;
    const p = { lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0] };
    return inCity(p) ? p : null;
  } catch { return null; }
}

/**
 * Свой справочник адресов Алматы (public.addresses: OpenStreetMap + Overture, docs/MAP-DATA.md):
 * «Жандосов көшесі 1/1» и «ул. Жандосова, 1/1» находят одну точку. Только уверенное совпадение с тем же домом.
 */
async function registry(street: string, house: string): Promise<Point | null> {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  try {
    const h: Record<string, string> = { apikey: key, 'Content-Type': 'application/json' };
    if (key.split('.').length === 3) h.Authorization = `Bearer ${key}`;
    const r = await fetch(`${url}/rest/v1/rpc/match_address`, { method: 'POST', headers: h, body: JSON.stringify({ q: `${street} ${house}` }) });
    if (!r.ok) return null;
    const [m] = await r.json() as { lat: number; lon: number }[];
    return m && Number.isFinite(m.lat) && Number.isFinite(m.lon) ? { lat: m.lat, lon: m.lon } : null;
  } catch { return null; }
}

/**
 * Координаты события. 0) свой справочник адресов, 1) улица + дом в OpenStreetMap, 2) название площадки,
 * 3) Mapbox, только уверенные совпадения. Результаты запоминаем: одна площадка — один запрос.
 */
export async function geocode(raw: string): Promise<Point | null> {
  const query = ruAddress(raw);
  const key = query.toLowerCase().replace(/\s+/g, ' ').trim();
  if (cache.has(key)) return cache.get(key) ?? null;
  const { venue, street, house } = splitQuery(query);
  let p: Point | null = street && house ? await registry(street, house) : null;
  if (!p && street && house) p = await nominatim({ street: `${house} ${street}`, city: 'Алматы' }, house);
  // Если указан дом, не подменяем его точкой улицы или приблизительным совпадением площадки.
  if (!p && venue && !house) p = await nominatim({ q: `${venue} Алматы` });
  if (!p) p = await mapbox([venue, street && `${street} ${house ?? ''}`.trim()].filter(Boolean).join(', ') || query, house ?? undefined);
  cache.set(key, p);
  return p;
}
