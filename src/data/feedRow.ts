// Строка витрины events_feed → EventItem. Чистая функция: её используют и приложение, и Edge Functions.
import { isLongEvent, sourceName } from './seed';
import type { Category, EventItem } from './types';

export interface FeedRow {
  id: string;
  external_id: string | null;
  title: string;
  category: string;
  tags: string[] | null;
  starts_at: string;
  ends_at: string | null;
  is_long: boolean;
  venue_name: string | null;
  address: string | null;
  address_note: string | null;
  lat: number | null;
  lon: number | null;
  needs_pin: boolean;
  price_min: number | null;
  price_max: number | null;
  is_free: boolean;
  about: string | null;
  organizer: string | null;
  cover_url: string | null;
  source_url: string | null;
  visibility: 'public' | 'friends';
}

export function mapFeedRow(r: FeedRow): EventItem {
  return {
    id: r.external_id ?? r.id,
    title: r.title,
    category: r.category as Category,
    tags: r.tags ?? [],
    startsAt: r.starts_at,
    endsAt: r.ends_at,
    isLong: r.is_long || isLongEvent(r.starts_at, r.ends_at),
    venueName: r.venue_name,
    address: r.address ?? '',
    addressNote: r.address_note ?? undefined,
    lat: r.lat ?? 43.2389,
    lon: r.lon ?? 76.8897,
    needsPin: r.needs_pin || r.lat == null,
    priceMin: r.price_min,
    priceMax: r.price_max,
    isFree: r.is_free,
    about: r.about ?? '',
    organizer: r.organizer,
    sourceUrl: r.source_url,
    source: sourceName(r.source_url),
    cover: r.cover_url,
    visibility: r.visibility,
    origin: 'real',
    friendsGoing: [],
    lookingCount: 0,
    goingCount: 0,
  };
}

