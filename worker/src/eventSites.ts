// Новые сайты-афиши (21 октября, список владельца): OnVibe, Topbilet, Portalbilet, «Город зовёт», концерты Kino.kz.
// Читает код, без ИИ: страница-список → ссылки на события этого же сайта → разметка schema.org Event на странице
// события (название, дата, площадка, цена, фото). Событие без разметки с датой не берём — ничего не придумываем.
// Всё уходит на согласование (источники не «доверенные»), поэтому неизвестная вёрстка сайта не попадёт на карту сама.
import type { Found } from './search.ts';
import { guessCategory, splitVenue } from './sites.ts';

const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; ryadom-worker/0.1; +https://ryadom.app)', 'Accept-Language': 'ru' };

export const EVENT_SITES = {
  onvibe: { name: 'OnVibe', lists: ['https://onvibe.me/almaty', 'https://onvibe.me/almaty/weekend'] },
  topbilet: { name: 'Topbilet', lists: ['https://topbilet.kz/', 'https://topbilet.kz/almaty'] },
  portalbilet: { name: 'Portalbilet', lists: ['https://portalbilet.kz/', 'https://portalbilet.kz/almaty'] },
  gorodzovet: { name: 'Город зовёт', lists: ['https://gorodzovet.ru/almaty/', 'https://gorodzovet.ru/almaty/weekend/'] },
  'kino-concert': { name: 'Kino.kz · концерты', lists: ['https://kino.kz/ru/concert'] },
} as const;
export type EventSite = keyof typeof EVENT_SITES;

type Node = Record<string, unknown>;
const obj = (v: unknown): Node => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Node) : {});
const str = (v: unknown): string => (typeof v === 'string' ? v.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : '');
const ALMATY = /алматы|almaty|alma[-\s]?ata|алма[-\s]?ата/i;

/** Все объекты из блоков JSON-LD (с @graph и вложенными списками). */
export function ldNodes(html: string): Node[] {
  const out: Node[] = [];
  const walk = (v: unknown) => {
    if (Array.isArray(v)) { v.forEach(walk); return; }
    const n = obj(v);
    if (!Object.keys(n).length) return;
    out.push(n);
    if (n['@graph']) walk(n['@graph']);
    if (n.itemListElement) walk(n.itemListElement);
    if (n.item) walk(n.item);
    if (n.subEvent) walk(n.subEvent);
  };
  for (const m of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { walk(JSON.parse(m[1].trim())); } catch { /* битый блок — пропускаем */ }
  }
  return out;
}

const isEvent = (n: Node) => {
  const t = n['@type'];
  const types = (Array.isArray(t) ? t : [t]).map((x) => String(x ?? ''));
  return types.some((x) => /Event$/.test(x)) && !types.some((x) => /^(Business|Online)Event$/.test(x));
};

/** Дата начала: «2026-10-25T19:00» без пояса — время Алматы. */
function iso(v: unknown): string | null {
  let s = str(v).replace(/^(\d{4}-\d{2}-\d{2})\s+/, '$1T');
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s)) return null;
  if (!/(Z|[+-]\d{2}:?\d{2})$/.test(s)) s += '+05:00';
  return Number.isFinite(Date.parse(s)) ? s : null;
}

/** Событие schema.org → находка. Только Алматы (или город не указан на алматинской странице). */
export function ldEventFound(n: Node, page: string, sourceName: string, almatyPage: boolean): Found | null {
  const title = str(n.name);
  const starts = iso(n.startDate);
  if (!title || !starts) return null;
  if (/Cancelled|Postponed/i.test(str(n.eventStatus))) return null;
  const loc = obj(Array.isArray(n.location) ? n.location[0] : n.location);
  const addr = obj(loc.address);
  const street = str(addr.streetAddress) || str(loc.address);
  const city = str(addr.addressLocality);
  if (city && !ALMATY.test(city)) return null;
  if (!city && !almatyPage && !ALMATY.test(`${street} ${str(loc.name)}`)) return null;
  const offers = (Array.isArray(n.offers) ? n.offers : n.offers ? [n.offers] : []).map(obj);
  const prices = offers.flatMap((o) => [o.price, o.lowPrice, o.highPrice]).filter((p) => p != null && String(p).trim() !== '').map((p) => Number(String(p).replace(/\s/g, '').replace(',', '.'))).filter((p) => Number.isFinite(p) && p >= 0);
  const cur = offers.map((o) => str(o.priceCurrency)).find(Boolean);
  const okPrice = !cur || cur === 'KZT';
  const price = okPrice && prices.length ? Math.min(...prices) : null;
  const ends = iso(n.endDate);
  const image = Array.isArray(n.image) ? n.image[0] : n.image;
  const img = typeof image === 'string' ? image : str(obj(image).url);
  let url = page;
  try { url = new URL(str(n.url) || page, page).href; } catch { /* остаётся страница */ }
  const about = str(n.description);
  const { venue, address } = splitVenue(str(loc.name) || undefined, street || undefined, title);
  return {
    title: title.slice(0, 120),
    category: guessCategory(title, about),
    starts_at: starts,
    ends_at: ends && Date.parse(ends) > Date.parse(starts) ? ends : null,
    venue_name: venue,
    address: address ? (ALMATY.test(address) ? address : `${address}, Алматы`) : null,
    price_min: price && price > 0 ? price : null,
    price_max: okPrice && prices.length > 1 ? Math.max(...prices) : null,
    is_free: price === 0,
    about: about.slice(0, 1500),
    url,
    image_url: /^https?:\/\//.test(img) ? img : null,
    source_name: sourceName,
    confidence: 0.85,
  };
}

/** Ссылки этого же сайта, похожие на страницы событий (не на списки, профили и разделы). */
export function eventLinks(html: string, page: string): string[] {
  const host = new URL(page).host.replace(/^www\./, '');
  const out = new Set<string>();
  for (const m of html.matchAll(/href=["']([^"'#]+)["']/gi)) {
    let u: URL;
    try { u = new URL(m[1], page); } catch { continue; }
    if (u.host.replace(/^www\./, '') !== host || !/^https?:$/.test(u.protocol)) continue;
    const path = u.pathname.replace(/\/+$/, '');
    if (path.split('/').filter(Boolean).length < 2) continue;
    if (/\/(login|auth|account|cart|basket|search|contacts?|about|faq|news|blog|tag|category|categories|page)\b/i.test(path)) continue;
    if (!/(event|events|concert|concerts|show|shows|kontsert|meropriyat|afisha|spektakl|standup|stand-up|festival|\d{3,})/i.test(path)) continue;
    out.add(`${u.origin}${u.pathname}`);
  }
  return [...out];
}

async function get(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(15_000), redirect: 'follow' });
    return res.ok ? await res.text() : null;
  } catch { return null; }
}

/** Один сайт: события со страниц-списков (если разметка есть прямо там) + страницы событий по ссылкам. */
export async function fetchEventSiteFound(site: EventSite, max = 80): Promise<Found[]> {
  const conf = EVENT_SITES[site];
  const out: Found[] = [];
  const links: string[] = [];
  let opened = 0;
  for (const list of conf.lists) {
    const html = await get(list);
    if (!html) continue;
    opened++;
    // Город не указан в разметке — берём, только если сама страница алматинская (у Topbilet и Portalbilet есть и Астана).
    const almatyPage = /almaty|алматы/i.test(list);
    for (const n of ldNodes(html).filter(isEvent)) { const f = ldEventFound(n, list, conf.name, almatyPage); if (f) out.push(f); }
    for (const l of eventLinks(html, list)) if (!links.includes(l)) links.push(l);
    await new Promise((r) => setTimeout(r, 300));
  }
  if (!opened) throw new Error('сайт не открылся');
  let i = 0;
  await Promise.all(Array.from({ length: 3 }, async () => {
    while (i < Math.min(links.length, max)) {
      const url = links[i++];
      const html = await get(url);
      if (html) for (const n of ldNodes(html).filter(isEvent)) { const f = ldEventFound(n, url, conf.name, /almaty|алматы/i.test(url)); if (f) out.push(f); }
      await new Promise((r) => setTimeout(r, 300));
    }
  }));
  // Один и тот же показ мог попасть и со списка, и со страницы события.
  const seen = new Set<string>();
  return out.filter((f) => { const k = `${f.title.toLowerCase()}|${f.starts_at.slice(0, 16)}`; if (seen.has(k)) return false; seen.add(k); return true; });
}
