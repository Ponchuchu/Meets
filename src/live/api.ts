import { useChat } from '../state/chat';
// Настоящая база для альфы v6 (ALPHA §0): только Supabase, без демо-подстановок. Ошибки уходят на экран.
import { readPoint } from './point';
import { supabase, withTimeout } from '../data/client';
import { isLongEvent } from '../data/seed';
import type { Category, EventItem, Message, MessageKind } from '../data/types';
import { myId } from './auth';
import { isNetworkError, setOutboxSender, useOutbox } from './outbox';
import { uploadMedia, sendMessage, editMessage } from '../data/remote';
import { queryClient } from './query';
import { reportDb } from './net';

const sb = () => supabase();

async function must<T>(p: PromiseLike<{ data: T | null; error: { message: string } | null }>, ms = 8000): Promise<T> {
  const { data, error } = await withTimeout(p, ms);
  if (error) throw error;
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
  map_trail?: 'none' | 'dots' | 'comet';
  map_frame?: string;
  map_shape?: string;
  about: string | null;
}

export async function getProfile(id = me()): Promise<Profile | null> {
  return must(sb().from('profiles').select('id,name,handle,photo_url,about,map_frame,map_trail,map_shape').eq('id', id).maybeSingle());
}

export async function saveProfile(patch: Partial<Omit<Profile, 'id'>>): Promise<void> {
  await must(sb().from('profiles').update(patch).eq('id', me()));
}

export async function uploadAvatar(uri: string): Promise<string> {
  const blob = await (await fetch(uri)).arrayBuffer();
  // Имя каждый раз новое, поэтому без upsert: он требует лишних прав и раньше ронял загрузку.
  const path = `${me()}/avatar-${Date.now()}.jpg`;
  const { error } = await withTimeout(sb().storage.from('avatars').upload(path, blob, { contentType: 'image/jpeg' }), 30000);
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
  const profs = await must(sb().from('profiles').select('id,name,handle,photo_url,about,map_frame,map_trail,map_shape').in('id', ids)) as Profile[];
  return profs.map((p) => ({ ...p, since: rows.find((r) => r.a === p.id || r.b === p.id)!.created_at }));
}

/** @public Друзья: экран «Добавить» (FIX1 И7). */
export async function removeFriend(friendId: string): Promise<void> {
  const id = me();
  const [a, b] = id < friendId ? [id, friendId] : [friendId, id];
  await must(sb().from('friendships').delete().eq('a', a).eq('b', b));
}

/** @public Друзья: экран «Добавить» (FIX1 И7). */
export async function findByHandle(q: string): Promise<Profile[]> {
  const h = q.replace(/^@/, '').trim().toLowerCase();
  if (h.length < 2) return [];
  return must(sb().from('profiles').select('id,name,handle,photo_url,about,map_frame,map_trail,map_shape').ilike('handle', `${h}%`).neq('id', me()).limit(10));
}

/** Заявка в друзья. Встречная заявка уже есть — дружба сразу (триггер в базе). */
/** @public Друзья: экран «Добавить» (FIX1 И7). */
export async function requestFriend(to: string, note?: string): Promise<void> {
  await must(sb().rpc('send_friend_request', { other: to, request_note: note ?? null }));
}

export async function cancelFriendRequest(to: string): Promise<void> {
  await must(sb().from('friend_requests').delete().eq('from_id', me()).eq('to_id', to).eq('status', 'pending'));
}

/** @public Друзья: экран «Добавить» (FIX1 И7). */
export async function answerFriend(from: string, accept: boolean): Promise<void> {
  await must(sb().from('friend_requests').update({ status: accept ? 'accepted' : 'declined' }).eq('from_id', from).eq('to_id', me()).select('from_id').single());
}

/** @public Друзья: экран «Добавить» (FIX1 И7). */
export async function getFriendRequests(): Promise<(Profile & { note: string | null })[]> {
  const rows = await must(sb().from('friend_requests').select('from_id,note').eq('to_id', me()).eq('status', 'pending')) as { from_id: string; note: string | null }[];
  if (!rows.length) return [];
  const profs = await must(sb().from('profiles').select('id,name,handle,photo_url,about,map_frame,map_trail,map_shape').in('id', rows.map((r) => r.from_id))) as Profile[];
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

/** @public Друзья: экран «Добавить» (FIX1 И7). */
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
  created_by?: string;
  cover_url: string | null; source_url: string | null; visibility: 'public' | 'friends';
  status?: EventItem['status'];
}

export function mapLive(r: LiveRow): EventItem {
  return {
    id: r.id, createdBy: r.created_by, title: r.title, category: r.category as Category, tags: r.tags ?? [],
    startsAt: r.starts_at, endsAt: r.ends_at, isLong: r.is_long || isLongEvent(r.starts_at, r.ends_at),
    venueId: r.venue_id ?? undefined, venueName: r.venue_name, address: r.address ?? '', addressNote: r.address_note ?? undefined,
    lat: r.lat ?? 43.2389, lon: r.lon ?? 76.8897, needsPin: r.needs_pin || r.lat == null, noPoint: r.lat == null || r.lon == null,
    priceMin: r.price_min, priceMax: r.price_max, isFree: r.is_free, about: r.about ?? '', organizer: r.organizer,
    sourceUrl: r.source_url, cover: r.cover_url, visibility: r.visibility, status: r.status, origin: 'real',
    friendsGoing: [], lookingCount: 0, goingCount: 0,
  };
}

async function withMeetupLocations(events: EventItem[]): Promise<EventItem[]> {
  const ids = events.filter(e => e.visibility === 'friends' || e.createdBy === myId()).map(e => e.id);
  if (!ids.length) return events;
  // Точный адрес возвращает RLS только создателю и принявшим приглашение.
  const rows = await must(sb().from('meetup_locations').select('event_id,address,lat,lon,details').in('event_id', ids)) as {event_id:string;address:string;lat:number;lon:number;details:EventItem['meetup']}[];
  return events.map(e => { const p = rows.find(p => p.event_id === e.id); return p ? {...e, address:p.address,lat:p.lat,lon:p.lon,noPoint:false,needsPin:false,meetup:p.details} : e; });
}

/** Одобренные события, которые ещё не закончились (до `days` дней вперёд), + кто из друзей идёт и сколько всего. */
// Окно — три месяца: в фильтрах карты можно выбрать даты хоть на 2 месяца вперёд.
export async function getEvents(days = 92): Promise<EventItem[]> {
  const now = Date.now();
  const rows = await must(sb().from('events_live').select('*')
    .or(`ends_at.gte.${new Date(now).toISOString()},and(ends_at.is.null,starts_at.gte.${new Date(now - 3 * 3600e3).toISOString()})`)
    .lte('starts_at', new Date(now + days * 86400e3).toISOString())
    .order('starts_at').limit(500)) as LiveRow[];
  const list = await withMeetupLocations(rows.map(mapLive));
  if (!list.length) return list;
  const ids = list.map((e) => e.id);
  // Список id идёт в адрес запроса: порциями по 120, чтобы с ростом афиши не упереться в длину адреса (FIX5).
  const parts: string[][] = [];
  for (let i = 0; i < ids.length; i += 120) parts.push(ids.slice(i, i + 120));
  const [counts, going] = await Promise.all([
    must(sb().rpc('event_going_counts', { ids })) as Promise<{ event_id: string; going: number; looking: number }[]>,
    Promise.all(parts.map((part) => must(sb().from('attendance').select('user_id,event_id,status').in('event_id', part).in('status', ['going', 'arrived'])) as Promise<{ user_id: string; event_id: string }[]>)).then((r) => r.flat()),
  ]);
  const meId = me();
  const countBy = new Map(counts.map((c) => [c.event_id, c]));
  const goingBy = new Map<string, string[]>();
  for (const g of going) if (g.user_id !== meId) goingBy.set(g.event_id, [...(goingBy.get(g.event_id) ?? []), g.user_id]);
  for (const e of list) {
    const c = countBy.get(e.id);
    e.goingCount = c?.going ?? 0;
    e.lookingCount = c?.looking ?? 0;
    e.friendsGoing = goingBy.get(e.id) ?? [];
  }
  return list;
}

// ——— Планы: attendance (иду / сохранил / пропустил) ———

export type PlanStatus = 'going' | 'saved' | 'skipped' | 'arrived' | 'cancelled';

export async function getMyAttendance(): Promise<{ event_id: string; status: PlanStatus; at: string; visit_at?: string | null }[]> {
  return must(sb().from('attendance').select('event_id,status,at,visit_at').eq('user_id', me()));
}

export async function setAttendance(eventId: string, status: PlanStatus | null): Promise<void> {
  if (status === null) await must(sb().from('attendance').delete().eq('user_id', me()).eq('event_id', eventId));
  else await must(sb().from('attendance').upsert({ user_id: me(), event_id: eventId, status, at: new Date().toISOString() }));
}

// ——— Очередь отправок: сообщения уходят, когда появится сеть ———
setOutboxSender(async (it) => {
  if (it.kind === 'edit') {
    try { await editMessage(String(it.payload.message_id), String(it.payload.body ?? '')); }
    catch (e) { if (!isNetworkError(e)) void queryClient.invalidateQueries({ queryKey: ['messages', it.chatId] }); throw e; }
    void queryClient.invalidateQueries({ queryKey: ['chats'] });
    return;
  }
  if (it.kind === 'message') {
    const owner = me();
    if (owner !== (it.ownerId ?? it.payload.owner)) throw new Error('auth: очередь другого аккаунта');
    const { local_uri: localUri, local_media, owner: _owner, ...payload } = it.payload;
    const local_uri = localUri ?? local_media;
    if (!payload.media_path && typeof local_uri === 'string') {
      payload.media_path = await uploadMedia(it.chatId, local_uri, payload.kind as MessageKind);
      useChat.getState().updateMessage(it.id, { uploadedPath: String(payload.media_path) });
      useOutbox.getState().updatePayload(it.id, payload);
    }
    if (me() !== owner) throw new Error('auth: аккаунт изменился');
    await sendMessage(it.chatId, String(payload.body ?? ''), payload.kind as MessageKind, payload.media_path as string | undefined, payload.duration_s as number | undefined, payload.event_id as string | undefined, it.id, (payload.reply_to as string | undefined) ?? undefined);
    const local = useChat.getState().sent.find(m => m.id === it.id);
    if (local) queryClient.setQueryData<Message[]>(['messages', it.chatId], (old = []) => old.some(m => m.id === it.id) ? old : [...old, { ...local, delivery: undefined }]);
    useChat.getState().unsend(it.id);
    void queryClient.invalidateQueries({ queryKey: ['messages', it.chatId] });
    void queryClient.invalidateQueries({ queryKey: ['chats'] });
  }
});

// ——— ТРЦ (V6Venue): пины из venues.kind = 'mall', сеансы кино — если есть в базе ———

export interface Mall { id: string; name: string; address: string | null; hours: string | null; cover: string | null; lat: number; lon: number;
  /** Место из справочника Overture (cafe, bar, park…). Нет — площадка из venues (ТРЦ с сеансами). */
  kind?: string }

/** Места справочника в кадре карты (docs/MAP-DATA.md). */

export async function getMalls(): Promise<Mall[]> {
  const rows = await must(sb().from('venues').select('id,name,address,hours,cover_url,geog').eq('kind', 'mall').limit(100)) as
    { id: string; name: string; address: string | null; hours: unknown; cover_url: string | null; geog: unknown }[];
  return rows.map(r => ({ ...r, point: readPoint(r.geog) })).filter(r => r.point).map((r) => ({
    id: r.id, name: r.name, address: r.address, cover: r.cover_url,
    hours: typeof r.hours === 'string' ? r.hours : null,
    lon: r.point!.lon, lat: r.point!.lat,
  }));
}

export interface Session { id: string; title: string; starts_at: string; hall: string | null; format: string | null; price_from: number | null }

export async function getSessions(venueId: string): Promise<Session[]> {
  const rows = await must(sb().from('cinema_sessions').select('id,starts_at,hall,format,price_from,cinema_films(title)')
    .eq('venue_id', venueId).gte('starts_at', new Date().toISOString()).order('starts_at').limit(30)) as unknown as
    { id: string; starts_at: string; hall: string | null; format: string | null; price_from: number | null; cinema_films: { title: string } | null }[];
  return rows.map((r) => ({ id: r.id, title: r.cinema_films?.title ?? 'Сеанс', starts_at: r.starts_at, hall: r.hall, format: r.format, price_from: r.price_from }));
}

// ——— Позвать (V3.md invite): приглашение в «Планы» друга + карточка в личный чат, ответ виден обоим ———

export interface Invite { id: string; from_id: string; to_id: string; event_id: string | null; own_place: string | null; answer: 'yes' | 'no' | null; created_at: string }

export async function getInvites(): Promise<Invite[]> {
  const id = me();
  return must(sb().from('invites').select('id,from_id,to_id,event_id,own_place,answer,created_at').or(`from_id.eq.${id},to_id.eq.${id}`)
    .gte('created_at', new Date(Date.now() - 30 * 86400e3).toISOString()).order('created_at', { ascending: false }).limit(200));
}

export async function sendInvite(eventId: string, title: string, friendIds: string[]): Promise<void> {
  const from = me();
  await must(sb().from('invites').insert(friendIds.map((to) => ({ from_id: from, to_id: to, event_id: eventId }))));
  // Карточка в личный чат: сервер открывает (или находит) чат с другом.
  for (const to of friendIds) {
    const chat = await must(sb().rpc('open_direct_chat', { other: to })) as string;
    await must(sb().from('messages').insert({ chat_id: chat, author_id: from, kind: 'invite', body: title, event_id: eventId }));
  }
}

export async function answerInvite(inv: Invite, yes: boolean): Promise<void> {
  await must(sb().from('invites').update({ answer: yes ? 'yes' : 'no' }).eq('id', inv.id));
  if (yes && inv.event_id) await setAttendance(inv.event_id, 'going');
  const chat = await must(sb().rpc('open_direct_chat', { other: inv.from_id })) as string;
  await must(sb().from('messages').insert({ chat_id: chat, author_id: me(), kind: 'text', body: yes ? 'Иду ✓' : 'Не смогу' }));
}

/** События по id (для «Были» в Планах и приглашений на дальние даты). */
export async function getEventsByIds(ids: string[]): Promise<EventItem[]> {
  if (!ids.length) return [];
  const rows = await must(sb().from('events_for_plans').select('*').in('id', ids.slice(0, 200))) as LiveRow[];
  return withMeetupLocations(rows.map(mapLive));
}

// ——— Маршрут (функция route: TomTom с пробками) ———

export interface Leg { min: number; km: number; delayMin?: number; line?: [number, number][]; instructions?: { message: string; lat: number; lon: number; distance: number }[] }
export async function getRoute(from: { lat: number; lon: number }, to: { lat: number; lon: number }): Promise<{ car: Leg | null; walk: Leg | null }> {
  const { data, error } = await withTimeout(sb().functions.invoke('route', { body: { from, to } }), 12000);
  if (error) throw new Error(error.message);
  return data as { car: Leg | null; walk: Leg | null };
}

// ——— Кто идёт и «ищу компанию» (V6CardPeople) ———

export interface Looker { id: string; name: string; photo_url: string | null; note: string | null; friend: boolean }

/** Друзья, которые идут (RLS attendance — только друзья), и кто ищет компанию на это событие. */
export async function getWhoGoes(eventId: string): Promise<{ friends: Profile[]; lookers: Looker[]; iLook: boolean }> {
  const id = me();
  const [att, look] = await Promise.all([
    must(sb().from('attendance').select('user_id').eq('event_id', eventId).in('status', ['going', 'arrived']).neq('user_id', id)) as Promise<{ user_id: string }[]>,
    must(sb().from('company_requests').select('user_id,note').eq('event_id', eventId)) as Promise<{ user_id: string; note: string | null }[]>,
  ]);
  const ids = [...new Set([...att.map((a) => a.user_id), ...look.map((l) => l.user_id)])].filter((x) => x !== id);
  const profs = ids.length ? await must(sb().from('profiles').select('id,name,handle,photo_url,about,map_frame,map_trail,map_shape').in('id', ids)) as Profile[] : [];
  const friendIds = new Set(att.map((a) => a.user_id));
  return {
    friends: profs.filter((p) => friendIds.has(p.id)),
    lookers: look.filter((l) => l.user_id !== id).map((l) => {
      const p = profs.find((x) => x.id === l.user_id);
      return { id: l.user_id, name: p?.name ?? 'Кто-то', photo_url: p?.photo_url ?? null, note: l.note, friend: friendIds.has(l.user_id) };
    }),
    iLook: look.some((l) => l.user_id === id),
  };
}

export async function setLooking(eventId: string, on: boolean): Promise<void> {
  if (on) await must(sb().from('company_requests').upsert({ user_id: me(), event_id: eventId }));
  else await must(sb().from('company_requests').delete().eq('user_id', me()).eq('event_id', eventId));
}

/** «Пойдём?»: одно сообщение без медиа (правила для незнакомых проверяет сервер в open_direct_chat). */
export async function askCompany(personId: string, title: string): Promise<void> {
  const chat = await must(sb().rpc('open_direct_chat', { other: personId })) as string;
  await must(sb().from('messages').insert({ chat_id: chat, author_id: me(), kind: 'text', body: `Привет! Тоже ищу компанию на «${title}». Пойдём вместе?` }));
}

// ——— Мой профиль v6 (V6Profile): цифры, «Где я был», уровень, значки, места, панель разработчика ———

export interface MeStats {
  friends: number; events: number; meetings: number;
  points: number; level: number; cells: string[];
  badges: { id: string; name: string; goal: number; how?: string; progress: number; got: boolean }[];
  places: string[]; staff: boolean; drafts: number;
}

const PLACE_RU: Record<string, string> = { home: 'дом', work: 'работа', study: 'учёба', gym: 'зал', dacha: 'дача', other: 'другое' };

export async function getMeStats(): Promise<MeStats> {
  const id = me();
  const q = <T,>(p: PromiseLike<{ data: T | null; error: { message: string } | null }>) => withTimeout(p, 8000).then((r) => r.data).catch(() => null);
  const [fr, att, bumps, lvl, cells, badges, mine, places, staff] = await Promise.all([
    q(sb().from('friendships').select('a', { count: 'exact', head: false }).or(`a.eq.${id},b.eq.${id}`)),
    q(sb().from('attendance').select('event_id,status').eq('user_id', id)),
    q(sb().from('bumps').select('id').or(`a.eq.${id},b.eq.${id}`)),
    q(sb().from('user_level').select('points,level').eq('user_id', id).maybeSingle()),
    q(sb().from('explore_cells').select('h3').eq('user_id', id)),
    q(sb().from('badges').select('id,name,goal,how')),
    q(sb().from('user_badges').select('badge_id,progress,got_at').eq('user_id', id)),
    q(sb().from('user_places').select('kind').eq('user_id', id)),
    q(sb().rpc('is_staff')),
  ]);
  const isStaff = staff === true;
  let drafts = 0;
  if (isStaff) {
    const r = await withTimeout(sb().from('events').select('id', { count: 'exact', head: true }).eq('status', 'draft'), 8000).catch(() => null);
    drafts = r?.count ?? 0;
  }
  const my = (mine as { badge_id: string; progress: number; got_at: string | null }[] | null) ?? [];
  const lv = lvl as { points: number; level: number } | null;
  return {
    friends: (fr as unknown[] | null)?.length ?? 0,
    events: ((att as { status: string }[] | null) ?? []).filter((a) => a.status === 'arrived').length,
    meetings: (bumps as unknown[] | null)?.length ?? 0,
    points: lv?.points ?? 0, level: lv?.level ?? 1,
    cells: ((cells as { h3: string }[] | null) ?? []).map((c) => c.h3),
    badges: ((badges as { id: string; name: string; goal: number; how: string }[] | null) ?? []).map((b) => {
      const m = my.find((x) => x.badge_id === b.id);
      return { ...b, progress: m?.progress ?? 0, got: !!m?.got_at };
    }),
    places: [...new Set(((places as { kind: string }[] | null) ?? []).map((p) => PLACE_RU[p.kind] ?? p.kind))],
    staff: isStaff, drafts,
  };
}

/** «Повторить» на плашке «Нет связи с сервером»: лёгкий запрос к базе (select 1). */
export async function pingDb(): Promise<boolean> {
  try {
    const { error } = await withTimeout(sb().from('events_live').select('id').limit(1));
    if (error) throw error;
    reportDb(true);
    return true;
  } catch {
    return false;
  }
}

// ——— Балл пробок (функция traffic-score раз в 10 минут) ———

export interface TrafficScore { score: number; at: string; points: { name: string; lat: number; lon: number }[] }

export async function getTrafficScore(): Promise<TrafficScore | null> {
  const { data } = await sb().from('traffic_score').select('score,at,points').eq('id', 1).maybeSingle();
  return (data as TrafficScore | null) ?? null;
}

export async function createMeetup(e: EventItem): Promise<string> {
  return must(sb().rpc('create_friend_meetup', { payload: { request_key: e.id, title: e.title, category: e.category, starts_at: e.startsAt, address: e.address, about: e.about, lat: e.lat, lon: e.lon, invited: e.meetup?.invited ?? [], details:e.meetup } }));
}

export async function createFriendGroup(title: string, friends: string[], photoUri?: string | null): Promise<string> {
  const chat = await must(sb().rpc('create_friend_group', { group_title: title, friends })) as string;
  // Фото — после создания: не загрузилось — группа всё равно есть, фото можно поставить позже.
  if (photoUri) await setGroupPhoto(chat, photoUri).catch(() => undefined);
  return chat;
}

export async function setGroupPhoto(chat: string, uri: string): Promise<string> {
  const blob = await (await fetch(uri)).arrayBuffer();
  const path = `${me()}/group-${chat}-${Date.now()}.jpg`;
  const { error } = await withTimeout(sb().storage.from('avatars').upload(path, blob, { contentType: 'image/jpeg' }), 30000);
  if (error) throw new Error(error.message);
  const url = sb().storage.from('avatars').getPublicUrl(path).data.publicUrl;
  await must(sb().rpc('set_group_photo', { chat, url }));
  return url;
}

export async function resetUserTaste(userId: string): Promise<void> {
  await must(sb().rpc('reset_user_taste', { target_user: userId }));
}

export async function toggleEventReminder(eventId:string):Promise<void>{
 const plans=(await import('../state/plans')).usePlans;
 const old=!!plans.getState().muted[eventId];plans.getState().toggleReminder(eventId);
 try{await setSetting('muted_events',Object.keys(plans.getState().muted));}catch(e){if(!!plans.getState().muted[eventId]!==old)plans.getState().toggleReminder(eventId);throw e;}
}

export async function chooseEventVisit(eventId: string, at: string): Promise<void> { await must(sb().rpc('choose_event_visit', { event: eventId, visit: at })); }
export async function rescheduleMeetup(eventId: string, at: string): Promise<void> { await must(sb().rpc('reschedule_meetup', { event: eventId, new_start: at })); }
