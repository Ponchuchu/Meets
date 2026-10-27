// Черновик карточки из разобранного поста: площадка, точка, флаги, публиковать ли сразу.
import { canonAddress } from './ruAddress.ts';
import { isVague, matchVenue, NOT_A_PLACE, type VenueRow } from './venues.ts';
import type { Draft, Extraction, Flag, Point, RawPost, Source } from './types.ts';

export const AUTO_PUBLISH_FROM = 0.95;

/** Сразу на карту — только источник с доверием, с включённой настройкой, 95%+ и без флагов. */
export function autoPublish(source: Pick<Source, 'trusted' | 'auto_publish'>, confidence: number, flags: Flag[]): boolean {
  return source.trusted && source.auto_publish && confidence >= AUTO_PUBLISH_FROM && flags.length === 0;
}

export async function buildDraft(
  x: Extraction,
  post: RawPost,
  source: Source,
  venues: VenueRow[],
  geocode: (q: string) => Promise<Point | null>,
): Promise<Draft | null> {
  if (x.class !== 'event' || !x.starts_at || !x.title) return null;
  const flags: Flag[] = [];
  const venue = matchVenue(x.venue_name, x.address, venues);
  let point: Point | null = venue?.lat != null && venue.lon != null ? { lat: venue.lat, lon: venue.lon } : null;
  if (!point && x.lat != null && x.lon != null && Math.hypot((x.lat - 43.2389) * 111, (x.lon - 76.8897) * 81) < 18) point = { lat: x.lat, lon: x.lon };
  if (!point && !isVague(x.address)) point = await geocode([x.venue_name, x.address].filter(Boolean).join(', '));
  // Есть название площадки, а адреса нет («Театр Лермонтова», «Дворец Республики», «гостиница Казахстан») — ищем место по названию.
  if (!point && x.venue_name && !NOT_A_PLACE.test(x.venue_name.trim())) point = await geocode(x.venue_name);
  if (!point) flags.push('needs_pin');
  if (x.price_unsure) flags.push('check_price');
  const confidence = Math.round(x.confidence * 100) / 100;
  // Адрес в одном виде: «улица Жандосова, 1/1», этаж и офис — в заметку.
  const addr = canonAddress(!isVague(x.address) ? x.address : (!venue ? point?.address : null) ?? x.address);
  return {
    title: x.title,
    category: x.category,
    tags: x.tags,
    starts_at: new Date(x.starts_at).toISOString(),
    ends_at: x.ends_at ? new Date(x.ends_at).toISOString() : null,
    is_long: x.is_long,
    venue_id: venue?.id ?? null,
    venue_name: venue?.name ?? x.venue_name,
    address: addr.address,
    address_note: x.address_note ?? addr.note,
    point: venue ? null : point,
    price_min: x.price_min,
    price_max: x.price_max,
    is_free: x.is_free,
    about: x.about,
    organizer: x.organizer,
    source_url: post.url,
    cover_url: post.images[0] ?? null,
    sessions: x.sessions && x.sessions.length > 1 ? x.sessions.map((a) => new Date(a).toISOString()) : undefined,
    ai_confidence: confidence,
    flags,
    status: autoPublish(source, confidence, flags) ? 'published' : 'draft',
  };
}
