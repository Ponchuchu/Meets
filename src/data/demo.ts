// Демо-реализация: люди, чаты и события из макета + настоящие события из seed-файла.
import { almaty, dayIndex, dayStart, now } from '../lib/clock';
import { colors } from '../theme';
import { seedEvents } from './seed';
import type { Chat, ChatRequest, DataSource, EventItem, FriendRequest, FriendSpot, Message, Person } from './types';

// ——— Люди ———
const person = (p: Partial<Person> & Pick<Person, 'id' | 'name'>): Person => ({
  photo: null, initial: p.name[0], tint: colors.sand, isFriend: false, ...p,
});

export const ME = person({ id: 'me', name: 'Данил', photo: 'danil', handle: 'danil' });

export const PEOPLE: Person[] = [
  person({ id: 'igor', name: 'Игорь', age: 25, photo: 'igor', isFriend: true }),
  person({ id: 'denis', name: 'Денис', photo: 'denis', isFriend: true }),
  person({ id: 'anton', name: 'Антон', photo: 'anton', isFriend: true }),
  person({ id: 'timur', name: 'Тимур', initial: 'Т', tint: colors.softGreen, isFriend: true }),
  person({ id: 'ainura', name: 'Айнура', age: 29, photo: 'ainura' }),
  person({ id: 'erlan', name: 'Ерлан', initial: 'Е', tint: colors.softYellow, note: 'познакомились на настолках' }),
  person({ id: 'mira', name: 'Мира', initial: 'М', tint: colors.softGreen, note: '2 общих друга' }),
  person({ id: 'sasha', name: 'Саша', initial: 'С', tint: colors.softBlue }),
];

// ——— События макета ———
// Даты считаются от «сегодня», чтобы демо всегда было живым: джаз — сегодня в 19:30 и т. д.
// Время — по Алматы, независимо от часового пояса устройства.
function at(dayOffset: number, hh: number, mm = 0, base = now()): string {
  return new Date(dayStart(dayIndex(base) + dayOffset).getTime() + (hh * 60 + mm) * 60000).toISOString();
}
function nextWeekday(weekday: number, base = now()): number {
  // 0 — вс … 6 — сб. Сегодня тоже подходит.
  return (weekday - almaty(base).getUTCDay() + 7) % 7;
}

type DemoSeed = Omit<EventItem, 'origin' | 'visibility' | 'needsPin' | 'tags' | 'organizer' | 'sourceUrl' | 'isLong'> &
  Partial<Pick<EventItem, 'tags' | 'organizer' | 'isLong'>>;

export function demoEvents(base = now()): EventItem[] {
  const fri = nextWeekday(5, base);
  const sat = nextWeekday(6, base);
  const list: DemoSeed[] = [
    { id: 'jazz', title: 'Джаз во дворе', category: 'music', startsAt: at(0, 19, 30, base), endsAt: at(0, 22, 0, base),
      venueName: null, address: 'Панфилова, 110, во дворе', lat: 43.2567, lon: 76.9453, short: 'ДЖАЗ',
      priceMin: 0, priceMax: 0, isFree: true, cover: null,
      about: 'Джазовое трио во дворе старого дома. Можно прийти одному — перед началом все знакомятся у входа.',
      friendsGoing: ['igor', 'denis'], lookingCount: 12, goingCount: 48 },
    { id: 'standup', title: 'Стендап: открытый микрофон', category: 'standup', startsAt: at(fri, 20, 0, base), endsAt: null,
      venueName: 'Бар «Гараж»', address: 'Бар «Гараж», Абая, 52', lat: 43.2505, lon: 76.9489,
      priceMin: 3000, priceMax: 3000, isFree: false, cover: null,
      about: 'Восемь новых комиков пробуют свежий материал. Бывает неровно, но смешно.',
      friendsGoing: [], lookingCount: 3, goingCount: 36 },
    { id: 'anime', title: 'Аниме-выставка «Токио в Алматы»', category: 'art', startsAt: at(0, 10, 0, base), endsAt: at(6, 21, 0, base), isLong: true,
      venueName: 'ТРЦ на Абая', address: 'ТРЦ на Абая, 109, 3 этаж', lat: 43.2614, lon: 76.9512,
      priceMin: 2500, priceMax: 2500, isFree: false, cover: null,
      about: 'Эскизы, фигурки, манга и косплей-фотозона. Вечером — мастер-класс по рисованию.',
      friendsGoing: ['anton', 'denis'], lookingCount: 4200, goingCount: 4200 },
    { id: 'hike', title: 'Поход на Кок-Жайляу', category: 'hike', startsAt: at(sat, 8, 0, base), endsAt: at(sat, 16, 0, base),
      venueName: null, address: 'Начало тропы, Медеуское ущелье', lat: 43.1636, lon: 77.0321, short: 'ПОХОД',
      priceMin: 0, priceMax: 0, isFree: true, cover: 'hike',
      about: 'Около 14 км туда и обратно, средняя сложность. Наверху плато с видом на город.',
      friendsGoing: ['timur'], lookingCount: 3, goingCount: 18 },
    { id: 'games', title: 'Настолки без своей компании', category: 'games', startsAt: at(0, 20, 0, base), endsAt: at(0, 23, 0, base),
      venueName: 'Антикафе', address: 'Антикафе, Жибек Жолы, 64', lat: 43.2640, lon: 76.9452,
      priceMin: 2000, priceMax: 2000, isFree: false, cover: null,
      about: 'Ведущий рассаживает по столам и объясняет правила. Приходят в основном по одному.',
      friendsGoing: [], lookingCount: 6, goingCount: 22 },
    { id: 'concert', title: 'Концерт на Центральном стадионе', category: 'concert', startsAt: at(0, 20, 0, base), endsAt: at(0, 23, 0, base),
      venueName: 'Центральный стадион', address: 'Центральный стадион, Абая, 48', lat: 43.2604, lon: 76.9371,
      priceMin: 15000, priceMax: null, isFree: false, cover: null,
      about: 'Большой вечерний концерт на открытом воздухе. Вход по QR-билетам.',
      friendsGoing: [], lookingCount: 0, goingCount: 4200 },
    { id: 'food', title: 'Фуд-маркет', category: 'food', startsAt: at(0, 12, 0, base), endsAt: at(0, 23, 0, base), isLong: true,
      venueName: null, address: 'Абая, 150, во дворе ТРЦ', lat: 43.2586, lon: 76.9536,
      priceMin: 0, priceMax: 0, isFree: true, cover: null,
      about: 'Уличная еда, кофе и местные фермеры. Вход свободный, платишь только за еду.',
      friendsGoing: [], lookingCount: 0, goingCount: 310 },
    { id: 'bike', title: 'Велопрогулка по городу', category: 'bike', startsAt: at(sat, 10, 0, base), endsAt: at(sat, 13, 0, base),
      venueName: 'Парк 28 гвардейцев-панфиловцев', address: 'Парк 28 гвардейцев-панфиловцев, вход с Гоголя', lat: 43.2587, lon: 76.9531,
      priceMin: 0, priceMax: 0, isFree: true, cover: null,
      about: 'Спокойный темп, 20 км по центру и вдоль Весновки. Маршрут в закрепе чата.',
      friendsGoing: ['timur'], lookingCount: 2, goingCount: 14 },
  ];
  return list.map((e) => ({
    tags: [], organizer: null, isLong: false, ...e,
    sourceUrl: null, needsPin: false, visibility: 'public', origin: 'demo',
  }));
}

// ——— Чаты ———
export const CHATS: Chat[] = [
  { id: 'ev-jazz', kind: 'event', title: 'Джаз во дворе', eventId: 'jazz', lastText: 'Саша: займу столик у сцены', lastTime: '18:02', unread: 3 },
  { id: 'ev-games', kind: 'event', title: 'Настолки без своей компании', eventId: 'games', lastText: 'Ерлан: кто берёт Каркассон?', lastTime: '17:40', unread: 0 },
  { id: 'ev-bike', kind: 'event', title: 'Велопрогулка по городу', eventId: 'bike', lastText: 'Маршрут в закрепе', lastTime: 'вчера', unread: 0 },
  { id: 'dm-igor', kind: 'direct', title: 'Игорь', personId: 'igor', lastText: 'Ты уже выходишь?', lastTime: '18:10', unread: 0 },
  { id: 'dm-ainura', kind: 'direct', title: 'Айнура', personId: 'ainura', lastText: 'С прошлого микрофона, будет смешно', lastTime: '11:08', unread: 0 },
];

export const CHAT_REQUESTS: ChatRequest[] = [
  { id: 'req-timur', personId: 'timur', kind: 'join', title: 'Тимур хочет пойти с тобой', sub: 'Велопрогулка по городу · сб, 10:00', quote: '«Возьму запасной шлем, если нужно»' },
  { id: 'req-ainura', personId: 'ainura', kind: 'answer', title: 'Айнура ответила «Давай!»', sub: 'Стендап в пятницу · личный чат' },
];

const m = (chatId: string, i: number, authorId: string, kind: Message['kind'], text: string, time: string, extra: Partial<Message> = {}): Message =>
  ({ id: `${chatId}-${i}`, chatId, authorId, kind, text, time, ...extra });

export const MESSAGES: Message[] = [
  m('dm-igor', 1, 'igor', 'sticker', 'ТЫ ГДЕ?', '17:50'),
  m('dm-igor', 2, 'igor', 'voice', '', '17:51', { duration: '0:09' }),
  m('dm-igor', 3, 'igor', 'photo', 'Я тут, у окна', '17:53', { media: 'igor1' }),
  m('dm-igor', 4, 'me', 'invite', 'Вместе на джаз', '17:54', { sub: 'Сегодня 19:30 · Панфилова, 110', answer: 'Игорь: иду' }),
  m('dm-igor', 5, 'igor', 'text', 'Го! Встретимся у арки в 19:15', '17:56'),
  m('dm-igor', 6, 'igor', 'text', 'Ты уже выходишь?', '18:10'),
  m('dm-ainura', 1, 'me', 'text', 'Увидел, что ты ищешь компанию на стендап в пятницу. Я тоже хотел — пойдём вместе?', '11:04'),
  m('dm-ainura', 2, 'me', 'voice', '', '11:05', { duration: '0:14' }),
  m('dm-ainura', 3, 'ainura', 'text', 'Давай! Возьму нам места поближе к сцене', '11:05'),
  m('dm-ainura', 4, 'me', 'circle', '', '11:06', { media: 'krug', duration: '0:07' }),
  m('dm-ainura', 5, 'ainura', 'video', 'С прошлого микрофона, будет смешно', '11:08', { duration: '0:21', media: 'hike' }),
  m('ev-jazz', 1, 'sasha', 'text', 'займу столик у сцены', '18:02'),
  m('ev-games', 1, 'erlan', 'text', 'кто берёт Каркассон?', '17:40'),
  m('ev-bike', 1, 'timur', 'system', 'Маршрут в закрепе', 'вчера'),
];

// Точки разложены как на макете Main (демо-координаты, адреса — текстом). Где друзья сейчас: Игорь в кофейне у джаза, Денис едет по Абая, Антон на выставке, Тимур на паузе.
export const FRIEND_SPOTS: FriendSpot[] = [
  { personId: 'igor', lat: 43.2529, lon: 76.9476, state: 'here', place: 'Кофейня на Панфилова', minutesAgo: 2 },
  { personId: 'denis', lat: 43.2620, lon: 76.9415, state: 'moving', place: 'Едет по Абая к аниме-выставке', speedKmh: 14, heading: 90 },
  { personId: 'anton', lat: 43.2631, lon: 76.9537, state: 'here', place: 'Аниме-выставка, ТРЦ на Абая', minutesAgo: 1 },
  { personId: 'timur', lat: 43.2561, lon: 76.9373, state: 'paused', place: 'Был здесь 25 минут назад', minutesAgo: 25 },
];
export const MY_SPOT = { lat: 43.2533, lon: 76.9409 };

export const FRIEND_REQUESTS: FriendRequest[] = [
  { id: 'fr-erlan', personId: 'erlan', note: 'познакомились на настолках' },
  { id: 'fr-mira', personId: 'mira', note: '2 общих друга' },
];

/** Демо-события макета + настоящие события, отсортированные по времени начала. */
export function mergeEvents(demo: EventItem[], real: EventItem[]): EventItem[] {
  const seen = new Set<string>();
  return [...demo, ...real]
    .filter((e) => (seen.has(e.id) ? false : (seen.add(e.id), true)))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

export function createDemoSource(): DataSource {
  return {
    kind: 'demo',
    getMe: async () => ME,
    getEvents: async () => mergeEvents(demoEvents(), seedEvents()),
    getPeople: async () => PEOPLE,
    getChats: async () => CHATS,
    getChatRequests: async () => CHAT_REQUESTS,
    getMessages: async (chatId) => MESSAGES.filter((x) => x.chatId === chatId),
    getFriendRequests: async () => FRIEND_REQUESTS,
    getFriendSpots: async () => FRIEND_SPOTS,
    getMySpot: async () => MY_SPOT,
  };
}
