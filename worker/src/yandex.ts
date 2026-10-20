// Яндекс Афиша · Алматы (afisha.yandex.kz). Разделы отдают страницы со ссылками на события, а на странице события
// есть разметка schema.org (название, фото, площадка с адресом и координатами). Цена — во встроенных данных страницы.
// Всё читает код, без ИИ и токенов. Если Яндекс показал капчу или страницу не отдал — пропускаем, остальное работает.
import { guessCategory } from './sites.ts';
import type { Found } from './search.ts';

const UA = {
  'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  'Accept-Language': 'ru',
};

/** Раздел афиши → категория приложения по умолчанию (если по названию не угадать). */
const SECTIONS: Record<string, string> = { concert: 'concert', standup: 'standup', show: 'meetup', art: 'art', lectures: 'lecture', sport: 'sport', kids: 'meetup', festival: 'party', theatre: 'theatre' };
const LISTS = ['concert', 'show', 'art', 'lectures', 'sport', 'kids', 'festival', 'theatre'];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function get(url: string, tries = 3): Promise<string | null> {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { headers: UA, redirect: 'follow', signal: AbortSignal.timeout(20_000) });
      if (res.ok) {
        const html = await res.text();
        if (!/showcaptcha|smartcaptcha/i.test(html.slice(0, 5000))) return html;
      }
    } catch { /* повторим */ }
    await sleep(1200 * (i + 1));
  }
  return null;
}

/** Ссылки на события из страницы раздела: /almaty/<раздел>/<адрес-события>. */
export function parseYandexList(html: string): string[] {
  const out = new Set<string>();
  for (const m of html.matchAll(/href="\/almaty\/([a-z]+)\/([a-z0-9][a-z0-9-]*)(?:[?#][^"]*)?"/g)) {
    if (m[1] in SECTIONS && m[2] !== 'places') out.add(`https://afisha.yandex.kz/almaty/${m[1]}/${m[2]}`);
  }
  return [...out];
}

interface Ld {
  '@type'?: string; name?: string; description?: string; image?: string | string[]; startDate?: string; endDate?: string; eventStatus?: string;
  location?: { name?: string; address?: { streetAddress?: string } | string; geo?: { latitude?: number | string; longitude?: number | string } };
}

/** Яндекс пишет местное время с суффиксом Z (на странице то же «21:00»): считаем его алматинским. */
export function localTime(iso: string | undefined): string | null {
  if (!iso) return null;
  const m = iso.match(/^(\d{4}-\d{2}-\d{2})(?:T(\d{2}:\d{2})(?::\d{2})?(?:\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/);
  if (!m) return Number.isNaN(Date.parse(iso)) ? null : iso;
  if (!m[2]) return m[1];
  return `${m[1]}T${m[2]}:00${!m[3] || m[3] === 'Z' ? '+05:00' : m[3]}`;
}

/** Цены билетов: Ticket:<id> → минимальная цена в тенге (Яндекс хранит в тиынах). */
export function ticketPrices(html: string): { byId: Map<string, number>; min: number | null } {
  const byId = new Map<string, number>();
  for (const m of html.matchAll(/"Ticket:([^"]+)":\{[^{}]*?"price":\{[^{}]*?"min":(\d+)/g)) byId.set(m[1], Math.round(Number(m[2]) / 100));
  const all = [...html.matchAll(/"__typename":"TicketPriceRange","currency":"kzt","min":(\d+)/g)].map((m) => Math.round(Number(m[1]) / 100)).filter((n) => n > 0);
  return { byId, min: all.length ? Math.min(...all) : null };
}

/** Сеансы события: местное время, цена билета. */
export function sessions(html: string): { at: string; price: number | null }[] {
  const { byId, min } = ticketPrices(html);
  const out = new Map<string, { at: string; price: number | null }>();
  for (const m of html.matchAll(/"__typename":"ScheduleSession","date":"[^"]*","datetime":"(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})(?::\d{2})?"(?:,"ticket":(?:\{"__ref":"Ticket:([^"]+)"\}|null))?/g)) {
    const price = (m[2] ? byId.get(m[2]) : undefined) ?? null;
    out.set(m[1], { at: `${m[1]}:00+05:00`, price: price && price > 0 ? price : min });
  }
  return [...out.values()].sort((a, b) => a.at.localeCompare(b.at));
}

/** Страница события → по одному событию на каждый из ближайших сеансов (до 4). */
export function yandexFound(html: string, url: string, from = ''): Found[] {
  let ev: Ld | undefined;
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const data = JSON.parse(m[1]) as Ld | Ld[];
      ev = (Array.isArray(data) ? data : [data]).find((d) => /Event$/.test(String(d['@type'] ?? '')));
      if (ev) break;
    } catch { /* битый блок */ }
  }
  if (!ev?.name || /Cancelled/.test(ev.eventStatus ?? '')) return [];
  const lat0 = Number(ev.location?.geo?.latitude), lon0 = Number(ev.location?.geo?.longitude);
  // Площадка дальше 60 км от центра Алматы (например, фестиваль в другой стране) — не наше событие.
  if (Number.isFinite(lat0) && lat0 !== 0 && Math.hypot((lat0 - 43.2389) * 111, (lon0 - 76.8897) * 81) > 60) return [];
  let list = sessions(html);
  // Нет списка сеансов — берём дату из разметки (Яндекс пишет местное время с Z).
  if (!list.length) { const t = localTime(ev.startDate); if (t) list = [{ at: t, price: ticketPrices(html).min }]; }
  list = list.filter((x) => x.at.slice(0, 10) >= from).slice(0, 4);
  const section = url.match(/\/almaty\/([a-z]+)\//)?.[1] ?? '';
  const street = typeof ev.location?.address === 'string' ? ev.location.address : ev.location?.address?.streetAddress;
  const lat = Number(ev.location?.geo?.latitude), lon = Number(ev.location?.geo?.longitude);
  const about = (ev.description ?? '').replace(/<[^>]+>/g, ' ').replace(/Продолжительность[^.]*\./i, ' ').replace(/\s+/g, ' ').trim();
  const image = Array.isArray(ev.image) ? ev.image[0] : ev.image;
  const guessed = guessCategory(ev.name, about);
  return list.map((x) => ({
    title: ev!.name!.replace(/\s+/g, ' ').trim().slice(0, 100),
    category: guessed === 'meetup' ? (SECTIONS[section] ?? 'meetup') : guessed,
    starts_at: x.at,
    ends_at: null,
    venue_name: ev!.location?.name?.trim() || null,
    address: street ? `${street.replace(/^просп\./i, 'проспект').trim()}, Алматы` : null,
    price_min: x.price,
    price_max: null,
    is_free: false,
    about: about.slice(0, 1500),
    url,
    image_url: typeof image === 'string' && /^https?:\/\//.test(image) ? image : null,
    source_name: 'Яндекс Афиша',
    confidence: 0.9,
    lat: Number.isFinite(lat) && lat !== 0 ? lat : null,
    lon: Number.isFinite(lon) && lon !== 0 ? lon : null,
  }));
}

/** Разделы афиши (по 2 страницы) → события. Не чаще ~3 запросов в секунду. */
export async function fetchYandexFound(from = '', pagesPerList = 2, max = 120): Promise<Found[]> {
  const links: string[] = [];
  for (const list of LISTS) {
    for (let n = 1; n <= pagesPerList; n++) {
      const html = await get(`https://afisha.yandex.kz/almaty/${list}${n > 1 ? `?page=${n}` : ''}`);
      if (!html) break;
      const found = parseYandexList(html);
      if (!found.length) break;
      for (const u of found) if (!links.includes(u)) links.push(u);
      await sleep(300);
    }
  }
  const out: Found[] = [];
  let i = 0;
  await Promise.all(Array.from({ length: 3 }, async () => {
    while (i < Math.min(links.length, max)) {
      const url = links[i++];
      const html = await get(url, 2);
      if (html) out.push(...yandexFound(html, url, from));
      await sleep(300);
    }
  }));
  return out;
}
