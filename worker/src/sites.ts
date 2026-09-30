// Сайты-афиши. Сейчас — sxodim.com («Куда сходить» по Алматы): у каждой страницы события есть
// разметка schema.org Event (название, дата, место, цена). Превращаем её в «пост» — дальше тот же конвейер:
// разбор (ИИ или эвристики), дубли, геокодинг, черновик для модератора.
import type { RawPost } from './types.ts';

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
