// Настоящие события Алматы из data/seed/events-almaty.json → EventItem.
import type { Category, EventItem } from './types';
import seed from '../../data/seed/events-almaty.json';

export interface SeedEvent {
  id: string;
  title: string;
  category: string;
  tags: string[];
  starts_at: string;
  ends_at: string | null;
  venue_name: string | null;
  address: string;
  lat: number | null;
  lon: number | null;
  needs_pin: boolean;
  price_min: number | null;
  price_max: number | null;
  is_free: boolean;
  about: string;
  organizer: string | null;
  source_url: string | null;
}

export const ALMATY_CENTER = { lat: 43.2389, lon: 76.8897 };
const LONG_EVENT_MS = 6 * 3600 * 1000;

export function isLongEvent(startsAt: string, endsAt: string | null): boolean {
  return !!endsAt && new Date(endsAt).getTime() - new Date(startsAt).getTime() > LONG_EVENT_MS;
}

const SOURCES: [RegExp, string][] = [
  [/sxodim/, 'Sxodim'], [/ticketon/, 'Ticketon'], [/afisha\.yandex|yandex\.[a-z]+\/afisha/, 'Яндекс Афиша'], [/kino\.kz/, 'Kino.kz'],
  [/t\.me/, 'Telegram'], [/instagram/, 'Instagram'], [/threads/, 'Threads'],
];

/** Название источника по ссылке: «Sxodim», «Яндекс Афиша», иначе домен. */
export function sourceName(url: string | null): string | undefined {
  if (!url) return undefined;
  const hit = SOURCES.find(([re]) => re.test(url));
  if (hit) return hit[1];
  const m = /^https?:\/\/(?:www\.)?([^/]+)/.exec(url);
  return m ? m[1] : undefined;
}

export function mapSeedEvent(e: SeedEvent): EventItem {
  const hasPoint = e.lat != null && e.lon != null;
  return {
    id: e.id,
    title: e.title,
    category: e.category as Category,
    tags: e.tags ?? [],
    startsAt: e.starts_at,
    endsAt: e.ends_at,
    isLong: isLongEvent(e.starts_at, e.ends_at),
    venueName: e.venue_name,
    address: e.address,
    lat: hasPoint ? (e.lat as number) : ALMATY_CENTER.lat,
    lon: hasPoint ? (e.lon as number) : ALMATY_CENTER.lon,
    needsPin: e.needs_pin || !hasPoint,
    priceMin: e.price_min,
    priceMax: e.price_max,
    isFree: e.is_free,
    about: e.about,
    organizer: e.organizer,
    sourceUrl: e.source_url,
    source: sourceName(e.source_url),
    cover: null,
    visibility: 'public',
    origin: 'real',
    friendsGoing: [],
    lookingCount: 0,
    goingCount: 0,
  };
}

export function seedEvents(): EventItem[] {
  return (seed as { events: SeedEvent[] }).events.map(mapSeedEvent);
}
