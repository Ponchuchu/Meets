// Люди, чаты, сообщения, друзья на карте — из Supabase (таблицы из миграции 20260928000002).
// Работает только после входа: без сессии бросает NoSessionError, и слой данных показывает демо.
import { File } from 'expo-file-system';
import { fetch as nativeFetch } from 'expo/fetch';
import { Platform } from 'react-native';
import { friendLine } from '../live/geo';
import { config } from '../lib/config';
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
  map_trail?: 'none' | 'dots' | 'comet';
  map_frame?: string;
  map_shape?: string;
  handle: string | null;
  about?: string | null;
  instagram?: string | null;
  birth_date?: string | null;
  plans_visible?: 'all' | 'friends' | 'nobody';
  who_can_write?: 'all' | 'friends' | 'common';
  achievements_visible?: 'me' | 'friends' | 'all';
}

export interface MessageRow {
  client_key?: string | null;
  edited_at?: string | null;
  id: string;
  chat_id: string;
  author_id: string | null;
  kind: MessageKind;
  body: string | null;
  media_path: string | null;
  duration_s: number | null;
  event_id?: string | null;
  reply_to?: string | null;
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
    photo: r.photo_url, mapFrame: r.map_frame, mapShape: r.map_shape, mapTrail: r.map_trail,
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
    chatId: r.chat_id, clientKey: r.client_key ?? undefined,
    authorId: r.author_id === me ? 'me' : (r.author_id ?? 'system'),
    kind: r.kind,
    text: r.body ?? '',
    time: hhmm(r.created_at),
    createdAt: r.created_at,
    media: r.media_path,
    duration: r.duration_s != null ? secs(r.duration_s) : undefined,
    eventId: r.event_id ?? undefined,
    replyTo: r.reply_to ?? undefined,
    editedAt: r.edited_at ?? undefined,
    sub: r.kind === 'invite' ? r.author_id === me ? 'Ты пригласил · нажми, чтобы открыть' : 'Приглашает тебя · нажми, чтобы открыть' : undefined,
  };
}

/** Друг на карте. Точка уже огрублена сервером до ~50 м (friend_locations). */
export function mapSpot(r: { user_id: string; lat: number; lon: number; speed: number | null; heading: number | null; updated_at: string; status?: string | null; battery?: number | null; charging?: boolean | null }, at = new Date()): FriendSpot {
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
    battery: r.battery ?? undefined,
    charging: r.charging ?? undefined,
  };
}

async function friendIds(me: string): Promise<Set<string>> {
  const { data, error } = await withTimeout(supabase().from('friendships').select('a,b').or(`a.eq.${me},b.eq.${me}`));
  if (error) throw error;
  return new Set((data as { a: string; b: string }[]).map((f) => (f.a === me ? f.b : f.a)));
}

async function profiles(ids: string[]): Promise<ProfileRow[]> {
  if (!ids.length) return [];
  const { data, error } = await withTimeout(supabase().from('profiles').select('id,name,photo_url,handle,birth_date,map_frame,map_trail,map_shape').in('id', ids));
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
  const [{ data: members, error: membersError }, { data: reqs, error: requestsError }] = await Promise.all([
    withTimeout(supabase().from('chat_members').select('user_id').neq('user_id', me)),
    withTimeout(supabase().from('friend_requests').select('from_id,to_id').or(`from_id.eq.${me},to_id.eq.${me}`).eq('status', 'pending')),
  ]);
  if (membersError) throw membersError;
  if (requestsError) throw requestsError;
  const ids = new Set<string>(friends);
  (members as { user_id: string }[] | null)?.forEach((m) => ids.add(m.user_id));
  (reqs as { from_id: string; to_id: string }[] | null)?.forEach((r) => ids.add(r.from_id === me ? r.to_id : r.from_id));
  return (await profiles([...ids])).map((r) => mapProfile(r, friends));
}

export async function getFriendRequests(): Promise<FriendRequest[]> {
  const me = await requireUser();
  const { data, error } = await withTimeout(supabase().from('friend_requests').select('from_id,note').eq('to_id', me).eq('status', 'pending'));
  if (error) throw error;
  const rows = data as { from_id: string; note: string | null }[];
  const senders = await profiles(rows.map(r => r.from_id));
  return rows.map((r) => {
    const sender = senders.find(p => p.id === r.from_id);
    return { id: `fr-${r.from_id}`, personId: r.from_id, note: r.note ?? '', ...(sender ? { person: mapProfile(sender, new Set<string>()) } : {}) };
  });
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
  // Фото группы (миграция 39): пока сервер без колонки — читаем без неё, список чатов не ломается.
  const pick = (withPhoto: boolean) => withTimeout(
    supabase().from('chat_members').select(`chat_id,last_read_at,chats(id,kind,title,event_id,meet_point,${withPhoto ? 'photo_url,' : ''}events(title))`).eq('user_id', me),
  );
  let { data: mine, error } = await pick(true);
  if (error && /photo_url/.test(error.message)) ({ data: mine, error } = await pick(false));
  if (error) throw error;
  type Row = { chat_id: string; last_read_at: string | null; chats: { id: string; kind: 'direct' | 'event' | 'group'; title: string | null; event_id: string | null; meet_point: string | null; photo_url?: string | null; events: { title: string } | null } };
  const rows = mine as unknown as Row[];
  const ids = rows.map((r) => r.chat_id);
  if (!ids.length) return [];
  const [memberResult, lastResult] = await Promise.all([
    withTimeout(supabase().from('chat_members').select('chat_id,user_id,last_read_at').in('chat_id', ids)),
    withTimeout(supabase().rpc('my_chat_summaries')),
  ]);
  if (memberResult.error) throw memberResult.error;
  if (lastResult.error) throw lastResult.error;
  const members = memberResult.data, last = lastResult.data;
  const byChat = new Map<string, string[]>();
  const readBy = new Map<string, string>();
  (members as { chat_id: string; user_id: string; last_read_at?: string | null }[] | null)?.forEach((m) => {
    byChat.set(m.chat_id, [...(byChat.get(m.chat_id) ?? []), m.user_id]);
    if (m.user_id !== me && m.last_read_at && Date.parse(m.last_read_at) > Date.parse(readBy.get(m.chat_id) ?? '1970-01-01')) readBy.set(m.chat_id, m.last_read_at);
  });
  const people = new Map((await profiles([...new Set([...byChat.values()].flat())])).map((p) => [p.id, p]));
  const msgs = (last as (MessageRow & { unread: number })[] | null) ?? [];
  return rows.map((r) => {
    const others = (byChat.get(r.chat_id) ?? []).filter((u) => u !== me);
    const own = msgs.filter((m) => m.chat_id === r.chat_id);
    // Группа без сообщений приходит строкой с пустым сообщением (left join): раньше hhmm(null) падал,
    // и пропадал весь список чатов — новая группа «не появлялась», а личный чат открывался как чужой (FIX5).
    const unread = Number(own[0]?.unread ?? 0);
    const top = own.find((m) => !!m.created_at);
    const direct = r.chats.kind === 'direct';
    return {
      id: r.chat_id,
      kind: r.chats.kind,
      title: direct ? (people.get(others[0])?.name ?? 'Чат') : (r.chats.title ?? r.chats.events?.title ?? 'Чат события'),
      personId: direct ? others[0] : undefined,
      eventId: r.chats.event_id ?? undefined,
      lastText: top ? (top.body ?? '') : '',
      lastTime: top ? hhmm(top.created_at) : '',
      lastKind: top?.kind,
      lastMine: top ? top.author_id === me : undefined,
      unread,
      meetPoint: r.chats.meet_point ?? undefined,
      photo: r.chats.photo_url ?? undefined,
      members: direct ? undefined : others.length + 1,
      memberIds: direct ? undefined : others,
      readUpTo: readBy.get(r.chat_id),
      lastAt: top?.created_at,
    };
  });
}

export async function getMessages(chatId: string, before?: { at: string; id: string }, attachment?: 'media' | 'voice' | 'links'): Promise<Message[]> {
  const me = await requireUser();
  let query = supabase().from('messages').select('*').eq('chat_id', chatId).order('created_at', { ascending: false }).order('id', { ascending: false }).limit(100);
  if (before) query = query.or(`created_at.lt.${before.at},and(created_at.eq.${before.at},id.lt.${before.id})`);
  if (attachment === 'media') query = query.in('kind', ['photo', 'video', 'circle']);
  if (attachment === 'voice') query = query.eq('kind', 'voice');
  if (attachment === 'links') query = query.ilike('body', '%http%');
  const { data, error } = await withTimeout(query);
  if (error) throw error;
  const rows = (data as MessageRow[]).reverse();
  return resolveMessages(rows, me);
}

export async function resolveMessages(rows: MessageRow[], me: string): Promise<Message[]> {
  // Путь в Storage — «<chat>/<файл>»; без «/» — ключ встроенного фото (демо-данные из seed).
  const paths = rows.map((r) => r.media_path).filter((x): x is string => !!x && x.includes('/'));
  const signed = new Map<string, string>();
  if (paths.length) {
    const { data: urls, error } = await withTimeout(supabase().storage.from('media').createSignedUrls([...new Set(paths)], 3600));
    if (error) throw error;
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
  const [friends, card, mine] = await Promise.all([friendIds(me), personCard(id), withTimeout(supabase().from('profiles').select('tags').eq('id', me).maybeSingle()).then((x) => x.data as { tags?: string[] } | null).catch(() => null)]);
  const myTags = mine?.tags ?? [];
  const seen = card?.seen_at ? seenText(card.seen_at) : null;
  return {
    id: r.id,
      person: mapProfile(r, friends),
    about: r.about ?? '',
    // Интересы в профиле (миграция 46) — что человек сам показал; «общие» — совпадают с моими.
    interests: ((r as { tags?: string[] }).tags ?? []).map((label) => ({ label, common: myTags.includes(label) })),
    badges: [],
    // Все фото профиля (миграция 48): главное + до 5 ещё.
    gallery: [...(r.photo_url ? [r.photo_url] : []), ...(((r as { photos?: string[] | null }).photos ?? []).filter((x) => x !== r.photo_url))],
    birthday: friends.has(r.id) && r.birth_date ? r.birth_date.slice(5, 10) : undefined,
    online: seen?.online ?? false,
    lastSeen: seen?.text,
    seenAt: card?.seen_at ?? undefined,
    device: card?.device === 'ios' || card?.device === 'android' ? card.device : undefined,
    status: (r as { status_line?: string | null }).status_line ?? undefined,
    stepsToday: card?.steps_today ?? undefined,
    memoriesCount: card?.memories_count ?? undefined,
    frame: card?.frame ?? (r as { map_frame?: string | null }).map_frame ?? null,
    shape: card?.shape ?? (r as { map_shape?: string | null }).map_shape ?? null,
    photo: r.photo_url,
    instagram: r.instagram ?? undefined,
    commonFriends: card?.common_ids ?? [],
    friendsCount: card?.friends_count ?? 0,
    commonCount: card?.common_count ?? 0,
    friendIds: card?.common_ids ?? [],
    plans: [],
    privacy: { ...DEFAULT_PRIVACY, plansVisible: r.plans_visible ?? 'friends', achievements: r.achievements_visible ?? 'friends' },
    interestKeys: [],
    suggestNote: friends.has(r.id) ? undefined : '',
  };
}

interface PersonCardRow { friends_count: number; common_count: number; common_ids: string[]; seen_at: string | null; steps_today: number | null; memories_count: number | null; frame: string | null; shape: string | null; device?: string | null }
/** Сводка для страницы друга (миграция 35). Нет функции на сервере — страница просто без этих цифр. */
async function personCard(id: string): Promise<PersonCardRow | null> {
  try {
    const { data, error } = await withTimeout(supabase().rpc('person_card', { p: id }));
    if (error) return null;
    return ((data as PersonCardRow[] | null) ?? [])[0] ?? null;
  } catch { return null; }
}

/** «в сети» — заходил за последние 2 минуты; иначе «был 5 мин назад», «был в 14:20», «был вчера», «был 3 окт.». */
export function seenText(at: string, now = Date.now()): { online: boolean; text: string } {
  const t = Date.parse(at);
  if (!Number.isFinite(t)) return { online: false, text: 'был недавно' };
  const min = Math.floor((now - t) / 60000);
  if (min < 2) return { online: true, text: 'в сети' };
  if (min < 60) return { online: false, text: `был ${min} мин назад` };
  const day = (x: number) => new Date(x + 5 * 3600e3).toISOString().slice(0, 10);
  const hm = new Date(t + 5 * 3600e3).toISOString().slice(11, 16);
  if (day(t) === day(now)) return { online: false, text: `был в ${hm}` };
  if (day(t) === day(now - 86400e3)) return { online: false, text: `был вчера в ${hm}` };
  const d = new Date(t + 5 * 3600e3);
  const MON = ['янв.', 'февр.', 'марта', 'апр.', 'мая', 'июня', 'июля', 'авг.', 'сент.', 'окт.', 'нояб.', 'дек.'];
  return { online: false, text: `был ${d.getUTCDate()} ${MON[d.getUTCMonth()]}` };
}

/** Отметка «я в приложении» — раз в минуту, пока оно открыто. */
export async function touchPresence(): Promise<void> {
  // С устройством (миграция 46); база ещё без неё — прежний вызов, чтобы «в сети» не пропадало.
  const dev = Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : 'web';
  const { error } = await withTimeout(supabase().rpc('touch_presence', { dev }), 5000);
  if (error) await withTimeout(supabase().rpc('touch_presence'), 5000);
}

// ——— Запись ———

export async function sendMessage(chatId: string, body: string, kind: MessageKind = 'text', mediaPath?: string, durationS?: number, eventId?: string, messageId?: string, replyTo?: string): Promise<void> {
  const me = await requireUser();
  const { error } = await withTimeout(supabase().from('messages').insert({ ...(messageId ? { id: messageId } : {}), chat_id: chatId, author_id: me, kind, body, media_path: mediaPath ?? null, duration_s: durationS ?? null, event_id: eventId ?? null, ...(replyTo ? { reply_to: replyTo } : {}) }));
  // Повтор после потерянного ответа: сервер уже сохранил это сообщение (409 / 23505) — это успех, а не «Не отправилось».
  if (error && messageId) {
    const check = await withTimeout(supabase().from('messages').select('id').eq('id', messageId).eq('chat_id', chatId).eq('author_id', me).maybeSingle());
    if (!check.error && check.data) return;
  }
  if (error) throw error;
}

/** Исправить свой текст (до 48 часов после отправки — проверяет сервер, миграция 34). */
export async function editMessage(id: string, body: string): Promise<void> {
  await requireUser();
  const { error } = await withTimeout(supabase().from('messages').update({ body }).eq('id', id));
  if (error) throw error;
}

export async function markChatRead(chatId: string, at: string): Promise<void> {
  await requireUser();
  const { error } = await withTimeout(supabase().rpc('mark_chat_read', { p_chat: chatId, p_seen: at }));
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

let uploadQueue: Promise<unknown> = Promise.resolve();
export function uploadMedia(chatId: string, uri: string, kind?: MessageKind): Promise<string> {
  const result = uploadQueue.then(() => uploadOneMedia(chatId, uri, kind));
  uploadQueue = result.catch(() => undefined);
  return result;
}

async function uploadOneMedia(chatId: string, uri: string, kind?: MessageKind): Promise<string> {
  const me = await requireUser();
  const ext = /\.(mp4|m4a|aac|mov|png|webp|jpg|jpeg)(?:[?#]|$)/i.exec(uri)?.[1]?.toLowerCase() ?? (kind === 'voice' ? 'm4a' : kind === 'video' || kind === 'circle' ? 'mp4' : 'jpg');
  const contentType = ({ mp4: 'video/mp4', mov: 'video/quicktime', m4a: 'audio/mp4', aac: 'audio/aac', png: 'image/png', webp: 'image/webp', jpeg: 'image/jpeg', jpg: 'image/jpeg' } as Record<string, string>)[ext];
  const path = `${chatId}/${me}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  if (Platform.OS !== 'web' && /^(file|content):/.test(uri)) {
    const signed = await withTimeout(supabase().storage.from('media').createSignedUploadUrl(path));
    if (signed.error || !signed.data) throw signed.error ?? new Error('upload-unavailable');
    const { data: { session } } = await supabase().auth.getSession();
    const response = await withTimeout(nativeFetch(signed.data.signedUrl, { method: 'PUT', headers: { 'Content-Type': contentType, apikey: config.supabaseKey, Authorization: `Bearer ${session?.access_token ?? config.supabaseKey}` }, body: new File(uri) }), 60000);
    if (!response.ok) throw new Error('upload-failed');
  } else {
    const response = await fetch(uri);
    const blob = await response.arrayBuffer();
    const { error } = await withTimeout(supabase().storage.from('media').upload(path, blob, { contentType }), 60000);
    if (error) throw error;
  }
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

/** Друзья человека (миграция 47): другу — все, остальным — только общие. Пока функции нет в базе — общие из карточки. */
export async function getPersonFriends(id: string): Promise<{ person: Person; common: boolean }[]> {
  const me = await requireUser();
  const mine = await friendIds(me);
  const res = await withTimeout(supabase().rpc('person_friends', { p: id }));
  let rows = (res.data ?? []) as (ProfileRow & { common: boolean })[];
  if (res.error) {
    const card = await personCard(id);
    rows = (await profiles(card?.common_ids ?? [])).map((r) => ({ ...r, common: true }));
  }
  // Себя не выкидываем: у друга в друзьях есть и ты, иначе «1 друг» в профиле и пустой список (26 октября).
  return rows.map((r) => ({ person: mapProfile(r, mine), common: r.id !== me && r.common }));
}
