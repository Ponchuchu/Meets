// Единый интерфейс данных. Реализации: demo (макет + seed) и supabase.

export type Category =
  | 'music' | 'standup' | 'art' | 'hike' | 'games' | 'food' | 'sport' | 'talks'
  | 'theatre' | 'lecture' | 'meetup' | 'party' | 'bike' | 'concert';

export type Visibility = 'public' | 'friends';

export interface EventItem {
  id: string;
  title: string;
  category: Category;
  tags: string[];
  startsAt: string; // ISO
  endsAt: string | null;
  isLong: boolean;
  venueName: string | null;
  address: string;
  addressNote?: string;
  lat: number;
  lon: number;
  needsPin: boolean;
  priceMin: number | null;
  priceMax: number | null;
  isFree: boolean;
  about: string;
  organizer: string | null;
  sourceUrl: string | null;
  cover?: string | null; // ключ фото из assets
  /** Короткое имя для подписи пина: «ДЖАЗ», «ПОХОД». */
  short?: string;
  visibility: Visibility;
  /** Откуда пришло: настоящее событие из афиши или демо-событие макета. */
  origin: 'real' | 'demo';
  /** id друзей, которые идут (только для демо; в supabase считается из attendance). */
  friendsGoing: string[];
  /** Сколько человек ищут компанию. */
  lookingCount: number;
  goingCount: number;
}

export interface Person {
  id: string;
  name: string;
  age?: number;
  photo: string | null; // ключ фото из assets
  initial: string;
  tint: string;
  isFriend: boolean;
  handle?: string;
  note?: string;
}

export type MessageKind = 'text' | 'photo' | 'video' | 'voice' | 'circle' | 'sticker' | 'invite' | 'poll' | 'system';

export interface Message {
  id: string;
  chatId: string;
  authorId: string; // 'me' — это я
  kind: MessageKind;
  text: string;
  time: string; // «18:10»
  media?: string | null;
  duration?: string;
  sub?: string;
  answer?: string;
}

export interface Chat {
  id: string;
  kind: 'direct' | 'event';
  title: string;
  personId?: string;
  eventId?: string;
  lastText: string;
  lastTime: string;
  unread: number;
  pinnedNote?: string;
}

export interface ChatRequest {
  id: string;
  personId: string;
  title: string;
  sub: string;
  quote?: string;
  kind: 'join' | 'answer';
}

export interface FriendRequest {
  id: string;
  personId: string;
  note: string;
}

/** Где друг сейчас (только если он сам включил геолокацию — правила видимости на этапе 6). */
export interface FriendSpot {
  personId: string;
  lat: number;
  lon: number;
  state: 'here' | 'moving' | 'paused';
  place: string;
  speedKmh?: number;
  /** Направление движения, градусы (0 — север, 90 — восток). */
  heading?: number;
  minutesAgo?: number;
}

export interface DataSource {
  readonly kind: 'demo' | 'supabase';
  getMe(): Promise<Person>;
  getEvents(): Promise<EventItem[]>;
  getPeople(): Promise<Person[]>;
  getChats(): Promise<Chat[]>;
  getChatRequests(): Promise<ChatRequest[]>;
  getMessages(chatId: string): Promise<Message[]>;
  getFriendRequests(): Promise<FriendRequest[]>;
  getFriendSpots(): Promise<FriendSpot[]>;
  /** Моя точка по умолчанию (пока нет геолокации). */
  getMySpot(): Promise<{ lat: number; lon: number }>;
}
