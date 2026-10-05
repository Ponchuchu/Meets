import { config } from '../lib/config';

export interface AddressHit { id: string; label: string; lat: number; lon: number }

/** Поиск Mapbox с ограничением Алматы. Nominatim не используется для автодополнения. */
export async function searchAddresses(q: string, signal?: AbortSignal): Promise<AddressHit[]> {
  if (q.trim().length < 3) return [];
  const params = new URLSearchParams({ access_token: config.mapboxToken, country: 'kz', language: 'ru', limit: '5', proximity: '76.9458,43.2579', bbox: '76.70,43.05,77.20,43.40', types: 'address,poi', autocomplete: 'true' });
  const r = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q.trim())}.json?${params}`, { signal });
  if (!r.ok) throw new Error('Не удалось найти адрес. Выбери точку на карте');
  const j = await r.json() as { features?: { id: string; place_name: string; center: [number, number] }[] };
  return (j.features ?? []).filter((f) => Number.isFinite(f.center?.[0]) && Number.isFinite(f.center?.[1])).map((f) => ({ id: f.id, label: f.place_name, lon: f.center[0], lat: f.center[1] }));
}
