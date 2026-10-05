// Люди, чаты, сообщения, друзья на карте — из Supabase (таблицы из миграции 20260928000002).
// Работает только после входа: без сессии бросает NoSessionError, и слой данных показывает демо.
import { friendLine } from '../live/geo';
import { almaty } from '../lib/clock';
import { DEFAULT_PRIVACY } from '../people/visibility';
import { colors } from '../theme';
import { requireUser, supabase, withTimeout } from './client';
import { fromOpenMeteo, nowFromOpenMeteo, OPEN_METEO_NOW, type DayWeather, type OpenMeteoDaily } from './weather';
import type { Chat, FriendRequest, FriendSpot, Message, MessageKind, Person, PersonDetails } from './types';

const TINTS = [colors.sand, colors.softGreen, colors.softYellow];

export interface ProfileRow {
  id: string;
  name: string;
  photo_url: string | null;
  handle: string | null;
  about?: string | null;
  instagram?: string | null;
  birth_date?: string | null;
  plans_visible?: 'all' | 'friends' | 'nobody';
  who_can_write?: 'all' | 'friends' | 'common';
  achievements_visible?: 'me' | 'friends' | 'all';
}

export interface MessageRow {
  id: string;
  chat_id: string;
  author_id: string | null;
  kind: MessageKind;
  body: string | null;
  media_path: string | null;
  duration_s: number | null;
  event_id?: string | null;
  created_at: string;
}

function ageFrom(birth: string | null | undefined, at: Date): number | undefined {
  if (!birth) return undefined;
  const b = new Date(birth);
  let age = at.getUTCFullYear() - b.getUTCFullYear();
  if (at.getUTCMonth() < b.getUTCMonth() || (at.getUTCMonth() === b.getUTCMonth() && at.getUTCDate() < b.getUTCDate())) age--;
  return age;
}

export function mapProfile(r: ProfileRow, friends: Set<string>, at = new Date()): Person {
  const n = [...r.id].reduce((s, c) => s + c.charCodeAt(0), 0);
  return {
    id: r.id,
    name: r.name,
    age: ageFrom(r.birth_date, at),
    photo: r.photo_url,
    initial: r.name.slice(0, 1).toUpperCase(),
    tint: TINTS[n % TINTS.length],
    isFriend: friends.has(r.id),
    handle: r.handle ?? undefined,
  };
}

export const hhmm = (iso: string) => {
  const d = almaty(iso);
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
};

const secs = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export function mapMessage(r: MessageRow, me: string): Message {
  return {
    id: r.id,
    chatId: r.chat_id,
    authorId: r.author_id === me ? 'me' : (r.author_id ?? 'system'),
    kind: r.kind,
    text: r.body ?? '',
    time: hhmm(r.created_at),
    media: r.media_path,
    duration: r.duration_s != null ? secs(r.duration_s) : undefined,
    eventId: r.event_id ?? undefined,
    sub: r.kind === 'invite' ? 'Позвал(а) тебя · нажми, чтобы открыть' : undefined,
  };
}

/** Друг на карте. Точка уже огрублена сервером до ~50 м (friend_locations). */
export function mapSpot(r: { user_id: string; lat: number; lon: number; speed: number | null; heading: number | null; updated_at: string; status?: string | null }, at = new Date()): FriendSpot {
  const kmh = r.speed != null && r.speed >= 0 ? Math.round(r.speed * 3.6) : undefined;
  const minutes = Math.max(0, Math.round((at.getTime() - new Date(r.updated_at).getTime()) / 60000));
  const moving = r.status === 'moving' || (!!kmh && kmh > 8);
  return {
    personId: r.user_id,
    lat: r.lat,
    lon: r.lon,
    state: minutes > 15 ? 'paused' : moving ? 'moving' : 'here',
    // Статусы альфы (V6 §9): в пути, дома / на работе, «2 мин», давно не в сети.
    place: friendLine(moving ? 'moving' : r.status ?? null, kmh, minutes),
    speedKmh: kmh,
    heading: r.heading ?? undefined,
    minutesAgo: minutes,
  };
}

async function friendIds(me: string): Promise<Set<string>> {
  const { data, error } = await withTimeout(supabase().from('friendships').select('a,b').or(`a.eq.${me},b.eq.${me}`));
  if (error) throw error;
  return new Set((data as { a: string; b: string }[]).map((f) => (f.a === me ? f.b : f.a)));
}

async function profiles(ids: string[]): Promise<ProfileRow[]> {
  if (!ids.length) return [];
  const { data, error } = await withTimeout(supabase().from('profiles').select('id,name,photo_url,handle,birth_date').in('id', ids));
  if (error) throw error;
  return data as ProfileRow[];
}

export async function getMe(): Promise<Person> {
  const me = await requireUser();
  const [row] = await profiles([me]);
  if (!row) throw new Error('no-profile');
  return { ...mapProfile(row, new Set()), id: 'me' };
}

export async function getPeople(): Promise<Person[]> {
  const me = await requireUser();
  const friends = await friendIds(me);
  // Друзья + все, с кем есть общий чат или заявка.
  const [{ data: members }, { data: reqs }] = await Promise.all([
    withTimeout(supabase().from('chat_members').select('user_id').neq('user_id', me)),
    withTimeout(supabase().from('friend_requests').select('from_id').eq('to_id', me).eq('status', 'pending')),
  ]);
  const ids = new Set<string>(friends);
  (members as { user_id: string }[] | null)?.forEach((m) => ids.add(m.user_id));
  (reqs as { from_id: string }[] | null)?.forEach((r) => ids.add(r.from_id));
  return (await profiles([...ids])).map((r) => mapProfile(r, friends));
}

export async function getFriendRequests(): Promise<FriendRequest[]> {
  const me = await requireUser();
  const { data, error } = await withTimeout(supabase().from('friend_requests').select('from_id,note').eq('to_id', me).eq('status', 'pending'));
  if (error) throw error;
  return (data as { from_id: string; note: string | null }[]).map((r) => ({ id: `fr-${r.from_id}`, personId: r.from_id, note: r.note ?? '' }));
}

export async function getFriendSpots(): Promise<FriendSpot[]> {
  await requireUser();
  const { data, error } = await withTimeout(supabase().rpc('friend_locations'));
  if (error) throw error;
  // «Только район» приходит без координат — такого друга на карте не рисуем.
  return (data as (Parameters<typeof mapSpot>[0] & { lat: number | null })[]).filter((r) => r.lat != null && r.lon != null).map((r) => mapSpot(r));
}

export async function getChats(): Promise<Chat[]> {
  const me = await requireUser();
  const { data: mine, error } = await withTimeout(
    supabase().from('chat_members').select('chat_id,last_read_at,chats(id,kind,event_id,meet_point,events(title))').eq('user_id', me),
  );
  if (error) throw error;
  type Row = { chat_id: string; last_read_at: string | null; chats: { id: string; kind: 'direct' | 'event'; event_id: string | null; meet_point: string | null; events: { title: string } | null } };
  const rows = mine as unknown as Row[];
  const ids = rows.map((r) => r.chat_id);
  if (!ids.length) return [];
  const [{ data: members }, { data: last }] = await Promise.all([
    withTimeout(supabase().from('chat_members').select('chat_id,user_id').in('chat_id', ids)),
    withTimeout(supabase().from('messages').select('chat_id,author_id,body,kind,created_at').in('chat_id', ids).order('created_at', { ascending: false }).limit(500)),
  ]);
  const byChat = new Map<string, string[]>();
  (members as { chat_id: string; user_id: string }[] | null)?.forEach((m) => byChat.set(m.chat_id, [...(byChat.get(m.chat_id) ?? []), m.user_id]));
  const people = new Map((await profiles([...new Set([...byChat.values()].flat())])).map((p) => [p.id, p]));
  const msgs = (last as MessageRow[] | null) ?? [];
  return rows.map((r) => {
    const others = (byChat.get(r.chat_id) ?? []).filter((u) => u !== me);
    const own = msgs.filter((m) => m.chat_id === r.chat_id);
    const top = own[0];
    const unread = own.filter((m) => m.author_id !== me && (!r.last_read_at || m.created_at > r.last_read_at)).length;
    const direct = r.chats.kind === 'direct';
    return {
      id: r.chat_id,
      kind: r.chats.kind,
      title: direct ? (people.get(others[0])?.name ?? 'Чат') : (r.chats.events?.title ?? 'Чат события'),
      personId: direct ? others[0] : undefined,
      eventId: r.chats.event_id ?? undefined,
      lastText: top ? (top.body ?? '') : '',
      lastTime: top ? hhmm(top.created_at) : '',
      unread,
      meetPoint: r.chats.meet_point ?? undefined,
      members: direct ? undefined : others.length + 1,
      memberIds: direct ? undefined : others,
    };
  });
}

export async function getMessages(chatId: string): Promise<Message[]> {
  const me = await requireUser();
  const { data, error } = await withTimeout(
    supabase().from('messages').select('id,chat_id,author_id,kind,body,media_path,duration_s,event_id,created_at').eq('chat_id', chatId).order('created_at').limit(300),
  );
  if (error) throw error;
  const rows = data as MessageRow[];
  // Путь в Storage — «<chat>/<файл>»; без «/» — ключ встроенного фото (демо-данные из seed).
  const paths = rows.map((r) => r.media_path).filter((x): x is string => !!x && x.includes('/'));
  const signed = new Map<string, string>();
  if (paths.length) {
    const { data: urls } = await supabase().storage.from('media').createSignedUrls(paths, 3600);
    urls?.forEach((u) => u.path && u.signedUrl && signed.set(u.path, u.signedUrl));
  }
  return rows.map((r) => mapMessage({ ...r, media_path: r.media_path ? (r.media_path.includes('/') ? (signed.get(r.media_path) ?? null) : r.media_path) : null }, me));
}

/** Короткий профиль человека из базы. Подробности (значки, планы) — по мере наполнения таблиц. */
export async function getPersonDetails(id: string): Promise<PersonDetails | null> {
  const me = await requireUser();
  const { data, error } = await withTimeout(supabase().from('profiles').select('*').eq('id', id).maybeSingle());
  if (error) throw error;
  if (!data) return null;
  const r = data as ProfileRow;
  const friends = await friendIds(me);
  return {
    id: r.id,
    about: r.about ?? '',
    interests: [],
    badges: [],
    gallery: r.photo_url ? [r.photo_url] : [],
    online: false,
    instagram: r.instagram ?? undefined,
    commonFriends: [],
    friendsCount: 0,
    commonCount: 0,
    friendIds: [],
    plans: [],
    privacy: { ...DEFAULT_PRIVACY, plansVisible: r.plans_visible ?? 'friends', achievements: r.achievements_visible ?? 'friends' },
    interestKeys: [],
    suggestNote: friends.has(r.id) ? undefined : '',
  };
}

// ——— Запись ———

export async function sendMessage(chatId: string, body: string, kind: MessageKind = 'text', mediaPath?: string, durationS?: number): Promise<void> {
  const me = await requireUser();
  const { error } = await withTimeout(supabase().from('messages').insert({ chat_id: chatId, author_id: me, kind, body, media_path: mediaPath ?? null, duration_s: durationS ?? null }));
  if (error) throw error;
}

/** Открыть личный чат: сервер проверяет правила для незнакомых (общее событие, лимит, 24 часа). */
export async function openDirectChat(personId: string): Promise<string> {
  await requireUser();
  const { data, error } = await withTimeout(supabase().rpc('open_direct_chat', { other: personId }));
  if (error) throw error;
  return data as string;
}

// ——— Медиа: приватный бакет media, путь «<chat_id>/<файл>», читать — по подписанной ссылке ———

export async function uploadMedia(chatId: string, uri: string): Promise<string> {
  const me = await requireUser();
  const blob = await (await fetch(uri)).blob();
  const ext = (blob.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg').replace('quicktime', 'mov');
  const path = `${chatId}/${me}-${Date.now()}.${ext}`;
  const { error } = await withTimeout(supabase().storage.from('media').upload(path, blob, { contentType: blob.type || 'image/jpeg' }), 60000);
  if (error) throw error;
  return path;
}

// ——— Погода: читаем кэш (обновляет Edge Function weather раз в час) ———

export async function getForecast(): Promise<DayWeather[]> {
  const { data, error } = await withTimeout(supabase().from('weather_cache').select('payload,updated_at').eq('city', 'almaty').maybeSingle(), 4000);
  if (error) throw error;
  if (!data) throw new Error('no-weather');
  const d = almaty(new Date());
  return fromOpenMeteo(data.payload as OpenMeteoDaily, d.toISOString().slice(0, 10));
}

export async function getWeatherNow(): Promise<DayWeather> {
  const res = await withTimeout(fetch(OPEN_METEO_NOW), 4000);
  if (!res.ok) throw new Error(`weather ${res.status}`);
  return nowFromOpenMeteo(await res.json());
}
