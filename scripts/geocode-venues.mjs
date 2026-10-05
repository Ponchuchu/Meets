// Разово: точки площадок с needs_pin через Nominatim (OSM) — из облака Supabase он не отвечает, поэтому отсюда.
// NODE_USE_ENV_PROXY=1 node scripts/geocode-venues.mjs — пишет geog и geo_source='osm' через Management API.
import { runSql } from './seed-events.mjs';

const CENTER = { lat: 43.2389, lon: 76.8897 };
const vague = (a) => !a || !/\d/.test(a) || /в центре|в парке|уточн|по запросу|в лс|в директ/i.test(a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const esc = (s) => s.replace(/'/g, "''");

async function osm(q) {
  await sleep(1100);
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=kz&accept-language=ru&bounded=1&viewbox=76.70,43.40,77.20,43.05&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'ryadom-geocode/0.1 (https://github.com/Ponchuchu/ryadom)' } });
  if (!res.ok) return null;
  const [h] = await res.json();
  if (!h || h.place_rank < 28) return null;
  const lat = Number(h.lat), lon = Number(h.lon);
  return Math.hypot((lat - CENTER.lat) * 111, (lon - CENTER.lon) * 81) < 40 ? { lat, lon } : null;
}

const venues = JSON.parse(await runSql("select id, name, address from venues where needs_pin and geo_source is distinct from 'manual'"));
for (const v of venues) {
  const hit = (!vague(v.address) && await osm(`${v.address}, Алматы`)) || await osm(`${v.name}, Алматы`);
  console.log(hit ? '✓' : '·', v.name, hit ? `${hit.lat.toFixed(5)},${hit.lon.toFixed(5)}` : '— ставить вручную');
  if (hit) await runSql(`update venues set geog = st_setsrid(st_makepoint(${hit.lon}, ${hit.lat}), 4326)::geography, needs_pin = false, geo_source = 'osm' where id = '${esc(v.id)}'`);
}
// Флаги событий: needs_pin только у тех, чья площадка всё ещё без точки.
await runSql(`update events e set flags = array_remove(e.flags, 'needs_pin') from venues v where v.id = e.venue_id and not v.needs_pin and 'needs_pin' = any(e.flags)`);
await runSql(`update events e set flags = array_append(coalesce(e.flags, '{}'), 'needs_pin') from venues v where v.id = e.venue_id and v.needs_pin and not ('needs_pin' = any(coalesce(e.flags, '{}')))`);
