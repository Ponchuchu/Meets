// Реализация на Supabase: события — всем, люди и чаты — после входа (remote.ts). Профиль-хроника пока демо.
import { supabase } from './client';
import { createDemoSource, demoEvents, mergeEvents } from './demo';
import * as remote from './remote';
import { mapFeedRow, type FeedRow } from './feedRow';
import { UUID } from './realtime';
import { rememberDbIds } from './sync';
import type { DataSource, EventItem } from './types';

export { mapFeedRow };

export { supabase };

export async function fetchRealEvents(timeoutMs = 6000): Promise<EventItem[]> {
  const since = new Date(Date.now() - 24 * 3600e3).toISOString();
  const query = supabase().from('events_feed').select('*').or(`ends_at.gte.${since},starts_at.gte.${since}`).order('starts_at').limit(500);
  const timeout = new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), timeoutMs));
  const { data, error } = await Promise.race([query, timeout]);
  if (error) throw error;
  rememberDbIds(data as FeedRow[]);
  return (data as FeedRow[]).map(mapFeedRow);
}

export function createSupabaseSource(): DataSource {
  const demo = createDemoSource();
  return {
    ...demo,
    kind: 'supabase',
    getEvents: async () => mergeEvents(demoEvents(), await fetchRealEvents()),
    getMe: remote.getMe,
    getPeople: remote.getPeople,
    getChats: remote.getChats,
    getMessages: remote.getMessages,
    getFriendRequests: remote.getFriendRequests,
    getFriendSpots: remote.getFriendSpots,
    getForecast: remote.getForecast,
    getPersonDetails: async (id) => (UUID.test(id) ? remote.getPersonDetails(id) : demo.getPersonDetails(id)),
  };
}
