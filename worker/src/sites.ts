// Сайты-афиши. Сейчас — sxodim.com («Куда сходить» по Алматы): у каждой страницы события есть
// разметка schema.org Event (название, дата, место, цена). Превращаем её в «пост» — дальше тот же конвейер:
// разбор (ИИ или эвристики), дубли, геокодинг, черновик для модератора.
import type { RawPost } from './types.ts';
import type { Found } from './search.ts';

const UA = { 'User-Agent': 'ryadom-worker/0.1 (+https://ryadom.app)', 'Accept-Language': 'ru' };
const MAX_PER_RUN = 25;

interface LdEvent {
  '@type'?: string; name?: string; url?: string; description?: string; startDate?: string; endDate?: string;
  image?: string | string[]; eventStatus?: string;
  location?: { name?: string; address?: { streetAddress?: string; addressLocality?: string } | string };
  offers?: { price?: number | string; priceCurrency?: string } | { price?: number | string }[];
}

/** Все блоки JSON-LD страницы (битые пропускаем). */
function jsonLd(html: string): unknown[] {
  const out: unknown[] = [];
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try { out.push(JSON.parse(m[1])); } catch { /* не JSON — пропускаем */ }
  }
  return out;
}

/** Ссылки на события со страницы-списка sxodim.com/almaty. */
export function parseSxodimList(html: string): string[] {
  return [...new Set([...html.matchAll(/https:\/\/sxodim\.com\/almaty\/event\/[a-z0-9-]+/g)].map((m) => m[0]))];
}

/** Страница события → пост для конвейера. null — на странице нет события. */
export function parseSxodimEvent(html: string, url: string, sourceId: string): RawPost | null {
  const blocks = jsonLd(html);
  const ev = blocks.find((b) => (b as LdEvent)['@type'] === 'Event') as LdEvent | undefined;
  if (!ev?.name || !ev.startDate) return null;
  const article = blocks.find((b) => (b as { '@type'?: string })['@type'] === 'Article') as { datePublished?: string } | undefined;
  const addr = typeof ev.location?.address === 'string' ? ev.location.address : ev.location?.address?.streetAddress;
  const offer = Array.isArray(ev.offers) ? ev.offers[0] : ev.offers;
  const price = offer?.price != null ? Number(offer.price) : null;
  const cancelled = /Cancelled|Postponed/.test(ev.eventStatus ?? '');
  const lines = [
    cancelled ? `ОТМЕНА: ${ev.name}` : ev.name,
    `Когда: ${ev.startDate}${ev.endDate ? ` — ${ev.endDate}` : ''}`,
    addr ? `Где: ${ev.location?.name && ev.location.name !== ev.name ? `${ev.location.name}, ` : ''}${addr}, Алматы` : null,
    price != null && !Number.isNaN(price) ? (price === 0 ? 'Вход свободный' : `Цена: от ${price} ₸`) : null,
    ev.description ?? null,
  ].filter(Boolean);
  const images = Array.isArray(ev.image) ? ev.image : ev.image ? [ev.image] : [];
  return {
    sourceId,
    externalId: url.split('/').pop() ?? url,
    url,
    text: lines.join('\n'),
    images: images.slice(0, 1),
    postedAt: article?.datePublished ?? null,
  };
}

/** Новые события с сайта. seen — slug'и, которые уже читали (база и так отсекает дубли). */
export async function fetchSite(handle: string, sourceId: string, seen: Set<string> = new Set()): Promise<RawPost[]> {
  if (!handle.startsWith('sxodim.com')) throw new Error(`Сайт ${handle} пока не поддерживается`);
  const res = await fetch(`https://${handle}`, { headers: UA });
  if (!res.ok) throw new Error(`${handle}: ${res.status}`);
  const links = parseSxodimList(await res.text()).filter((u) => !seen.has(u.split('/').pop() ?? '')).slice(0, MAX_PER_RUN);
  const out: RawPost[] = [];
  for (const url of links) {
    const page = await fetch(url, { headers: UA });
    if (!page.ok) continue;
    const post = parseSxodimEvent(await page.text(), url, sourceId);
    if (post) out.push(post);
    await new Promise((r) => setTimeout(r, 400)); // вежливо: не чаще ~2 запросов в секунду
  }
  return out;
}

/** Категория по ключевым словам (без ИИ). Вечеринка — только по названию: слово «клуб» часто стоит в названии площадки. */
export function guessCategory(title: string, about = ''): string {
  const t = title.toLowerCase().replace(/ё/g, 'е');
  const a = `${t} ${about.toLowerCase().replace(/ё/g, 'е')}`;
  const rules: [RegExp, string, boolean][] = [
    [/стендап|stand ?up|открыт\w* микрофон/, 'standup', false],
    [/театр|спектакл|балет|опер[аыу]\b|мюзикл/, 'theatre', false],
    [/лекци|мастер-?класс|лекторий|семинар|воркшоп/, 'lecture', false],
    [/квиз|настольн|мафия/, 'games', false],
    [/велопрогул|велозаезд|велотур/, 'bike', false],
    [/забег|марафон|турнир|матч\b|футбол|баскетбол|хоккей|единоборств|бокс\b/, 'sport', false],
    [/поход|хайкинг|трекинг|восхождени|экскурси|каньон|водопад|озер[оа]|в горы/, 'hike', false],
    [/ярмарк|маркет\b|гастро|дегустац|фестивал\w* еды/, 'food', false],
    [/вечеринк|party|\bdj\b|диджей|halloween|хэллоуин/, 'party', true],
    [/выставк|музей|галере|экспозици|инсталляци/, 'art', false],
    [/концерт|\blive\b|джаз|симфон|оркестр|сольн|тур\b|группа|рок\b|рэп|поп\b/, 'concert', false],
  ];
  for (const [re, cat, titleOnly] of rules) if (re.test(titleOnly ? t : a)) return cat;
  return 'meetup';
}

/** У Sxodim в разметке «место» = название события, а площадка стоит в начале адреса: «Дворец Республики, пр. Достык, 56». */
export function splitVenue(placeName: string | undefined, street: string | undefined, title: string): { venue: string | null; address: string | null } {
  const clean = (x: string) => x.replace(/\u200b/g, '').replace(/\s+/g, ' ').trim();
  const addr = clean(street ?? '');
  const place = clean(placeName ?? '');
  if (place && place.toLowerCase() !== title.trim().toLowerCase()) return { venue: place, address: addr || null };
  const parts = addr.split(',').map((x) => x.trim()).filter(Boolean);
  const street1 = /^(ул\.?|улица|пр\.?|проспект|пр-т|мкр\.?|микрорайон|бульвар|б-р|пер\.?|переулок|площадь|пл\.?|шоссе|набережная)(\s|$)/i;
  if (parts.length > 1 && !street1.test(parts[0]) && !/^\d/.test(parts[0])) return { venue: parts[0], address: parts.slice(1).join(', ') };
  return { venue: null, address: addr || null };
}

/** Страница события sxodim.com (разметка schema.org Event) → найденное событие. */
export function sxodimFound(html: string, url: string): Found | null {
  const ev = jsonLd(html).find((b) => (b as LdEvent)['@type'] === 'Event') as LdEvent | undefined;
  if (!ev?.name || !ev.startDate || Number.isNaN(Date.parse(ev.startDate))) return null;
  if (/Cancelled/.test(ev.eventStatus ?? '')) return null;
  const addr = typeof ev.location?.address === 'string' ? ev.location.address : ev.location?.address?.streetAddress;
  const offers = (Array.isArray(ev.offers) ? ev.offers : ev.offers ? [ev.offers] : []).map((o) => Number(o.price)).filter((n) => !Number.isNaN(n));
  const price = offers.length ? Math.min(...offers) : null;
  const image = Array.isArray(ev.image) ? ev.image[0] : ev.image;
  const { venue, address } = splitVenue(ev.location?.name, addr, ev.name);
  const about = (ev.description ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return {
    title: ev.name.replace(/\s+/g, ' ').trim().slice(0, 100),
    category: guessCategory(ev.name, about),
    starts_at: ev.startDate,
    ends_at: ev.endDate && !Number.isNaN(Date.parse(ev.endDate)) ? ev.endDate : null,
    venue_name: venue,
    address: address ? `${address}, Алматы` : null,
    price_min: price && price > 0 ? price : null,
    price_max: offers.length > 1 ? Math.max(...offers) : null,
    is_free: price === 0,
    about: about.slice(0, 160),
    url,
    image_url: typeof image === 'string' && /^https?:\/\//.test(image) ? image : null,
    source_name: 'Sxodim',
    confidence: 0.9, // разметка страницы точнее, чем пересказ ИИ; подтверждено двумя сайтами — 0.95
  };
}

/** Афиша sxodim.com/almaty/afisha?page=N → события (без ИИ, ~0 токенов). Не чаще ~3 запросов в секунду. */
export async function fetchSxodimFound(pages = 10, max = 170): Promise<Found[]> {
  const links: string[] = [];
  for (let n = 1; n <= pages; n++) {
    try {
      const res = await fetch(`https://sxodim.com/almaty/afisha${n > 1 ? `?page=${n}` : ''}`, { headers: UA, signal: AbortSignal.timeout(15_000) });
      if (!res.ok) break;
      for (const u of parseSxodimList(await res.text())) if (!links.includes(u)) links.push(u);
    } catch { break; }
    await new Promise((r) => setTimeout(r, 300));
  }
  const out: Found[] = [];
  let i = 0;
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (i < Math.min(links.length, max)) {
      const url = links[i++];
      try {
        const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(15_000) });
        if (res.ok) { const f = sxodimFound(await res.text(), url); if (f) out.push(f); }
      } catch { /* страница не открылась — пропускаем */ }
      await new Promise((r) => setTimeout(r, 250));
    }
  }));
  return out;
}
