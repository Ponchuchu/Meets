// Кино: только явные сеансы из JSON-LD/JSON страницы, без выдуманных времени и адреса.
import type { Found } from './search.ts';
import { htmlToText } from './telegram.ts';

type Node = Record<string, unknown>;
export const CINEMA_SITES = {
  chaplin: { url: 'https://chaplin.kz/', name: 'Chaplin' },
  kino: { url: 'https://kino.kz/', name: 'Kino.kz' },
  ticketon: { url: 'https://ticketon.kz/almaty/cinema', name: 'Ticketon · кино' },
  kinopark: { url: 'https://www.kinopark.kz/ru/movies/today', name: 'Kinopark' },
  kinoafisha: { url: 'https://kz.kinoafisha.info/almaty/cinema/', name: 'Киноафиша' },
  'yandex-cinema': { url: 'https://afisha.yandex.kz/almaty/cinema', name: 'Яндекс · кино' },
  lyubimiigorod: { url: 'https://lyubimiigorod.ru/almaty/cinema', name: 'Любимый город · кино' },
} as const;
export type CinemaSite = keyof typeof CINEMA_SITES;
const object = (v: unknown): Node => v && typeof v === 'object' && !Array.isArray(v) ? v as Node : {};
const text = (v: unknown): string => typeof v === 'string' ? htmlToText(v).trim() : '';
const almaty = (v: string) => /алматы|almaty|alma[-\s]?ata|алма[-\s]?ата/i.test(v);
const name = (v: unknown) => { const n = object(v); return text(n.name ?? n.title) || text(v); };
function url(v: unknown, page: string): string | null {
  try { const u = new URL(text(v) || page, page); return /^https?:$/.test(u.protocol) ? u.href : null; } catch { return null; }
}
function start(node: Node): string | null {
  let raw = text(node.startDate ?? node.starts_at ?? node.startsAt ?? node.datetime ?? node.date_time);
  if (!raw && node.date && node.time) raw = `${text(node.date)}T${text(node.time)}`;
  raw = raw.replace(/^(\d{4}-\d{2}-\d{2})\s+/, '$1T');
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(raw)) return null;
  if (!/(Z|[+-]\d{2}:?\d{2})$/.test(raw)) raw += '+05:00';
  return Number.isFinite(Date.parse(raw)) ? raw : null;
}

export function parseCinemaPage(html: string, page: string, source: string): Found[] {
  const roots: unknown[] = [];
  if (html.trim().startsWith('{') || html.trim().startsWith('[')) { try { roots.push(JSON.parse(html)); } catch { /* HTML вместо JSON. */ } }
  for (const match of html.matchAll(/<script\b[^>]*(?:type=["']application\/(?:ld\+)?json["']|id=["']__NEXT_DATA__["'])[^>]*>([\s\S]*?)<\/script>/gi)) {
    try { roots.push(JSON.parse(match[1])); } catch { /* Повреждённый блок не даёт сеансов. */ }
  }
  const movies = new Map<string, Node>(), cinemas = new Map<string, Node>();
  const all: Node[] = [];
  const contexts = new WeakMap<Node, { movie: Node; location: Node; city: unknown }>();
  const collect = (v: unknown, inherited = { movie: {} as Node, location: {} as Node, city: undefined as unknown }) => {
    if (Array.isArray(v)) { v.forEach(x => collect(x, inherited)); return; }
    const n = object(v); if (!Object.keys(n).length) return;
    all.push(n);
    const type = name(n['@type']).toLowerCase();
    const ownMovie = object(n.workPerformed ?? n.movie ?? n.film);
    const ownLocation = object(n.location ?? n.cinema);
    const context = { movie: type === 'movie' ? n : Object.keys(ownMovie).length ? ownMovie : inherited.movie, location: type === 'movietheater' ? n : Object.keys(ownLocation).length ? ownLocation : inherited.location, city: n.city ?? inherited.city };
    contexts.set(n, context); Object.values(n).forEach(x => collect(x, context));
    const id = String(n.id ?? n['@id'] ?? '');
    if (id && (type === 'movie' || n.duration && (n.title || n.name))) movies.set(id, n);
    if (id && (type === 'movietheater' || n.address && (n.city || n.city_name))) cinemas.set(id, n);
  };
  roots.forEach(x => collect(x));
  const out: Found[] = [];
  for (const n of all) {
    const at = start(n); if (!at) continue;
    const type = name(n['@type']).toLowerCase();
    const context = contexts.get(n);
    const movie = object(n.workPerformed ?? n.movie ?? n.film ?? movies.get(String(n.movie_id ?? n.film_id ?? '')) ?? context?.movie);
    if (type !== 'screeningevent' && !Object.keys(movie).length) continue;
    const location = object(n.location ?? n.cinema ?? cinemas.get(String(n.cinema_id ?? '')) ?? context?.location);
    const address = object(location.address);
    const city = name(address.addressLocality ?? location.city ?? location.city_name ?? n.city ?? context?.city);
    const venue = name(location);
    if (city && !almaty(city)) continue;
    if (!almaty(city) && !almaty(venue) && !almaty(text(location.address)) && !/\/almaty(?:\/|\?|$)/i.test(page)) continue;
    const title = name(movie) || text(n.name ?? n.title);
    const link = url(n.url ?? n.booking_url ?? movie.url, page);
    if (!title || !venue || !link) continue;
    const offers = Array.isArray(n.offers) ? object(n.offers[0]) : object(n.offers);
    const amount = offers.price ?? n.price_min ?? n.price;
    const price = amount == null || amount === '' ? Number.NaN : Number(String(amount).replace(/\s/g, '').replace(',', '.'));
    const currency = text(offers.priceCurrency ?? n.currency);
    const knownPrice = Number.isFinite(price) && price >= 0 && (!currency || currency === 'KZT') ? price : null;
    const end = start({ startDate: n.endDate ?? n.ends_at });
    const image = Array.isArray(movie.image) ? movie.image[0] : movie.image ?? movie.poster ?? n.image;
    out.push({ title: title.slice(0, 160), category: 'movie', starts_at: at, ends_at: end && Date.parse(end) > Date.parse(at) ? end : null,
      venue_name: venue, address: text(address.streetAddress) || text(location.address) || null,
      price_min: knownPrice, price_max: knownPrice, is_free: knownPrice === 0,
      about: [text(movie.description), name(n.hall), text(n.format)].filter(Boolean).join(' · ').slice(0, 500),
      url: link, source_name: source, confidence: 0.95, image_url: image ? url(image, page) : null });
  }
  return out;
}

export async function fetchCinemaFound(site: CinemaSite): Promise<Found[]> {
  const config = CINEMA_SITES[site];
  const read = async (page: string) => {
    const response = await fetch(page, { headers: { 'User-Agent': 'Meets/1.0 (public cinema schedule)', 'Accept-Language': 'ru' }, signal: AbortSignal.timeout(12000) });
    if (!response.ok) throw new Error(`Киноафиша вернула ${response.status}`);
    const html = await response.text();
    if (html.length > 3_000_000) throw new Error('Страница киноафиши слишком большая');
    return html;
  };
  const html = await read(config.url);
  const pages: string[] = [config.url];
  for (const m of html.matchAll(/href=["']([^"']+)["']/gi)) {
    const link = url(m[1], config.url); if (!link) continue;
    const u = new URL(link);
    if (u.hostname.replace(/^www\./, '') !== new URL(config.url).hostname.replace(/^www\./, '') || !/movie|film|cinema|schedule|almaty/i.test(u.pathname)) continue;
    u.hash = ''; if (!pages.includes(u.href)) pages.push(u.href);
    if (pages.length >= 5) break;
  }
  const found = parseCinemaPage(html, config.url, config.name);
  for (const page of pages.slice(1)) {
    try { found.push(...parseCinemaPage(await read(page), page, config.name)); } catch { /* Один фильм не закрывает другие расписания. */ }
  }
  if (!found.length) throw new Error('Не удалось прочитать точные сеансы. Проверь формат киноафиши');
  return found;
}
