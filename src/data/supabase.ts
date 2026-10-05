// Реализация на Supabase: события — всем, люди и чаты — после входа (remote.ts). Профиль-хроника пока демо.
import { supabase } from './client';
import { config } from '../lib/config';
import { getEvents as liveEvents, getFriends as liveFriends, getMyAttendance as liveAttendance, getProfile as liveProfile } from '../live/api';
import { createDemoSource, demoEvents, mergeEvents } from './demo';
import * as remote from './remote';
import { mapFeedRow, type FeedRow } from './feedRow';
import { UUID } from './realtime';
import { rememberDbIds } from './sync';
import type { DataSource, EventItem, MyProfile } from './types';

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

/** Альфа (live): профиль без демо-хроники — пусто, пока не накопится своя история (А6). */
async function liveMyProfile(): Promise<MyProfile> {
  const [p, friends, att] = await Promise.all([liveProfile(), liveFriends().catch(() => []), liveAttendance().catch(() => [])]);
  return {
    handle: p?.handle ?? '', instagram: null, about: p?.about ?? '', phoneMasked: '',
    stats: { events: att.filter((a) => a.status === 'going' || a.status === 'arrived').length, friends: friends.length }, visitedCells: [], eventCells: [], districts: [], districtsTotal: 0,
    cities: [], countries: [], timeline: [], nights: [], badgeProgress: {}, invitesToMe: [],
  };
}

export function createSupabaseSource(): DataSource {
  const demo = createDemoSource();
  if (config.dataMode === 'live') {
    // Альфа: только база. Демо-события, демо-заявки и демо-хроника не подставляются (docs/ALPHA.md §0).
    return {
      ...demo,
      kind: 'supabase',
      getEvents: () => liveEvents(),
      getMe: remote.getMe,
      getPeople: remote.getPeople,
      getChats: remote.getChats,
      getChatRequests: async () => [],
      getMessages: remote.getMessages,
      getFriendRequests: remote.getFriendRequests,
      getFriendSpots: remote.getFriendSpots,
      getMySpot: async () => ({ lat: 43.2389, lon: 76.8897 }),
      getMyProfile: liveMyProfile,
      getForecast: remote.getForecast,
      getWeatherNow: remote.getWeatherNow,
      getPersonDetails: async (id) => (UUID.test(id) ? remote.getPersonDetails(id) : null),
    };
  }
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
    getWeatherNow: remote.getWeatherNow,
    getPersonDetails: async (id) => (UUID.test(id) ? remote.getPersonDetails(id) : demo.getPersonDetails(id)),
  };
}
