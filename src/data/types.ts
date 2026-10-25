// Единый интерфейс данных. Реализации: demo (макет + seed) и supabase.

export type Category =
  | 'music' | 'standup' | 'art' | 'hike' | 'games' | 'food' | 'sport' | 'talks'
  | 'movie' | 'theatre' | 'lecture' | 'meetup' | 'party' | 'bike' | 'concert';

export type Visibility = 'public' | 'friends';

export interface EventItem {
  id: string;
  /** Карточка постоянного места в ленте (Кок-Тобе, боулинг…): id места из spots, а не событие. */
  spotId?: string;
  spot?: import('./attractions').Attraction;
  sessions?: { id: string; startsAt: string; endsAt: string | null }[];
  createdBy?: string;
  title: string;
  category: Category;
  tags: string[];
  startsAt: string; // ISO
  endsAt: string | null;
  isLong: boolean;
  venueId?: string;
  venueName: string | null;
  address: string;
  addressNote?: string;
  lat: number;
  lon: number;
  needsPin: boolean;
  /** Координат нет совсем (адрес не нашёлся) — на карте не показываем, в Рекомендациях — да. */
  noPoint?: boolean;
  priceMin: number | null;
  priceMax: number | null;
  isFree: boolean;
  about: string;
  organizer: string | null;
  sourceUrl: string | null;
  cover?: string | null; // ключ фото из assets
  /** Короткое имя для подписи пина: «ДЖАЗ», «ПОХОД». */
  short?: string;
  /** Подробности для страницы события (EventPage). */
  catLabel?: string; // «МУЗЫКА / ДЖАЗ»
  coverLines?: [string, 'ink' | 'paper' | 'accent'][];
  coverColor?: string;
  whereShort?: string; // «ПАНФИЛОВА 110» для полосы на обложке
  priceNote?: string;
  source?: string; // «Яндекс Афиша»
  lookers?: Looker[];
  chat?: EventChatPreview;
  /** Встреча, которую создал я (CreateEvent). */
  meetup?: { kind: string; plusOne: boolean; invited: string[]; items: MeetupItem[] };
  visibility: Visibility;
  /** В планах сохраняются и события, которые команда сняла с карты. */
  status?: 'draft' | 'published' | 'cancelled' | 'archived';
  /** Откуда пришло: настоящее событие из афиши или демо-событие макета. */
  origin: 'real' | 'demo';
  /** id друзей, которые идут (только для демо; в supabase считается из attendance). */
  friendsGoing: string[];
  /** Сколько человек ищут компанию. */
  lookingCount: number;
  goingCount: number;
}

/** Человек в списке «Ищут компанию» на событии. */
export interface Looker {
  personId: string;
  note: string;
  common: string; // «3 ОБЩИХ · СТЕНДАП, ДЖАЗ, ГОРЫ»
}

export interface EventChatPreview {
  title: string;
  members: number;
  who: string;
  text: string;
}

export interface MeetupItem {
  id: string;
  title: string;
  by: string | null; // id человека, который принесёт
}

export interface Person {
  id: string;
  name: string;
  age?: number;
  photo: string | null; // ключ фото из assets
  mapTrail?: 'none' | 'dots' | 'comet';
  mapFrame?: string;
  /** Форма аватарки (profiles.map_shape). */
  mapShape?: string;
  initial: string;
  tint: string;
  isFriend: boolean;
  handle?: string;
  note?: string;
  /** Имя в творительном падеже: «с Игорем». */
  withName?: string;
}

export type MessageKind = 'text' | 'photo' | 'video' | 'voice' | 'circle' | 'sticker' | 'invite' | 'poll' | 'system';

export interface Message {
  clientKey?: string;
  ownerId?: string;
  id: string;
  chatId: string;
  authorId: string; // 'me' — это я
  kind: MessageKind;
  text: string;
  time: string; // «18:10»
  createdAt?: string;
  delivery?: 'sending' | 'failed';
  /** Исправлено автором — пометка «изменено». */
  editedAt?: string;
  durationS?: number;
  uploadedPath?: string;
  media?: string | null;
  duration?: string;
  sub?: string;
  answer?: string;
  eventId?: string;
  /** Ответ на сообщение (messages.reply_to). */
  replyTo?: string;
  poll?: { question: string; options: { text: string; votes: number }[] };
}

export interface Chat {
  id: string;
  kind: 'direct' | 'event' | 'group';
  title: string;
  personId?: string;
  eventId?: string;
  lastText: string;
  lastTime: string;
  /** Вид последнего сообщения и моё ли оно — для подписи «Ты: …» и названия вложения. */
  lastKind?: MessageKind;
  lastMine?: boolean;
  unread: number;
  pinnedNote?: string;
  /** Чат события: точка сбора, участники. */
  meetPoint?: string;
  members?: number;
  memberIds?: string[];
  /** До какого времени собеседник (в группе — хоть кто-то) прочитал чат: для двух галочек. */
  readUpTo?: string;
  /** Время последнего сообщения (ISO) — для галочек в списке чатов. */
  lastAt?: string;
  /** Фото группы. */
  photo?: string;
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
  /** Короткая подпись для «Рядом с тобой»: «едет на аниме-выставку», «свободен весь вечер». */
  doing?: string;
  note?: string;
  vehicle?: string;
  /** Заряд телефона друга, % (FIX5), и заряжается ли он. */
  battery?: number;
  charging?: boolean;
}

export interface TimelineItem {
  date: string; // «СБ 26»
  title: string;
  /** Необязательная приписка — только факты: значок, новый город. */
  meta?: string;
  eventId?: string;
  category?: Category;
  place?: string;
  /** С кем был (id друзей) — аватарки в хронике. */
  with?: string[];
}

/** Моя история для профиля: открытый город, значки, хроника. */
export interface MyProfile {
  handle: string;
  instagram: string | null;
  about: string;
  phoneMasked: string;
  stats: { events: number; friends: number };
  visitedCells: string[];
  eventCells: string[];
  districts: { name: string; pct: number }[];
  districtsTotal: number;
  cities: { name: string; note: string; pct: number }[];
  countries: { iso: string; name: string; note: string; got: boolean }[];
  timeline: TimelineItem[];
  /** Где ночевал — видно только мне (полноэкранная «Моя карта»). */
  nights?: { lat: number; lon: number; label: string; count: number }[];
  badgeProgress: Record<string, number>;
  /** Меня зовут: id события и кто зовёт. */
  invitesToMe: { eventId: string; fromId: string }[];
}

/** Подробный профиль человека (Person / PersonFriend). */
export interface PersonDetails {
  id: string;
  about: string;
  interests: { label: string; common: boolean }[];
  badges: string[]; // id значков
  badgeLine?: string; // «АЛМАТЫ 31% · 4 СТРАНЫ»
  gallery: string[];
  online: boolean;
  lastSeen?: string; // «Была недавно»
  instagram?: string;
  commonFriends: string[];
  friendsCount: number;
  commonCount: number;
  friendIds: string[];
  /** Ищет компанию — для не-друзей (видно, если сам включил). */
  lookingFor?: { eventId: string; note: string };
  /** Планы друга: событие и подпись. */
  plans: { eventId?: string; title: string; when: string; note: string }[];
  /** Где сейчас (для друзей с включённой геолокацией). */
  now?: { place: string; sharingUntil: string };
  privacy: import('../people/visibility').OwnerPrivacy;
  /** Интересы для «Позвать куда-то» — группы тегов. */
  interestKeys: string[];
  /** «Могут стать другом»: откуда знакомы. */
  suggestNote?: string;
  /** Строка плана в карточке на карте: «Вечером идёт на джаз — ты тоже». */
  planLine?: { text: string; eventId?: string; color: string };
  /** Когда последний раз был в приложении (видят друзья). */
  seenAt?: string;
  /** Шаги сегодня и число альбомов — если человек это открыл. */
  stepsToday?: number;
  memoriesCount?: number;
  frame?: string | null;
  shape?: string | null;
  photo?: string | null;
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
  getMyProfile(): Promise<MyProfile>;
  getPersonDetails(id: string): Promise<PersonDetails | null>;
  /** Погода на 7 дней с сегодняшнего: Open-Meteo через кэш на сервере. */
  getForecast(): Promise<import('./weather').DayWeather[]>;
  /** Погода сейчас (Open-Meteo current). */
  getWeatherNow(): Promise<import('./weather').DayWeather>;
}
