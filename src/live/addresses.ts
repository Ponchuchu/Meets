import { supabase } from '../data/client';
import { config } from '../lib/config';
import { ruAddress } from '../lib/ruAddress';

export interface AddressHit { id: string; label: string; lat: number; lon: number }

/** Mapbox по-русски называет город «Алма-Ата» — у нас везде «Алматы». */
export const cityFix = (s: string): string => ruAddress(s.replace(/Алма[-\s]?Ата/gi, 'Алматы').replace(/,\s*Казахстан\s*$/i, ''));

const BBOX = '76.70,43.05,77.20,43.40';
const dist = (a: { lat: number; lon: number }, b: { lat: number; lon: number }) =>
  Math.hypot((a.lat - b.lat) * 111_000, (a.lon - b.lon) * 81_000);

interface MapboxFeature { id: string; text?: string; address?: string; place_name: string; center: [number, number]; place_type?: string[]; properties?: { address?: string } }

/** Подпись из ответа Mapbox: «Есенова 160» или «Название, адрес» — без города, индекса и страны. */
export function mapboxLabel(f: MapboxFeature): string {
  const isAddress = f.place_type?.includes('address');
  if (f.text && isAddress) return cityFix(`${f.text}${f.address ? ` ${f.address}` : ''}`);
  if (f.text) return cityFix(f.properties?.address ? `${f.text}, ${f.properties.address}` : f.text);
  return cityFix(f.place_name).split(',').slice(0, 2).join(',').trim();
}

interface OsmItem { place_id: number; lat: string; lon: string; name?: string; display_name: string; address?: { road?: string; pedestrian?: string; house_number?: string; neighbourhood?: string; suburb?: string } }

/** Подпись из ответа OpenStreetMap: «Название, улица дом». */
export function osmLabel(i: OsmItem): string {
  const a = i.address ?? {};
  const street = [a.road ?? a.pedestrian, a.house_number].filter(Boolean).join(' ');
  const name = i.name && i.name !== a.road && i.name !== a.house_number ? i.name : '';
  const label = [name, street].filter(Boolean).join(', ');
  return cityFix(label || i.display_name.split(',').slice(0, 2).join(','));
}

async function mapbox(q: string, signal?: AbortSignal): Promise<AddressHit[]> {
  const params = new URLSearchParams({ access_token: config.mapboxToken, country: 'kz', language: 'ru', limit: '5', proximity: '76.9458,43.2579', bbox: BBOX, types: 'address,poi', autocomplete: 'true' });
  const r = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?${params}`, { signal });
  if (!r.ok) throw new Error('mapbox');
  const j = await r.json() as { features?: MapboxFeature[] };
  return (j.features ?? []).filter((f) => Number.isFinite(f.center?.[0]) && Number.isFinite(f.center?.[1]))
    .map((f) => ({ id: `mb-${f.id}`, label: mapboxLabel(f), lon: f.center[0], lat: f.center[1] }));
}

/** OpenStreetMap знает дома Алматы лучше Mapbox: берём его как второй источник. */
async function osm(q: string, signal?: AbortSignal): Promise<AddressHit[]> {
  const params = new URLSearchParams({ format: 'jsonv2', addressdetails: '1', limit: '6', 'accept-language': 'ru', countrycodes: 'kz', bounded: '1', viewbox: '76.70,43.40,77.20,43.05', q: /алматы|алма-ата/i.test(q) ? q : `${q}, Алматы` });
  const r = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, { signal, headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error('osm');
  const j = await r.json() as OsmItem[];
  return j.map((i) => ({ id: `osm-${i.place_id}`, label: osmLabel(i), lat: Number(i.lat), lon: Number(i.lon) })).filter((h) => Number.isFinite(h.lat) && Number.isFinite(h.lon));
}

/** Склейка двух источников: Mapbox первым, дубли (одно место ближе 60 м или та же подпись) выбрасываем. */
export function mergeHits(...lists: AddressHit[][]): AddressHit[] {
  const out: AddressHit[] = [];
  for (const h of lists.flat()) {
    if (!h.label.trim()) continue;
    if (out.some((o) => o.label.toLowerCase() === h.label.toLowerCase() || dist(o, h) < 60)) continue;
    out.push(h);
  }
  return out.slice(0, 7);
}

async function knownVenues(q: string, signal?: AbortSignal): Promise<AddressHit[]> {
  const requests = ['name', 'address'].map(field => supabase().from('venues_points').select('id,name,address,lat,lon').ilike(field, `%${q.replace(/[%_]/g, '')}%`).not('lat', 'is', null).limit(5));
  if (signal) requests.forEach(r => r.abortSignal(signal));
  const results = await Promise.all(requests);
  return results.flatMap(r => (r.data ?? []).map(v => ({ id: `venue-${v.id}`, label: [v.name, v.address].filter(Boolean).join(', '), lat: Number(v.lat), lon: Number(v.lon) }))).filter(v => Number.isFinite(v.lat) && Number.isFinite(v.lon));
}

type Row = { label: string; lat: number; lon: number };
type PlaceRow = { id: string; name: string; address: string | null; lat: number; lon: number };

/** Свой справочник адресов Алматы (OpenStreetMap + Overture, docs/MAP-DATA.md): «Жандосов көшесі 1/1» = «ул. Жандосова, 1/1». */
async function registry(q: string, near?: { lat: number; lon: number }, signal?: AbortSignal): Promise<AddressHit[]> {
  const r = supabase().rpc('suggest_address', { q, near_lat: near?.lat ?? null, near_lon: near?.lon ?? null, lim: 5 });
  if (signal) r.abortSignal(signal);
  const { data, error } = await r;
  if (error) throw error;
  return ((data ?? []) as Row[]).map((a) => ({ id: `addr-${a.label}`, label: a.label, lat: a.lat, lon: a.lon }));
}

/** Места из Overture по названию: «Есентай», «Кофеманию на Абая». */
async function places(q: string, signal?: AbortSignal): Promise<AddressHit[]> {
  const r = supabase().rpc('search_places', { q, lim: 4 });
  if (signal) r.abortSignal(signal);
  const { data, error } = await r;
  if (error) throw error;
  return ((data ?? []) as PlaceRow[]).map((p) => ({ id: `place-${p.id}`, label: [p.name, p.address].filter(Boolean).join(', '), lat: p.lat, lon: p.lon }));
}

/**
 * Поиск адреса в Алматы: свой справочник и места первыми, затем Mapbox и OpenStreetMap — всё параллельно.
 * Ошибка — только если не ответил ни один источник.
 */
export async function searchAddresses(q: string, signal?: AbortSignal, near?: { lat: number; lon: number }): Promise<AddressHit[]> {
  const text = q.trim();
  if (text.length < 3) return [];
  const all = await Promise.allSettled([registry(text, near, signal), places(text, signal), knownVenues(text, signal), mapbox(text, signal), osm(text, signal)]);
  const ok = all.map((x) => (x.status === 'fulfilled' ? x.value : null));
  if (all.every((x) => x.status === 'rejected')) throw new Error('Не удалось найти адрес. Выбери точку на карте');
  return mergeHits(...ok.map((x) => x ?? []));
}

/** Адрес под точкой карты: ближайший дом из своего справочника (до 60 м), иначе null. */
export async function nearestAddress(lat: number, lon: number): Promise<string | null> {
  const { data } = await supabase().rpc('nearest_address', { lat, lon });
  return ((data ?? []) as { label: string }[])[0]?.label ?? null;
}
