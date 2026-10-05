// Маршрут для карточки события (V6 §4.5): машина с пробками и пешком — TomTom Routing, кэш 10 минут.
// POST { from: {lat, lon}, to: {lat, lon} } → { car: {min, km, delayMin, line} | null, walk: {min, km, line} | null }
// line — путь [[lon, lat], …], не больше 300 точек, — его рисует экран маршрута.
// Ключ — секрет TomTom_KEY. Нет ключа — { car: null, walk: null }, приложение прячет плитки.
import { admin, json, preflight, userFrom } from '../_shared/supabase.ts';

interface Pt { lat: number; lon: number }
const validPoint=(p?:Pt)=>!!p&&Number.isFinite(p.lat)&&Number.isFinite(p.lon)&&Math.abs(p.lat)<=90&&Math.abs(p.lon)<=180;
const r4 = (n: number) => Math.round(n * 1e4) / 1e4; // ~10 м: соседние запросы попадают в кэш

async function tomtom(mode: 'car' | 'pedestrian', a: Pt, b: Pt, key: string) {
  const url = `https://api.tomtom.com/routing/1/calculateRoute/${a.lat},${a.lon}:${b.lat},${b.lon}/json?travelMode=${mode}&traffic=${mode === 'car'}&routeType=fastest&instructionsType=text&language=ru-RU&key=${key}`;
  const res = await fetch(url,{signal:AbortSignal.timeout(10000)}).catch(()=>null);
  if (!res?.ok) return null;
  const route = (await res.json())?.routes?.[0];
  const s = route?.summary;
  if (!s) return null;
  const pts = ((route.legs ?? []) as { points?: { latitude: number; longitude: number }[] }[]).flatMap((l) => l.points ?? []);
  const step = Math.max(1, Math.ceil(pts.length / 300));
  const line = pts.filter((_, i) => i % step === 0 || i === pts.length - 1).map((p) => [Math.round(p.longitude * 1e5) / 1e5, Math.round(p.latitude * 1e5) / 1e5]);
  return { min: Math.max(1, Math.round(s.travelTimeInSeconds / 60)), km: Math.round(s.lengthInMeters / 100) / 10, delayMin: Math.round((s.trafficDelayInSeconds ?? 0) / 60), line, instructions: (route.guidance?.instructions ?? []).map((i: { message: string; point: { latitude: number; longitude: number }; routeOffsetInMeters: number }) => ({ message: i.message, lat: i.point.latitude, lon: i.point.longitude, distance: i.routeOffsetInMeters })) };
}

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  const db = admin();
  if (!(await userFrom(req, db))) return json({ error: 'auth' }, 401);
  const { from, to } = await req.json().catch(() => ({})) as { from?: Pt; to?: Pt };
  if (!from || !to || !validPoint(from) || !validPoint(to)) return json({ error: 'from/to' }, 400);
  const key = Deno.env.get('TomTom_KEY') ?? Deno.env.get('TOMTOM_KEY');
  if (!key) return json({ car: null, walk: null });
  const cacheKey = `v3:${r4(from.lat)},${r4(from.lon)}>${r4(to.lat)},${r4(to.lon)}`;
  const { data: hit } = await db.from('route_cache').select('payload,at').eq('key', cacheKey).maybeSingle();
  if (hit && Date.now() - new Date(hit.at).getTime() < 10 * 60e3) return json(hit.payload);
  const [car, walk] = await Promise.all([tomtom('car', from, to, key), tomtom('pedestrian', from, to, key)]);
  const payload = { car, walk };
  await db.from('route_cache').upsert({ key: cacheKey, payload, at: new Date().toISOString() });
  return json(payload);
});
