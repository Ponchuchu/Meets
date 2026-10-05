// Геокодирование адресов событий (FIX1 И2 п.8): сначала Nominatim (OSM — дома Алматы знает точно),
// потом Mapbox Geocoding v6 (country=kz, рядом с Алматы, по-русски) — только точное совпадение адреса.
// POST { event_id } — одно событие (зовёт панель после «Опубликовать»), { all: true } — все одобренные и черновики
// с неточной точкой. Только для команды (staff) или по секрету расписания.
// Нашлось точно (дом или место, ≤ 40 км от центра) — точка площадки, geo_source = 'osm' / 'mapbox', needs_pin снимается.
// Точки, поставленные руками (manual) или из проверенного списка (seed), не трогаем.
// Не нашлось — needs_pin = true и флаг события needs_pin: точку ставит разработчик в правке события.
import { admin, isServiceCall, json, preflight, userFrom } from '../_shared/supabase.ts';

const CENTER = { lat: 43.2389, lon: 76.8897 };
interface Hit { lat: number; lon: number; src: 'osm' | 'mapbox' }

const near = (lat: number, lon: number) => Math.hypot((lat - CENTER.lat) * 111, (lon - CENTER.lon) * 81) < 40;
let lastOsm = 0;

/** Nominatim: не чаще раза в секунду, в рамке Алматы; принимаем дом или объект (place_rank ≥ 28), не улицу целиком. */
async function osm(q: string): Promise<Hit | null> {
  const wait = 1100 - (Date.now() - lastOsm);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastOsm = Date.now();
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=kz&accept-language=ru&bounded=1&viewbox=76.70,43.40,77.20,43.05&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'ryadom-geocode/0.1 (https://github.com/Ponchuchu/ryadom)' } });
  if (!res.ok) return null;
  const [h] = (await res.json()) as { lat: string; lon: string; place_rank: number }[];
  if (!h || h.place_rank < 28) return null;
  const lat = Number(h.lat), lon = Number(h.lon);
  return near(lat, lon) ? { lat, lon, src: 'osm' } : null;
}

/** Mapbox: только адрес с точным совпадением дома (в Алматы у Mapbox много промахов «в центр города»). */
async function mapbox(q: string, token: string): Promise<Hit | null> {
  const url = `https://api.mapbox.com/search/geocode/v6/forward?q=${encodeURIComponent(q)}&country=kz&proximity=${CENTER.lon},${CENTER.lat}&language=ru&limit=1&access_token=${token}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const f = (await res.json())?.features?.[0];
  const m = f?.properties?.match_code;
  if (!f || f.properties?.feature_type !== 'address' || m?.confidence !== 'exact' || m?.address_number !== 'matched') return null;
  const [lon, lat] = f.geometry.coordinates as [number, number];
  return near(lat, lon) ? { lat, lon, src: 'mapbox' } : null;
}

async function find(address: string | null, name: string | null, token: string | undefined): Promise<Hit | null> {
  if (!vague(address)) {
    const hit = await osm(`${address}, Алматы`) ?? (token ? await mapbox(`${address}, Алматы`, token) : null);
    if (hit) return hit;
  }
  return name ? osm(`${name}, Алматы`) : null;
}

/** Адрес без улицы и дома («в центре», «уточнить») — сразу ручная точка. */
const vague = (a: string | null) => !a || !/\d/.test(a) || /в центре|в парке|уточн|по запросу|в лс|в директ/i.test(a);

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  const db = admin();
  if (!isServiceCall(req)) {
    const uid = await userFrom(req, db);
    if (!uid) return json({ error: 'auth' }, 401);
    const { data: staff } = await db.from('staff').select('user_id').eq('user_id', uid).maybeSingle();
    if (!staff) return json({ error: 'staff-only' }, 403);
  }
  const token = Deno.env.get('MAPBOX_TOKEN');
  const body = await req.json().catch(() => ({})) as { event_id?: string; all?: boolean };

  let q = db.from('events').select('id,title,address,flags,venue_id,venues(id,name,address,needs_pin,geo_source)').in('status', ['published', 'draft']);
  q = body.event_id ? q.eq('id', body.event_id) : q.gt('starts_at', new Date(Date.now() - 86400e3).toISOString());
  const { data: rows, error } = await q;
  if (error) return json({ error: error.message }, 500);

  const done = new Map<string, boolean>(); // площадка → нашлась ли
  const out = { found: 0, pin: 0, skipped: 0 };
  for (const e of (rows ?? []) as unknown as { id: string; title: string; address: string | null; flags: string[] | null; venue_id: string | null; venues: { id: string; name: string; address: string | null; needs_pin: boolean; geo_source: string | null } | null }[]) {
    const v = e.venues;
    // Точку уже поставил человек, проверенный список или геокодер — не трогаем.
    if (v && !v.needs_pin && v.geo_source) {
      if (e.flags?.includes('needs_pin')) await db.from('events').update({ flags: e.flags.filter((f) => f !== 'needs_pin') }).eq('id', e.id);
      out.skipped++;
      continue;
    }
    const address = v?.address ?? e.address;
    let ok = v ? done.get(v.id) : undefined;
    if (ok === undefined) {
      const hit = await find(address, v?.name ?? null, token);
      ok = !!hit;
      const geog = hit ? `SRID=4326;POINT(${hit.lon} ${hit.lat})` : undefined;
      if (v) {
        await db.from('venues').update(hit ? { geog, needs_pin: false, geo_source: hit.src } : { needs_pin: true }).eq('id', v.id);
        done.set(v.id, ok);
      } else if (hit) {
        const { data: nv } = await db.from('venues').insert({ name: `${address ?? e.title} · ${e.id.slice(0, 6)}`, address, geog, geo_source: hit.src }).select('id').single();
        if (nv) await db.from('events').update({ venue_id: nv.id }).eq('id', e.id);
      }
    }
    const flags = new Set(e.flags ?? []);
    if (ok) flags.delete('needs_pin'); else flags.add('needs_pin');
    await db.from('events').update({ flags: [...flags] }).eq('id', e.id);
    if (ok) out.found++; else out.pin++;
  }
  return json(out);
});
