// Реализация на Supabase. Сейчас из базы берутся события; люди и чаты — этап 8, до тех пор демо.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config } from '../lib/config';
import { createDemoSource, demoEvents, mergeEvents } from './demo';
import { isLongEvent } from './seed';
import type { Category, DataSource, EventItem } from './types';

let client: SupabaseClient | null = null;
export function supabase(): SupabaseClient {
  if (!client) {
    client = createClient(config.supabaseUrl, config.supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

interface FeedRow {
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
    cover: r.cover_url,
    visibility: r.visibility,
    origin: 'real',
    friendsGoing: [],
    lookingCount: 0,
    goingCount: 0,
  };
}

export async function fetchRealEvents(timeoutMs = 6000): Promise<EventItem[]> {
  const since = new Date(Date.now() - 24 * 3600e3).toISOString();
  const query = supabase().from('events_feed').select('*').or(`ends_at.gte.${since},starts_at.gte.${since}`).order('starts_at').limit(500);
  const timeout = new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), timeoutMs));
  const { data, error } = await Promise.race([query, timeout]);
  if (error) throw error;
  return (data as FeedRow[]).map(mapFeedRow);
}

export function createSupabaseSource(): DataSource {
  const demo = createDemoSource();
  return {
    ...demo,
    kind: 'supabase',
    getEvents: async () => mergeEvents(demoEvents(), await fetchRealEvents()),
  };
}
