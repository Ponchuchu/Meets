// Настоящая база для альфы v6 (ALPHA §0): только Supabase, без демо-подстановок. Ошибки уходят на экран.
import { supabase, withTimeout } from '../data/client';
import { isLongEvent } from '../data/seed';
import type { Category, EventItem } from '../data/types';
import { myId } from './auth';
import { setOutboxSender } from './outbox';

const sb = () => supabase();

async function must<T>(p: PromiseLike<{ data: T | null; error: { message: string } | null }>, ms = 8000): Promise<T> {
  const { data, error } = await withTimeout(p, ms);
  if (error) throw new Error(error.message);
  return data as T;
}

export function me(): string {
  const id = myId();
  if (!id) throw new Error('auth: нет входа');
  return id;
}

// ——— Профиль ———

export interface Profile {
  id: string;
  name: string;
  handle: string | null;
  photo_url: string | null;
  about: string | null;
}

export async function getProfile(id = me()): Promise<Profile | null> {
  return must(sb().from('profiles').select('id,name,handle,photo_url,about').eq('id', id).maybeSingle());
}

export async function saveProfile(patch: Partial<Omit<Profile, 'id'>>): Promise<void> {
  await must(sb().from('profiles').upsert({ id: me(), name: patch.name ?? 'Без имени', ...patch }));
}

export async function uploadAvatar(uri: string): Promise<string> {
  const blob = await (await fetch(uri)).blob();
  const path = `${me()}/avatar-${Date.now()}.jpg`;
  const { error } = await sb().storage.from('avatars').upload(path, blob, { contentType: 'image/jpeg', upsert: true });
  if (error) throw new Error(error.message);
  const url = sb().storage.from('avatars').getPublicUrl(path).data.publicUrl;
  await saveProfile({ photo_url: url });
  return url;
}

export async function isStaff(): Promise<boolean> {
  return must(sb().rpc('is_staff'));
}

// ——— Настройки (ключ/значение) — сохраняются сразу, без кнопки ———

export type Settings = Record<string, unknown>;

export async function getSettings(): Promise<Settings> {
  const rows = await must(sb().from('profile_settings').select('key,value').eq('user_id', me()));
  return Object.fromEntries((rows as { key: string; value: unknown }[]).map((r) => [r.key, r.value]));
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  await must(sb().from('profile_settings').upsert({ user_id: me(), key, value, updated_at: new Date().toISOString() }));
}

export async function saveTaste(interests: string[]): Promise<void> {
  await must(sb().from('start_answers').upsert({ user_id: me(), interests, updated_at: new Date().toISOString() }));
}

// ——— Кто видит, где я ———

export interface Visibility {
  mode: 'all' | 'except' | 'only';
  list: string[];
  invisible_until: string | null;
  district_only: boolean;
  statuses: boolean;
}
export const DEFAULT_VISIBILITY: Visibility = { mode: 'all', list: [], invisible_until: null, district_only: false, statuses: true };

export async function getVisibility(): Promise<Visibility> {
  const row = await must(sb().from('visibility').select('mode,list,invisible_until,district_only,statuses').eq('user_id', me()).maybeSingle());
  return (row as Visibility | null) ?? DEFAULT_VISIBILITY;
}

export async function setVisibility(patch: Partial<Visibility>): Promise<void> {
  const cur = await getVisibility();
  await must(sb().from('visibility').upsert({ user_id: me(), ...cur, ...patch, updated_at: new Date().toISOString() }));
}

// ——— Друзья ———

export interface Friend extends Profile { since: string }

export async function getFriends(): Promise<Friend[]> {
  const id = me();
  const rows = await must(sb().from('friendships').select('a,b,created_at').or(`a.eq.${id},b.eq.${id}`)) as { a: string; b: string; created_at: string }[];
  const ids = rows.map((r) => (r.a === id ? r.b : r.a));
  if (!ids.length) return [];
  const profs = await must(sb().from('profiles').select('id,name,handle,photo_url,about').in('id', ids)) as Profile[];
  return profs.map((p) => ({ ...p, since: rows.find((r) => r.a === p.id || r.b === p.id)!.created_at }));
}

export async function removeFriend(friendId: string): Promise<void> {
  const id = me();
  const [a, b] = id < friendId ? [id, friendId] : [friendId, id];
  await must(sb().from('friendships').delete().eq('a', a).eq('b', b));
}

export async function findByHandle(q: string): Promise<Profile[]> {
  const h = q.replace(/^@/, '').trim().toLowerCase();
  if (h.length < 2) return [];
  return must(sb().from('profiles').select('id,name,handle,photo_url,about').ilike('handle', `${h}%`).neq('id', me()).limit(10));
}

/** Заявка в друзья. Встречная заявка уже есть — дружба сразу (триггер в базе). */
export async function requestFriend(to: string, note?: string): Promise<void> {
  await must(sb().from('friend_requests').upsert({ from_id: me(), to_id: to, note: note ?? null, status: 'pending' }));
}

export async function answerFriend(from: string, accept: boolean): Promise<void> {
  await must(sb().from('friend_requests').update({ status: accept ? 'accepted' : 'declined' }).eq('from_id', from).eq('to_id', me()));
}

export async function getFriendRequests(): Promise<(Profile & { note: string | null })[]> {
  const rows = await must(sb().from('friend_requests').select('from_id,note').eq('to_id', me()).eq('status', 'pending')) as { from_id: string; note: string | null }[];
  if (!rows.length) return [];
  const profs = await must(sb().from('profiles').select('id,name,handle,photo_url,about').in('id', rows.map((r) => r.from_id))) as Profile[];
  return profs.map((p) => ({ ...p, note: rows.find((r) => r.from_id === p.id)?.note ?? null }));
}

// ——— Точки друзей ———

export interface FriendPoint {
  user_id: string;
  lat: number | null;
  lon: number | null;
  speed: number | null;
  heading: number | null;
  updated_at: string;
  district: string | null;
  status: string | null;
}

export async function getFriendPoints(): Promise<FriendPoint[]> {
  return must(sb().rpc('friend_locations'));
}

export async function getTrail(friendId: string): Promise<{ lat: number; lon: number; at: string }[]> {
  return must(sb().rpc('friend_trail', { friend: friendId }));
}

// ——— События ———

interface LiveRow {
  id: string; external_id: string | null; title: string; category: string; tags: string[] | null;
  starts_at: string; ends_at: string | null; is_long: boolean;
  venue_id: string | null; venue_name: string | null; venue_kind: string | null;
  address: string | null; address_note: string | null; lat: number | null; lon: number | null; needs_pin: boolean;
  price_min: number | null; price_max: number | null; is_free: boolean; about: string | null; organizer: string | null;
  cover_url: string | null; source_url: string | null; visibility: 'public' | 'friends';
}

export function mapLive(r: LiveRow): EventItem {
  return {
    id: r.id, title: r.title, category: r.category as Category, tags: r.tags ?? [],
    startsAt: r.starts_at, endsAt: r.ends_at, isLong: r.is_long || isLongEvent(r.starts_at, r.ends_at),
    venueName: r.venue_name, address: r.address ?? '', addressNote: r.address_note ?? undefined,
    lat: r.lat ?? 43.2389, lon: r.lon ?? 76.8897, needsPin: r.needs_pin || r.lat == null,
    priceMin: r.price_min, priceMax: r.price_max, isFree: r.is_free, about: r.about ?? '', organizer: r.organizer,
    sourceUrl: r.source_url, cover: r.cover_url, visibility: r.visibility, origin: 'real',
    friendsGoing: [], lookingCount: 0, goingCount: 0,
  };
}

/** Одобренные события, которые ещё не закончились (до `days` дней вперёд), + кто из друзей идёт и сколько всего. */
export async function getEvents(days = 14): Promise<EventItem[]> {
  const now = Date.now();
  const rows = await must(sb().from('events_live').select('*')
    .or(`ends_at.gte.${new Date(now).toISOString()},and(ends_at.is.null,starts_at.gte.${new Date(now - 3 * 3600e3).toISOString()})`)
    .lte('starts_at', new Date(now + days * 86400e3).toISOString())
    .order('starts_at').limit(500)) as LiveRow[];
  const list = rows.map(mapLive);
  if (!list.length) return list;
  const ids = list.map((e) => e.id);
  const [counts, going] = await Promise.all([
    must(sb().rpc('event_going_counts', { ids })) as Promise<{ event_id: string; going: number; looking: number }[]>,
    must(sb().from('attendance').select('user_id,event_id,status').in('event_id', ids).in('status', ['going', 'arrived'])) as Promise<{ user_id: string; event_id: string }[]>,
  ]);
  const meId = me();
  for (const e of list) {
    const c = counts.find((x) => x.event_id === e.id);
    e.goingCount = c?.going ?? 0;
    e.lookingCount = c?.looking ?? 0;
    e.friendsGoing = going.filter((g) => g.event_id === e.id && g.user_id !== meId).map((g) => g.user_id);
  }
  return list;
}

// ——— Планы: attendance (иду / сохранил / пропустил) ———

export type PlanStatus = 'going' | 'saved' | 'skipped' | 'arrived' | 'cancelled';

export async function getMyAttendance(): Promise<{ event_id: string; status: PlanStatus; at: string }[]> {
  return must(sb().from('attendance').select('event_id,status,at').eq('user_id', me()));
}

export async function setAttendance(eventId: string, status: PlanStatus | null): Promise<void> {
  if (status === null) await must(sb().from('attendance').delete().eq('user_id', me()).eq('event_id', eventId));
  else await must(sb().from('attendance').upsert({ user_id: me(), event_id: eventId, status, at: new Date().toISOString() }));
}

// ——— Очередь отправок: сообщения уходят, когда появится сеть ———
setOutboxSender(async (it) => {
  if (it.kind === 'message') {
    const { error } = await sb().from('messages').insert({ chat_id: it.chatId, author_id: me(), ...it.payload });
    if (error) throw new Error(error.message);
  }
});
