// Маршрут для карточки события (V6 §4.5): машина с пробками и пешком — TomTom Routing, кэш 10 минут.
// POST { from: {lat, lon}, to: {lat, lon} } → { car: {min, km, delayMin} | null, walk: {min, km} | null }
// Ключ — секрет TomTom_KEY. Нет ключа — { car: null, walk: null }, приложение прячет плитки.
import { admin, json, userFrom } from '../_shared/supabase.ts';

interface Pt { lat: number; lon: number }
const r4 = (n: number) => Math.round(n * 1e4) / 1e4; // ~10 м: соседние запросы попадают в кэш

async function tomtom(mode: 'car' | 'pedestrian', a: Pt, b: Pt, key: string) {
  const url = `https://api.tomtom.com/routing/1/calculateRoute/${a.lat},${a.lon}:${b.lat},${b.lon}/json?travelMode=${mode}&traffic=${mode === 'car'}&routeType=fastest&key=${key}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const s = (await res.json())?.routes?.[0]?.summary;
  if (!s) return null;
  return { min: Math.max(1, Math.round(s.travelTimeInSeconds / 60)), km: Math.round(s.lengthInMeters / 100) / 10, delayMin: Math.round((s.trafficDelayInSeconds ?? 0) / 60) };
}

Deno.serve(async (req) => {
  const db = admin();
  if (!(await userFrom(req, db))) return json({ error: 'auth' }, 401);
  const { from, to } = await req.json().catch(() => ({})) as { from?: Pt; to?: Pt };
  if (!from || !to) return json({ error: 'from/to' }, 400);
  const key = Deno.env.get('TomTom_KEY') ?? Deno.env.get('TOMTOM_KEY');
  if (!key) return json({ car: null, walk: null });
  const cacheKey = `${r4(from.lat)},${r4(from.lon)}>${r4(to.lat)},${r4(to.lon)}`;
  const { data: hit } = await db.from('route_cache').select('payload,at').eq('key', cacheKey).maybeSingle();
  if (hit && Date.now() - new Date(hit.at).getTime() < 10 * 60e3) return json(hit.payload);
  const [car, walk] = await Promise.all([tomtom('car', from, to, key), tomtom('pedestrian', from, to, key)]);
  const payload = { car, walk: walk && walk.km <= 8 ? { min: walk.min, km: walk.km } : null };
  await db.from('route_cache').upsert({ key: cacheKey, payload, at: new Date().toISOString() });
  return json(payload);
});
