// Координаты остановок автобусов Алматы → data/seed/bus-stops-almaty.json.
// Маршруты в OSM по Алматы почти пустые (5 октября: 7 направлений с 10+ остановками), поэтому главное —
// порядок остановок из data/seed/buses-almaty.json (Bustime) + координаты одиночных остановок OSM, найденные по названию.
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
out body qt;
(node["highway"="bus_stop"]["name"];node["public_transport"="platform"]["name"];);
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

/** Название для сравнения: строчные, ё→е, без кавычек и знаков. base — без скобок: «Торайгырова (Аль-Фараби)» → «торайгырова». */
export function normName(name: string): { full: string; base: string } {
  const clean = (t: string) => t.toLowerCase().replace(/ё/g, 'е').replace(/[«»"'.,№]/g, ' ').replace(/[–—-]/g, ' ').replace(/\s+/g, ' ').trim();
  return { full: clean(name), base: clean(name.replace(/\([^)]*\)/g, ' ')) };
}

export interface NamedPoint { id: string; name: string; lat: number; lon: number }

/** Индекс одиночных остановок OSM по названию (полному и без скобок). */
export function indexStops(points: NamedPoint[]): Map<string, NamedPoint[]> {
  const idx = new Map<string, NamedPoint[]>();
  const add = (k: string, p: NamedPoint) => { if (!k) return; const l = idx.get(k) ?? []; l.push(p); idx.set(k, l); };
  for (const p of points) { const n = normName(p.name); add(n.full, p); if (n.base !== n.full) add(n.base, p); }
  return idx;
}

const MAX_HOP_M = 2500; // соседние остановки дальше — значит, выбрали не ту с таким же названием

/** Похожесть названий по словам (Жаккар): «ул. Толе би – Ауэзова» ≈ «Толе би / Ауэзова». */
export function nameSim(a: string, b: string): number {
  const w = (t: string) => new Set(normName(t).base.split(' ').filter((x) => x.length > 1 && !['ул', 'пр', 'мкр', 'улица', 'проспект'].includes(x)));
  const A = w(a), B = w(b);
  if (!A.size || !B.size) return 0;
  let both = 0;
  for (const x of A) if (B.has(x)) both++;
  return both / (A.size + B.size - both);
}

/** Кандидаты по названию: точное совпадение, иначе похожие (≥ 0,6). FIX3: точных было мало, маршруты выходили дырявыми. */
function candidates(name: string, idx: Map<string, NamedPoint[]>): NamedPoint[] {
  const n = normName(name);
  const exact = idx.get(n.full) ?? idx.get(n.base);
  if (exact) return exact;
  const out: NamedPoint[] = [];
  for (const [key, list] of idx) if (nameSim(key, name) >= 0.6) out.push(...list);
  return out;
}

/** Остановки маршрута по порядку с координатами. Для каждого названия берём одноимённую остановку, ближайшую к предыдущей. */
export function placeStops(names: string[], idx: Map<string, NamedPoint[]>): { stops: Stop[]; matched: number } {
  const cands = names.map((nm) => candidates(nm, idx));
  const out: Stop[] = [];
  let prev: NamedPoint | null = null;
  for (let i = 0; i < names.length; i++) {
    const list = cands[i];
    if (!list.length) continue;
    let ref: NamedPoint | null = prev;
    if (!ref) {
      // первая найденная: та, что ближе всего к кандидатам следующей найденной остановки
      const next = cands.slice(i + 1).find((l) => l.length);
      ref = next ? next[0] : null;
    }
    let best = list[0];
    if (ref) { const r = ref; best = list.reduce((a, b) => (dist(asStop(a), asStop(r)) <= dist(asStop(b), asStop(r)) ? a : b)); }
    if (prev && dist(asStop(best), asStop(prev)) > MAX_HOP_M) continue;
    out.push({ id: best.id, name: names[i], lat: best.lat, lon: best.lon });
    prev = best;
  }
  return { stops: out, matched: out.length };
}

function asStop(p: NamedPoint): Stop { return { id: p.id, name: p.name, lat: p.lat, lon: p.lon }; }

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
  const points: NamedPoint[] = [];
  const seen = new Set<number>();
  for (const e of json.elements) {
    if (e.type !== 'node' || seen.has(e.id) || !e.tags?.name) continue;
    if (e.tags.highway !== 'bus_stop' && e.tags.public_transport !== 'platform') continue;
    seen.add(e.id);
    points.push({ id: `osm${e.id}`, name: e.tags.name, lat: e.lat, lon: e.lon });
  }
  const idx = indexStops(points);
  const known = JSON.parse(readFileSync('data/seed/buses-almaty.json', 'utf8')) as { routes: { ref: string; from: string; to: string; stops_a: string[]; stops_b: string[] }[] };
  const placed: (Direction & { matched: number; total: number })[] = [];
  for (const r of known.routes) {
    for (const [names, from, to] of [[r.stops_a, r.from, r.to], [r.stops_b, r.to, r.from]] as [string[], string, string][]) {
      if (!names?.length) continue;
      const { stops, matched } = placeStops(names, idx);
      placed.push({ ref: r.ref, kind: 'bus', name: `${from} → ${to}`, from, to, osm: 0, stops, matched, total: names.length });
    }
  }
  const good = placed.filter((d) => d.matched >= Math.max(4, d.total * 0.5));
  const totalNames = placed.reduce((a, d) => a + d.total, 0);
  const totalMatched = placed.reduce((a, d) => a + d.matched, 0);
  const have = new Set(dirs.filter((d) => d.kind === 'bus').map((d) => d.ref));
  const missing = known.routes.map((r) => r.ref).filter((r) => !have.has(r));
  const out = {
    _about: 'Остановки автобусов Алматы с координатами по порядку. directions — порядок из Bustime (data/seed/buses-almaty.json), координаты — одиночные остановки OpenStreetMap, найденные по названию (matched из total). osm_routes — то, что нарисовано маршрутами в самом OSM (мало).',
    license: '© участники OpenStreetMap, ODbL — подпись обязательна; порядок остановок — по данным Bustime',
    fetched_at: new Date().toISOString().slice(0, 10),
    osm_named_stops: points.length,
    matched_share: totalNames ? Math.round((totalMatched / totalNames) * 100) / 100 : 0,
    directions_usable: good.length,
    directions: placed,
    routes_in_osm: have.size,
    missing_from_osm: missing,
    osm_routes: dirs.sort((a, b) => a.ref.localeCompare(b.ref, 'ru', { numeric: true })),
  };
  writeFileSync('data/seed/bus-stops-almaty.json', JSON.stringify(out, null, 1));
  console.log(`Остановок OSM с названием: ${points.length}. Найдено по названию ${totalMatched} из ${totalNames} (${Math.round((totalMatched / Math.max(1, totalNames)) * 100)}%). Годных направлений: ${good.length} из ${placed.length}. Маршрутов в самом OSM: ${have.size}.`);
}

if (process.argv[1]?.endsWith('busstops.ts')) {
  void main().catch((err: unknown) => { console.error(err); process.exitCode = 1; });
}
