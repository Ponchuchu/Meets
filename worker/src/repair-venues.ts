// Привязка карточек без точки к месту по названию площадки (27 окт., просьба владельца): «Театр Лермонтова», «Дворец Республики»,
// «гостиница Казахстан» — адрес в посте не нужен. Берём название из events.venue_hint или из площадки по умолчанию у источника,
// ищем на карте, создаём площадку в справочнике (следующие карточки найдут её сами) и снимаем флаг «Адрес неточный».
//   node worker/src/repair-venues.ts [--dry]
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { geocode, matchVenue, NOT_A_PLACE, type VenueRow } from './venues.ts';
import { canonAddress } from './ruAddress.ts';

interface Row { id: string; title: string; flags: string[]; address: string | null; venue_hint: string | null; sources: { venue_name: string | null } | null }

export async function repairVenues(url: string, key: string, dry = false, log: (t: string) => void = console.log): Promise<{ checked: number; fixed: number }> {
  const h: Record<string, string> = { apikey: key, 'Content-Type': 'application/json' };
  if (key.split('.').length === 3) h.Authorization = `Bearer ${key}`;
  const get = async <T>(path: string): Promise<T> => {
    const r = await fetch(`${url}/rest/v1/${path}`, { headers: h, signal: AbortSignal.timeout(20_000) });
    if (!r.ok) throw new Error(`Supabase ${r.status}: ${(await r.text()).slice(0, 120)}`);
    return r.json() as Promise<T>;
  };
  const rows = await get<Row[]>(`events?select=id,title,flags,address,venue_hint,sources(venue_name)&venue_id=is.null&flags=cs.{needs_pin}&status=in.(draft,published)&or=(ends_at.gte.${new Date().toISOString()},starts_at.gte.${new Date(Date.now() - 3 * 3600e3).toISOString()})&limit=200`);
  const venues = await get<VenueRow[]>('venues_points?select=id,name,aliases,address,lat,lon');
  let fixed = 0;
  for (const e of rows) {
    const hint = (e.venue_hint ?? e.sources?.venue_name ?? '').trim();
    if (!hint || NOT_A_PLACE.test(hint)) continue;
    let venueId: string | null = matchVenue(hint, null, venues)?.id ?? null;
    let address = e.address;
    if (!venueId) {
      const p = await geocode(hint);
      if (!p) { log(`Не нашёл на карте · ${e.title} · «${hint}»`); continue; }
      address = address && /\d/.test(address) ? address : canonAddress(p.address ?? null).address;
      if (!dry) {
        const r = await fetch(`${url}/rest/v1/venues?on_conflict=name`, { method: 'POST', headers: { ...h, Prefer: 'resolution=merge-duplicates,return=representation' },
          body: JSON.stringify([{ name: hint.slice(0, 120), address, geog: `SRID=4326;POINT(${p.lon} ${p.lat})` }]) });
        if (!r.ok) { log(`Площадка не сохранилась · ${hint}: ${r.status}`); continue; }
        venueId = ((await r.json()) as { id: string }[])[0].id;
        venues.push({ id: venueId, name: hint, aliases: [], address, lat: p.lat, lon: p.lon });
      }
    }
    log(`${dry ? 'Проверка' : 'Привязал'} · ${e.title} → «${hint}»${address ? ` · ${address}` : ''}`);
    if (!dry && venueId) {
      const r = await fetch(`${url}/rest/v1/events?id=eq.${e.id}`, { method: 'PATCH', headers: { ...h, Prefer: 'return=minimal' },
        body: JSON.stringify({ venue_id: venueId, address, flags: e.flags.filter((f) => f !== 'needs_pin'), updated_at: new Date().toISOString() }) });
      if (!r.ok) { log(`Карточка не обновилась · ${e.title}: ${r.status}`); continue; }
    }
    fixed++;
  }
  log(`Площадки: проверено ${rows.length}, привязано ${fixed}`);
  return { checked: rows.length, fixed };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) console.log('Нет SUPABASE_URL / SUPABASE_SECRET_KEY — пропускаю');
  else void repairVenues(url, key, process.argv.includes('--dry')).catch((e) => { console.error(e instanceof Error ? e.message : e); process.exitCode = 1; });
}
