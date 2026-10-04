// Координаты остановок автобусов Алматы из OpenStreetMap (Overpass API) → data/seed/bus-stops-almaty.json.
// Запуск вручную: GitHub → Actions → buses → Run workflow (или `node worker/src/busstops.ts` где есть интернет).
// Данные OSM — ODbL: в приложении подпись «© участники OpenStreetMap».
import { readFileSync, writeFileSync } from 'node:fs';

// Несколько серверов Overpass: главный часто отвечает 504 под нагрузкой.
const SERVERS = process.env.OVERPASS_URL ? [process.env.OVERPASS_URL] : [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];
// Рамка вокруг Алматы (юг, запад, север, восток) — быстрее, чем поиск границы города.
const BBOX = '43.10,76.70,43.42,77.20';
const QUERY = `[out:json][timeout:300][bbox:${BBOX}];
rel["route"~"^(bus|trolleybus)$"]->.r;
.r out body;
node(r.r);
out body qt;`;

async function overpass(): Promise<{ elements: (OsmNode | OsmRel)[] }> {
  let last = '';
  for (let round = 0; round < 2; round++) {
    for (const url of SERVERS) {
      try {
        const res = await fetch(url, { method: 'POST', body: new URLSearchParams({ data: QUERY }), headers: { 'User-Agent': 'ryadom-app (github.com/Ponchuchu/ryadom)' }, signal: AbortSignal.timeout(320_000) });
        if (res.ok) {
          console.log(`Overpass: ${url}`);
          return (await res.json()) as { elements: (OsmNode | OsmRel)[] };
        }
        last = `${url} → ${res.status}`;
      } catch (err) {
        last = `${url} → ${(err as Error).message}`;
      }
      console.error(`  не вышло: ${last}`);
    }
    await new Promise((r) => setTimeout(r, 20_000));
  }
  throw new Error(`Overpass недоступен: ${last}`);
}

interface OsmNode { type: 'node'; id: number; lat: number; lon: number; tags?: Record<string, string> }
interface OsmMember { type: string; ref: number; role: string }
interface OsmRel { type: 'relation'; id: number; tags?: Record<string, string>; members: OsmMember[] }
export interface Stop { id: string; name: string; lat: number; lon: number }
export interface Direction { ref: string; kind: string; name: string; from: string; to: string; osm: number; stops: Stop[] }

function dist(a: Stop, b: Stop): number {
  const r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(s));
}

/** Остановки маршрута по порядку: сначала роли stop*, если их нет — platform*. Соседние ближе 40 м склеиваем. */
export function directionStops(rel: OsmRel, nodes: Map<number, OsmNode>): Stop[] {
  const pick = (re: RegExp) => rel.members.filter((m) => m.type === 'node' && re.test(m.role)).map((m) => nodes.get(m.ref)).filter((n): n is OsmNode => !!n);
  let list = pick(/^stop/);
  if (list.length < 2) list = pick(/^platform/);
  const out: Stop[] = [];
  for (const n of list) {
    const s = { id: `osm${n.id}`, name: n.tags?.name ?? n.tags?.['name:ru'] ?? '', lat: n.lat, lon: n.lon };
    const last = out[out.length - 1];
    if (last && dist(last, s) < 40) continue;
    out.push(s);
  }
  return out;
}

async function main() {
  const json = await overpass();
  const nodes = new Map<number, OsmNode>();
  for (const e of json.elements) if (e.type === 'node') nodes.set(e.id, e);
  const dirs: Direction[] = [];
  for (const e of json.elements) {
    if (e.type !== 'relation' || !e.tags?.ref) continue;
    const stops = directionStops(e, nodes);
    if (stops.length < 2) continue;
    dirs.push({ ref: e.tags.ref, kind: e.tags.route ?? 'bus', name: e.tags.name ?? '', from: e.tags.from ?? '', to: e.tags.to ?? '', osm: e.id, stops });
  }
  const known = JSON.parse(readFileSync('data/seed/buses-almaty.json', 'utf8')) as { routes: { ref: string }[] };
  const have = new Set(dirs.filter((d) => d.kind === 'bus').map((d) => d.ref));
  const missing = known.routes.map((r) => r.ref).filter((r) => !have.has(r));
  const out = {
    _about: 'Остановки автобусов и троллейбусов Алматы с координатами, по порядку для каждого направления. Источник — OpenStreetMap (Overpass API).',
    license: '© участники OpenStreetMap, ODbL — подпись обязательна',
    fetched_at: new Date().toISOString().slice(0, 10),
    routes_in_osm: have.size,
    missing_from_osm: missing,
    directions: dirs.sort((a, b) => a.ref.localeCompare(b.ref, 'ru', { numeric: true })),
  };
  writeFileSync('data/seed/bus-stops-almaty.json', JSON.stringify(out, null, 1));
  console.log(`OSM: направлений ${dirs.length}, автобусных маршрутов ${have.size} из ${known.routes.length}. Нет в OSM: ${missing.join(', ') || '—'}`);
}

if (process.argv[1]?.endsWith('busstops.ts')) {
  void main().catch((err: unknown) => { console.error(err); process.exitCode = 1; });
}
