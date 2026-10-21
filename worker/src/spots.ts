// Постоянные места (таблица spots): сборщик сам дописывает часы работы с перерывами и цены.
// 1) 2ГИС (если есть ключ DGIS_KEY): расписание по дням, перерывы — промежутки между интервалами работы.
// 2) Официальный сайт места (info_url): разметка schema.org — openingHoursSpecification / openingHours и priceRange.
// Ничего не нашли — оставляем как есть: в приложении кнопка «Часы и цены» ведёт в 2ГИС, часы не выдумываем.
// Запуск: node worker/src/spots.ts --run (шаг в процессе «Поиск событий», раз в несколько дней на место).

type Hours = Record<string, [string, string][]>;
interface SpotRow { id: string; name: string; lat: number; lon: number; info_url: string | null; gis_id: string | null; checked_at: string | null }

const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; ryadom-worker/0.1; +https://ryadom.app)', 'Accept-Language': 'ru' };
const DAYS_EN = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAYS_2GIS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAYS_SHORT = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const hm = (v: unknown) => { const m = /^(\d{1,2}):(\d{2})/.exec(String(v ?? '')); return m ? `${m[1].padStart(2, '0')}:${m[2]}` : null; };

/** Расписание 2ГИС ({ Mon: { working_hours: [{ from, to }] } }) → наши часы. Нет дня — выходной. */
export function hoursFrom2gis(schedule: unknown): Hours | null {
  const s = (schedule ?? {}) as Record<string, { working_hours?: { from?: string; to?: string }[] }> & { is_24x7?: boolean };
  if (s.is_24x7) return Object.fromEntries(DAYS_2GIS.map((_, i) => [String(i + 1), [['00:00', '24:00']]])) as Hours;
  if (!DAYS_2GIS.some((d) => s[d])) return null;
  const out: Hours = {};
  DAYS_2GIS.forEach((d, i) => {
    out[String(i + 1)] = (s[d]?.working_hours ?? []).map((w) => [hm(w.from), hm(w.to)] as [string | null, string | null])
      .filter((p): p is [string, string] => !!p[0] && !!p[1]);
  });
  return out;
}

/** schema.org: openingHoursSpecification [{ dayOfWeek, opens, closes }] или openingHours «Mo-Fr 10:00-22:00». */
export function hoursFromLd(node: Record<string, unknown>): Hours | null {
  const out: Hours = {};
  const add = (day: number, a: string | null, b: string | null) => { if (a && b) (out[String(day)] ??= []).push([a, b]); };
  const specs = ([] as unknown[]).concat(node.openingHoursSpecification ?? []) as Record<string, unknown>[];
  for (const sp of specs) {
    const days = ([] as unknown[]).concat(sp.dayOfWeek ?? []).map((d) => DAYS_EN.findIndex((x) => String(d).endsWith(x)) + 1).filter((d) => d > 0);
    for (const d of days) add(d, hm(sp.opens), hm(sp.closes));
  }
  for (const line of ([] as unknown[]).concat(node.openingHours ?? []).map(String)) {
    const m = /^([A-Z][a-z])(?:-([A-Z][a-z]))?\s+(\d{1,2}:\d{2})-(\d{1,2}:\d{2})/.exec(line.trim());
    if (!m) continue;
    const from = DAYS_SHORT.indexOf(m[1]), to = m[2] ? DAYS_SHORT.indexOf(m[2]) : from;
    if (from < 0 || to < 0) continue;
    for (let d = from; ; d = (d + 1) % 7) { add(d + 1, hm(m[3]), hm(m[4])); if (d === to) break; }
  }
  if (!Object.keys(out).length) return null;
  for (let d = 1; d <= 7; d++) { out[String(d)] ??= []; out[String(d)].sort((x, y) => x[0].localeCompare(y[0])); }
  return out;
}

/** «от 3 000 ₸», «3000-5000 KZT» → 3000. Символы «$$» и чужая валюта — не цена. */
export function priceFrom(v: unknown): number | null {
  const s = String(v ?? '');
  if (/[$€£]|USD|EUR|RUB/i.test(s)) return null;
  const n = /(\d[\d\s]{1,8})/.exec(s)?.[1];
  const x = n ? Number(n.replace(/\s/g, '')) : NaN;
  return Number.isFinite(x) && x >= 100 ? x : null;
}

function ldNodes(html: string): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const walk = (v: unknown) => { if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === 'object') { const n = v as Record<string, unknown>; out.push(n); if (n['@graph']) walk(n['@graph']); } };
  for (const m of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) { try { walk(JSON.parse(m[1].trim())); } catch { /* битый блок */ } }
  return out;
}

async function from2gis(s: SpotRow, key: string): Promise<{ hours: Hours | null; gis_id: string | null } | null> {
  const url = `https://catalog.api.2gis.com/3.0/items?q=${encodeURIComponent(s.name)}&point=${s.lon},${s.lat}&radius=600&fields=items.schedule&locale=ru_KZ&key=${key}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) }).catch(() => null);
  if (!res?.ok) return null;
  const item = ((await res.json()) as { result?: { items?: { id?: string; schedule?: unknown }[] } }).result?.items?.[0];
  return item ? { hours: hoursFrom2gis(item.schedule), gis_id: item.id ?? null } : null;
}

async function fromSite(s: SpotRow): Promise<{ hours: Hours | null; price: number | null } | null> {
  if (!s.info_url) return null;
  const res = await fetch(s.info_url, { headers: UA, signal: AbortSignal.timeout(15_000) }).catch(() => null);
  if (!res?.ok) return null;
  const nodes = ldNodes(await res.text());
  const place = nodes.find((n) => n.openingHoursSpecification || n.openingHours) ?? nodes.find((n) => n.priceRange);
  return place ? { hours: hoursFromLd(place), price: priceFrom(place.priceRange) } : null;
}

async function main() {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) { console.log('Нет SUPABASE_URL / SUPABASE_SECRET_KEY — места не обновляю'); return; }
  const h = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
  const res = await fetch(`${url}/rest/v1/spots?select=id,name,lat,lon,info_url,gis_id,checked_at&enabled=eq.true&order=checked_at.asc.nullsfirst&limit=40`, { headers: h });
  if (!res.ok) { console.log(`Таблицы мест ещё нет или нет доступа (${res.status}) — пропускаю`); return; }
  const spots = (await res.json()) as SpotRow[];
  const dgis = process.env.DGIS_KEY;
  let updated = 0;
  for (const s of spots) {
    // Одно место — не чаще раза в три дня: часы меняются редко, а запросы к 2ГИС платные.
    if (s.checked_at && Date.now() - Date.parse(s.checked_at) < 3 * 86400e3) continue;
    const g = dgis ? await from2gis(s, dgis) : null;
    const site = await fromSite(s);
    const hours = g?.hours ?? site?.hours ?? null;
    const patch: Record<string, unknown> = { checked_at: new Date().toISOString() };
    if (hours) { patch.hours = hours; patch.source = g?.hours ? '2gis' : 'site'; }
    if (g?.gis_id) patch.gis_id = g.gis_id;
    if (site?.price) patch.price_from = site.price;
    const up = await fetch(`${url}/rest/v1/spots?id=eq.${encodeURIComponent(s.id)}`, { method: 'PATCH', headers: h, body: JSON.stringify(patch) });
    if (up.ok && (hours || site?.price)) updated++;
    console.log(`  ${s.name}: ${hours ? 'часы' : 'без часов'}${site?.price ? `, от ${site.price} ₸` : ''}${g ? ' (2ГИС)' : ''}`);
    await new Promise((r) => setTimeout(r, 400));
  }
  console.log(`Места: проверено ${spots.length}, обновлено ${updated}${dgis ? '' : ' (ключа 2ГИС нет — только сайты мест)'}`);
}

if (process.argv[1]?.endsWith('spots.ts') && process.argv.includes('--run')) void main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exitCode = 1; });
