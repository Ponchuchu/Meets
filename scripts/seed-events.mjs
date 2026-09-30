// npm run seed:events
// 1) Геокодирует события из data/seed/events-almaty.json через Nominatim (OSM, ODbL),
//    не чаще 1 запроса в секунду, и записывает lat/lon обратно в JSON.
// 2) Загружает события в Supabase через Management API (токен подставляет прокси среды).
//    Нет доступа — сохраняет SQL в supabase/seed/events.sql и сообщает, что сделать.
// Флаги: --geocode-only, --upload-only, --force (переспросить уже найденные).
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const seedPath = join(root, 'data/seed/events-almaty.json');
const keys = JSON.parse(await readFile(join(root, 'config/public-keys.json'), 'utf8'));
const args = new Set(process.argv.slice(2));

const UA = 'ryadom-seed/0.1 (https://github.com/Ponchuchu/ryadom)';
// Алматы: рамка для поиска и центр города.
const VIEWBOX = '76.70,43.40,77.20,43.05';
const CITY_CENTER = { lat: 43.2389, lon: 76.8897 };
// Ориентиры за пределами улиц (горы, ущелья): если Nominatim промахнулся — ставим точку сюда
// и оставляем needs_pin, чтобы модератор поправил.
const LANDMARKS = [
  [/медеу/i, { lat: 43.1575, lon: 77.0592 }],
  [/лунная поляна/i, { lat: 43.1128, lon: 76.9936 }],
  [/большое алматинское озеро|бао/i, { lat: 43.0506, lon: 76.9853 }],
  [/мынжилки/i, { lat: 43.0797, lon: 77.0806 }],
  [/аюсай/i, { lat: 43.1352, lon: 76.9531 }],
  [/кок-жайляу/i, { lat: 43.1297, lon: 77.0142 }],
  [/зел[её]ный базар/i, { lat: 43.2622, lon: 76.9553 }],
  [/almaty arena/i, { lat: 43.2556, lon: 76.8061 }],
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let last = 0;
async function nominatim(q) {
  const wait = 1100 - (Date.now() - last);
  if (wait > 0) await sleep(wait);
  last = Date.now();
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=kz&accept-language=ru&bounded=1&viewbox=${VIEWBOX}&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`Nominatim ${res.status}`);
  const [hit] = await res.json();
  return hit ? { lat: Number(Number(hit.lat).toFixed(6)), lon: Number(Number(hit.lon).toFixed(6)), type: hit.addresstype || hit.type } : null;
}

function queries(e) {
  const list = [e.geocode_query];
  if (e.venue_name) list.push(`${e.venue_name}, Алматы`);
  if (e.address) list.push(`${e.address.replace(/,?\s*\d+[\wА-Яа-я/]*$/u, '')}, Алматы`);
  return [...new Set(list.filter(Boolean))];
}

async function geocode(data) {
  let found = 0;
  for (const e of data.events) {
    if (e.lat != null && e.lon != null && !args.has('--force')) { found++; continue; }
    let hit = null;
    let exact = true;
    for (const q of queries(e)) {
      try { hit = await nominatim(q); } catch (err) { console.warn(`  ${e.id}: ${err.message}`); }
      if (hit) break;
      exact = false;
    }
    // Точный адрес с номером дома — считаем найденным. Улица без дома или ориентир — просим модератора поправить.
    const precise = !!hit && exact && !['road', 'city', 'town', 'suburb', 'quarter', 'neighbourhood', 'city_district', 'county', 'state', 'country'].includes(hit.type);
    const lm0 = LANDMARKS.find(([re]) => re.test(`${e.geocode_query} ${e.venue_name}`));
    // Промах мимо Алматы (дальше ~40 км от центра) — не верим.
    if (hit && Math.hypot(hit.lat - CITY_CENTER.lat, (hit.lon - CITY_CENTER.lon) * 0.73) > 0.36) hit = null;
    if (!hit && lm0) { hit = lm0[1]; }
    if (!hit) {
      const lm = LANDMARKS.find(([re]) => re.test(`${e.geocode_query} ${e.venue_name}`));
      hit = lm ? lm[1] : CITY_CENTER;
    }
    e.lat = hit.lat;
    e.lon = hit.lon;
    e.needs_pin = !precise;
    if (precise) found++;
    console.log(`${e.id} ${precise ? 'ok  ' : 'pin?'} ${e.lat},${e.lon}  ${e.geocode_query}`);
  }
  if (!data._about.includes('OpenStreetMap')) {
    data._about += ' Координаты: © участники OpenStreetMap (ODbL), геокодер Nominatim.';
  }
  await writeFile(seedPath, JSON.stringify(data, null, 2) + '\n');
  console.log(`Координаты записаны: точных ${found} из ${data.events.length}.`);
}

const lit = (v) => (v == null ? 'null' : typeof v === 'number' || typeof v === 'boolean' ? String(v) : `'${String(v).replace(/'/g, "''")}'`);
const arr = (a) => (a && a.length ? `array[${a.map(lit).join(',')}]::text[]` : `'{}'::text[]`);

function buildSql(data) {
  const venues = new Map();
  for (const e of data.events) {
    const key = e.venue_name || e.address;
    if (!venues.has(key)) venues.set(key, e);
  }
  const v = [...venues.entries()].map(([name, e]) =>
    `(${lit(name)}, ${lit(e.address)}, ST_SetSRID(ST_MakePoint(${e.lon}, ${e.lat}), 4326)::geography, ${lit(e.needs_pin)})`).join(',\n  ');
  const ev = data.events.map((e) => `(${lit(e.id)}, ${lit(e.title)}, ${lit(e.category)}, ${arr(e.tags)}, ${lit(e.starts_at)}, ${lit(e.ends_at)}, ` +
    `${lit(!!e.ends_at && (new Date(e.ends_at) - new Date(e.starts_at)) > 6 * 3600e3)}, ` +
    `(select id from public.venues where name = ${lit(e.venue_name || e.address)}), ${lit(e.address)}, ${lit(e.price_min)}, ${lit(e.price_max)}, ${lit(e.is_free)}, ` +
    `${lit(e.about)}, ${lit(e.organizer)}, ${lit(e.source_url)}, ${lit(e.confidence)}, 'published', 'public')`).join(',\n  ');
  return `-- Сгенерировано scripts/seed-events.mjs. Координаты: © OpenStreetMap contributors (ODbL).
insert into public.venues (name, address, geog, needs_pin) values
  ${v}
on conflict (name) do update set address = excluded.address, geog = excluded.geog, needs_pin = excluded.needs_pin;

insert into public.events (external_id, title, category, tags, starts_at, ends_at, is_long, venue_id, address, price_min, price_max, is_free, about, organizer, source_url, confidence, status, visibility) values
  ${ev}
on conflict (external_id) do update set title = excluded.title, category = excluded.category, tags = excluded.tags,
  starts_at = excluded.starts_at, ends_at = excluded.ends_at, is_long = excluded.is_long, venue_id = excluded.venue_id,
  address = excluded.address, price_min = excluded.price_min, price_max = excluded.price_max, is_free = excluded.is_free,
  about = excluded.about, organizer = excluded.organizer, source_url = excluded.source_url, confidence = excluded.confidence;
`;
}

export async function runSql(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${keys.supabaseProjectRef}/database/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(process.env.SUPABASE_ACCESS_TOKEN ? { Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}` } : {}),
    },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Management API ${res.status}: ${text.slice(0, 200)}`);
  return text;
}

async function upload(data) {
  const sql = buildSql(data);
  const out = join(root, 'supabase/seed/events.sql');
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, sql);
  try {
    await runSql(sql);
    console.log(`Загружено в Supabase: ${data.events.length} событий.`);
  } catch (err) {
    console.warn(`Не удалось загрузить в Supabase (${err.message}).`);
    console.warn('SQL сохранён в supabase/seed/events.sql. Приложение пока берёт события из seed-файла. Что сделать — docs/KEYS.md.');
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const data = JSON.parse(await readFile(seedPath, 'utf8'));
  if (!args.has('--upload-only')) await geocode(data);
  if (!args.has('--geocode-only')) await upload(data);
}
