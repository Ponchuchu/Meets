// Постоянные места (таблица spots): сборщик сам дописывает часы работы с перерывами и цены.
// Источник — официальный сайт места (info_url): разметка schema.org (openingHoursSpecification / openingHours, priceRange),
// а если её нет — текст страниц «режим работы / цены / контакты». Ничего не нашли — часы не выдумываем.
// Запуск: node worker/src/spots.ts --run (шаг в процессе «Поиск событий», раз в несколько дней на место).

type Hours = Record<string, [string, string][]>;
interface SpotRow { id: string; name: string; lat: number; lon: number; info_url: string | null; gis_id: string | null; checked_at: string | null }

const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; ryadom-worker/0.1; +https://ryadom.app)', 'Accept-Language': 'ru' };
const DAYS_EN = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAYS_SHORT = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const hm = (v: unknown) => { const m = /^(\d{1,2}):(\d{2})/.exec(String(v ?? '')); return m ? `${m[1].padStart(2, '0')}:${m[2]}` : null; };

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

const DAY_RU: [RegExp, number][] = [[/^пн|^пон/i, 1], [/^вт/i, 2], [/^ср/i, 3], [/^чт|^чет/i, 4], [/^пт|^пят/i, 5], [/^сб|^суб/i, 6], [/^вс|^вос/i, 7]];
const dayRu = (w: string) => DAY_RU.find(([re]) => re.test(w.trim()))?.[1] ?? null;
const T = String.raw`(\d{1,2})[:.](\d{2})`;
const tm = (h: string, m: string) => `${h.padStart(2, '0')}:${m}`;

/** Текст страницы без разметки (для сайтов без schema.org: «Режим работы: ежедневно с 10:00 до 22:00, перерыв 13:00–14:00»). */
export function pageText(html: string): string {
  return html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<br\s*\/?>|<\/(p|div|li|tr|h\d)>/gi, '\n').replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/g, ' ').replace(/&mdash;|&ndash;/g, '–').replace(/[ \t]+/g, ' ');
}

/** Часы из обычного текста: «ежедневно 10:00–22:00», «Пн–Пт с 9:00 до 18:00, Сб–Вс 10:00–20:00», «перерыв 13:00–14:00», «круглосуточно».
 *  Берём только строки рядом со словами «режим работы / часы работы / работаем / график»: иначе это время сеансов, а не часы места. */
export function hoursFromText(text: string): Hours | null {
  const zone = [...text.matchAll(/(режим работы|часы работы|время работы|график работы|работаем|мы открыты)[^\n]{0,220}(\n[^\n]{0,160}){0,3}/gi)].map((m) => m[0]).join('\n');
  if (!zone) return null;
  const out: Hours = {};
  const put = (d: number, a: string, b: string) => (out[String(d)] ??= []).push([a, b]);
  if (/круглосуточно|24\/7/i.test(zone)) { for (let d = 1; d <= 7; d++) put(d, '00:00', '24:00'); }
  const range = new RegExp(String.raw`([А-Яа-я]{2,11})\s*[-–—]\s*([А-Яа-я]{2,11})[:\s,]*(?:с\s*)?${T}\s*(?:до|[-–—])\s*${T}`, 'g');
  for (const m of zone.matchAll(range)) {
    const a = dayRu(m[1]), b = dayRu(m[2]);
    if (!a || !b) continue;
    for (let d = a; ; d = (d % 7) + 1) { put(d, tm(m[3], m[4]), tm(m[5], m[6])); if (d === b) break; }
  }
  if (!Object.keys(out).length) {
    const daily = new RegExp(String.raw`(?:ежедневно|без выходных|каждый день|пн\s*[-–—]\s*вс)?[^\d\n]{0,40}?(?:с\s*)?${T}\s*(?:до|[-–—])\s*${T}`, 'i').exec(zone);
    if (daily) for (let d = 1; d <= 7; d++) put(d, tm(daily[1], daily[2]), tm(daily[3], daily[4]));
  }
  if (!Object.keys(out).length) return null;
  // Перерыв: режем каждый день на два интервала.
  const br = new RegExp(String.raw`перерыв[^\d\n]{0,15}(?:с\s*)?${T}\s*(?:до|[-–—])\s*${T}`, 'i').exec(zone);
  if (br) {
    const s = tm(br[1], br[2]), e = tm(br[3], br[4]);
    for (const d of Object.keys(out)) out[d] = out[d].flatMap(([a, b]) => (a < s && e < b ? [[a, s], [e, b]] as [string, string][] : [[a, b]] as [string, string][]));
  }
  // «Выходной: понедельник» / «пн — выходной».
  const off = /(?:выходной(?: день)?[:\s–—-]*([А-Яа-я]{2,11}))|(?:([А-Яа-я]{2,11})\s*[–—-]\s*выходной)/i.exec(zone);
  const offDay = off ? dayRu(off[1] ?? off[2] ?? '') : null;
  for (let d = 1; d <= 7; d++) out[String(d)] ??= [];
  if (offDay) out[String(offDay)] = [];
  return out;
}

/** Самая низкая цена в тенге рядом со словами «цена / стоимость / билет / от». */
export function priceFromText(text: string): number | null {
  const all = [...text.matchAll(/(?:цена|стоимость|билет|вход|от)[^\n\d]{0,25}(\d[\d\s]{2,7})\s*(?:₸|тг|тенге|kzt)/gi)].map((m) => Number(m[1].replace(/\s/g, ''))).filter((n) => n >= 100 && n < 1e6);
  return all.length ? Math.min(...all) : null;
}

/** Ссылки этого сайта на страницы, где обычно часы и цены. */
export function infoLinks(html: string, base: string): string[] {
  const host = new URL(base).host.replace(/^www\./, '');
  const out = new Set<string>();
  for (const m of html.matchAll(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]{0,120}?)<\/a>/gi)) {
    const label = m[2].replace(/<[^>]+>/g, ' ');
    let u: URL; try { u = new URL(m[1], base); } catch { continue; }
    if (u.host.replace(/^www\./, '') !== host) continue;
    if (/режим|расписан|график|цен|прайс|тариф|скипасс|ski-?pass|билет|контакт|price|schedule|tariff|contact|ticket|hours/i.test(`${u.pathname} ${label}`)) out.add(`${u.origin}${u.pathname}`);
  }
  return [...out].slice(0, 5);
}

function ldNodes(html: string): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const walk = (v: unknown) => { if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === 'object') { const n = v as Record<string, unknown>; out.push(n); if (n['@graph']) walk(n['@graph']); } };
  for (const m of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) { try { walk(JSON.parse(m[1].trim())); } catch { /* битый блок */ } }
  return out;
}

const page = async (url: string) => {
  const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(15_000), redirect: 'follow' }).catch(() => null);
  return r?.ok ? r.text() : null;
};

/** Сайт места: сначала разметка schema.org, иначе текст главной и страниц «режим работы / цены / контакты». */
export async function fromSite(s: Pick<SpotRow, 'info_url'>): Promise<{ hours: Hours | null; price: number | null } | null> {
  if (!s.info_url) return null;
  const home = await page(s.info_url);
  if (!home) return null;
  const nodes = ldNodes(home);
  const place = nodes.find((n) => n.openingHoursSpecification || n.openingHours) ?? nodes.find((n) => n.priceRange);
  let hours = place ? hoursFromLd(place) : null;
  let price = place ? priceFrom(place.priceRange) : null;
  const texts = [pageText(home)];
  if (!hours || !price) for (const link of infoLinks(home, s.info_url)) { const h = await page(link); if (h) texts.push(pageText(h)); await new Promise((r) => setTimeout(r, 300)); }
  for (const t of texts) { hours ??= hoursFromText(t); price ??= priceFromText(t); }
  return hours || price ? { hours, price } : null;
}

/**
 * Фото мест — копии в нашем хранилище (event-media/spots/<id>/<n>.jpg). Викисклад отвечает приложениям 429/403,
 * поэтому телефон получает фото только от нас. Источники: photo_src (Викисклад) и страница места в Instagram (ig).
 */
export async function copyPhotos(url: string, h: Record<string, string>, fetchFn: typeof fetch = fetch): Promise<number> {
  const res = await fetchFn(`${url}/rest/v1/spots?select=id,photo_src,photos,ig,photos_checked_at&enabled=eq.true`, { headers: h });
  if (!res.ok) return 0;
  const rows = (await res.json()) as { id: string; photo_src: string[] | null; photos: string[] | null; ig: string | null; photos_checked_at: string | null }[];
  let done = 0;
  for (const r of rows) {
    if (!(r.photo_src ?? []).length && !r.ig) continue;
    if (r.photos_checked_at && Date.now() - Date.parse(r.photos_checked_at) < 7 * 86400e3) continue;
    const src: string[] = [];
    if (r.ig) {
      // Последние фото со страницы места в Instagram (функция social; ключи — в Supabase).
      const ig = await fetchFn(`${url}/functions/v1/social`, { method: 'POST', headers: h, body: JSON.stringify({ action: 'probe', handle: r.ig }) }).then((x) => x.json()).catch(() => null) as { posts?: { media: { type: string; url: string; poster?: string | null }[] }[] } | null;
      for (const p of ig?.posts ?? []) { const m = p.media.find((x) => x.type === 'image') ?? p.media[0]; const u = m?.type === 'image' ? m.url : m?.poster; if (u) src.push(u); }
    }
    src.push(...(r.photo_src ?? []));
    const out: string[] = [];
    for (const u of [...new Set(src)].slice(0, 8)) {
      for (let attempt = 0; attempt < 3; attempt++) {
        const img = await fetchFn(u, { headers: { 'User-Agent': 'ryadom-worker/0.2 (https://github.com/Ponchuchu/ryadom)' }, signal: AbortSignal.timeout(30_000) }).catch(() => null);
        if (img?.status === 429) { await new Promise((w) => setTimeout(w, 3000 * (attempt + 1))); continue; }
        if (!img?.ok) break;
        const type = (img.headers.get('content-type') ?? 'image/jpeg').split(';')[0];
        if (!type.startsWith('image/')) break;
        const bytes = await img.arrayBuffer();
        if (bytes.byteLength > 8 * 1024 * 1024) break;
        const hash = (await import('node:crypto')).createHash('sha256').update(new Uint8Array(bytes)).digest('hex').slice(0, 16);
        const path = `spots/${r.id}/${hash}.${type.includes('png') ? 'png' : type.includes('webp') ? 'webp' : 'jpg'}`;
        const up = await fetchFn(`${url}/storage/v1/object/event-media/${path}`, { method: 'POST', headers: { ...h, 'Content-Type': type, 'x-upsert': 'true' }, body: bytes });
        if (up.ok && !out.some(p => p.includes(hash))) out.push(`${url}/storage/v1/object/public/event-media/${path}`);
        break;
      }
      await new Promise((w) => setTimeout(w, 700));
    }
    if (!out.length) continue;
    await fetchFn(`${url}/rest/v1/spots?id=eq.${encodeURIComponent(r.id)}`, { method: 'PATCH', headers: h, body: JSON.stringify({ photos: out, photos_checked_at: new Date().toISOString() }) });
    console.log(`  Места · ${r.id} · фото ${out.length}`);
    done++;
  }
  return done;
}

async function main() {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) { console.log('Нет SUPABASE_URL / SUPABASE_SECRET_KEY — места не обновляю'); return; }
  const h = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
  await copyPhotos(url, h).catch((e) => console.log(`Фото мест: ${(e as Error).message}`));
  if (process.argv.includes('--photos-only')) return;
  const res = await fetch(`${url}/rest/v1/spots?select=id,name,lat,lon,info_url,gis_id,checked_at,source&enabled=eq.true&order=checked_at.asc.nullsfirst&limit=40`, { headers: h });
  if (!res.ok) { console.log(`Таблицы мест ещё нет или нет доступа (${res.status}) — пропускаю`); return; }
  const spots = (await res.json()) as SpotRow[];
  let updated = 0;
  for (const s of spots) {
    // Одно место — не чаще раза в три дня: часы меняются редко.
    if (s.checked_at && Date.now() - Date.parse(s.checked_at) < 3 * 86400e3) continue;
    const site = await fromSite(s);
    const hours = site?.hours ?? null;
    const patch: Record<string, unknown> = { checked_at: new Date().toISOString() };
    // Часы, внесённые вручную (source = manual), сайт не перезаписывает.
    if (hours && (s as SpotRow & { source?: string }).source !== 'manual') { patch.hours = hours; patch.source = 'site'; }
    if (site?.price) patch.price_from = site.price;
    const up = await fetch(`${url}/rest/v1/spots?id=eq.${encodeURIComponent(s.id)}`, { method: 'PATCH', headers: h, body: JSON.stringify(patch) });
    if (up.ok && (hours || site?.price)) updated++;
    const line = `Места · ${s.name} · ${hours ? 'часы найдены' : 'часов нет'}${site?.price ? ` · от ${site.price} ₸` : ''}${hours ? ' (сайт)' : ''}`;
    console.log(`  ${line}`);
    if (process.env.ROBOT_RUN_ID) await fetch(`${url}/rest/v1/robot_log`, { method: 'POST', headers: h, body: JSON.stringify({ run_id: process.env.ROBOT_RUN_ID, text: line, level: hours ? 'ok' : 'info' }) }).catch(() => undefined);
    await new Promise((r) => setTimeout(r, 400));
  }
  console.log(`Места: проверено ${spots.length}, обновлено ${updated}`);
}

if (process.argv[1]?.endsWith('spots.ts') && process.argv.includes('--run')) void main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exitCode = 1; });
