// Демо-реализация: люди, чаты и события из макета + настоящие события из seed-файла.
import { DEMO_FORECAST } from './weather';
import { almaty, dayIndex, dayStart, now } from '../lib/clock';
import { colors } from '../theme';
import { seedEvents } from './seed';
import { gridDisk, gridDistance, latLngToCell } from '../lib/h3';
import { DEFAULT_PRIVACY } from '../people/visibility';
import type { Chat, ChatRequest, DataSource, EventItem, FriendRequest, FriendSpot, Message, MyProfile, Person, PersonDetails } from './types';

// ——— Люди ———
const person = (p: Partial<Person> & Pick<Person, 'id' | 'name'>): Person => ({
  photo: null, initial: p.name[0], tint: colors.sand, isFriend: false, ...p,
});

export const ME = person({ id: 'me', name: 'Данил', photo: 'danil', handle: 'danil' });

export const PEOPLE: Person[] = [
  person({ id: 'igor', name: 'Игорь', withName: 'Игорем', age: 25, photo: 'igor', isFriend: true }),
  person({ id: 'denis', name: 'Денис', withName: 'Денисом', photo: 'denis', isFriend: true }),
  person({ id: 'anton', name: 'Антон', withName: 'Антоном', photo: 'anton', isFriend: true }),
  person({ id: 'timur', name: 'Тимур', withName: 'Тимуром', initial: 'Т', tint: colors.softGreen, isFriend: true }),
  person({ id: 'ainura', name: 'Айнура', withName: 'Айнурой', age: 29, photo: 'ainura' }),
  person({ id: 'erlan', name: 'Ерлан', age: 27, initial: 'Е', tint: colors.softYellow, note: 'познакомились на настолках' }),
  person({ id: 'mira', name: 'Мира', age: 22, initial: 'М', tint: colors.softGreen, note: '2 общих друга' }),
  person({ id: 'sasha', name: 'Саша', initial: 'С', tint: colors.softYellow, note: 'бегаете по средам' }),
  person({ id: 'nurlan', name: 'Нурлан', age: 30, initial: 'Н', tint: colors.softBlue }),
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
    { id: 'jazz', tags: ['джаз', 'живая музыка', 'можно одному', 'open-air-концерт'],  title: 'Джаз во дворе', category: 'music', startsAt: at(0, 19, 30, base), endsAt: at(0, 22, 0, base),
      venueName: null, address: 'Панфилова, 110, во дворе', lat: 43.2567, lon: 76.9453, short: 'ДЖАЗ',
      priceMin: 0, priceMax: 0, isFree: true, cover: null,
      about: 'Джазовое трио во дворе старого дома. Можно прийти одному — перед началом все знакомятся у входа.',
      friendsGoing: ['igor', 'denis'], lookingCount: 12, goingCount: 48 },
    { id: 'standup', tags: ['стендап', 'открытый микрофон', 'юмор'],  title: 'Стендап: открытый микрофон', category: 'standup', startsAt: at(fri, 20, 0, base), endsAt: null,
      venueName: 'Бар «Гараж»', address: 'Бар «Гараж», Абая, 52', lat: 43.2505, lon: 76.9489,
      priceMin: 3000, priceMax: 3000, isFree: false, cover: null,
      about: 'Восемь новых комиков пробуют свежий материал. Бывает неровно, но смешно.',
      friendsGoing: [], lookingCount: 3, goingCount: 36 },
    { id: 'anime', tags: ['аниме', 'выставка', 'искусство'],  title: 'Аниме-выставка «Токио в Алматы»', category: 'art', startsAt: at(0, 10, 0, base), endsAt: at(6, 21, 0, base), isLong: true,
      venueName: 'ТРЦ на Абая', address: 'ТРЦ на Абая, 109, 3 этаж', lat: 43.2614, lon: 76.9512,
      priceMin: 2500, priceMax: 2500, isFree: false, cover: null,
      about: 'Эскизы, фигурки, манга и косплей-фотозона. Вечером — мастер-класс по рисованию.',
      friendsGoing: ['anton', 'denis'], lookingCount: 4200, goingCount: 4200 },
    { id: 'hike', tags: ['поход', 'горы', 'закат'],  title: 'Поход на Кок-Жайляу', category: 'hike', startsAt: at(sat, 8, 0, base), endsAt: at(sat, 16, 0, base),
      venueName: null, address: 'Начало тропы, Медеуское ущелье', lat: 43.1636, lon: 77.0321, short: 'ПОХОД',
      priceMin: 0, priceMax: 0, isFree: true, cover: 'hike',
      about: 'Около 14 км туда и обратно, средняя сложность. Наверху плато с видом на город.',
      friendsGoing: ['timur'], lookingCount: 3, goingCount: 18 },
    { id: 'games', tags: ['настолки', 'можно одному', 'квиз'],  title: 'Настолки без своей компании', category: 'games', startsAt: at(0, 20, 0, base), endsAt: at(0, 23, 0, base),
      venueName: 'Антикафе', address: 'Антикафе, Жибек Жолы, 64', lat: 43.2640, lon: 76.9452,
      priceMin: 2000, priceMax: 2000, isFree: false, cover: null,
      about: 'Ведущий рассаживает по столам и объясняет правила. Приходят в основном по одному.',
      friendsGoing: [], lookingCount: 6, goingCount: 22 },
    { id: 'concert', tags: ['концерт', 'рок'],  title: 'Концерт на Центральном стадионе', category: 'concert', startsAt: at(0, 20, 0, base), endsAt: at(0, 23, 0, base),
      venueName: 'Центральный стадион', address: 'Центральный стадион, Абая, 48', lat: 43.2604, lon: 76.9371,
      priceMin: 15000, priceMax: null, isFree: false, cover: null,
      about: 'Большой вечерний концерт на открытом воздухе. Вход по QR-билетам.',
      friendsGoing: [], lookingCount: 0, goingCount: 4200 },
    { id: 'food', tags: ['маркет', 'фудфест', 'дегустация'],  title: 'Фуд-маркет', category: 'food', startsAt: at(0, 12, 0, base), endsAt: at(0, 23, 0, base), isLong: true,
      venueName: null, address: 'Абая, 150, во дворе ТРЦ', lat: 43.2586, lon: 76.9536,
      priceMin: 0, priceMax: 0, isFree: true, cover: null,
      about: 'Уличная еда, кофе и местные фермеры. Вход свободный, платишь только за еду.',
      friendsGoing: [], lookingCount: 0, goingCount: 310 },
    { id: 'bike', tags: ['велопрогулка', 'спорт'],  title: 'Велопрогулка по городу', category: 'bike', startsAt: at(sat, 10, 0, base), endsAt: at(sat, 13, 0, base),
      venueName: 'Парк 28 гвардейцев-панфиловцев', address: 'Парк 28 гвардейцев-панфиловцев, вход с Гоголя', lat: 43.2587, lon: 76.9531,
      priceMin: 0, priceMax: 0, isFree: true, cover: null,
      about: 'Спокойный темп, 20 км по центру и вдоль Весновки. Маршрут в закрепе чата.',
      friendsGoing: ['timur'], lookingCount: 2, goingCount: 14 },
  ];
  return list.map((e) => ({
    tags: [], organizer: null, isLong: false, ...e, ...EVENT_DETAILS[e.id],
    sourceUrl: null, needsPin: false, visibility: 'public', origin: 'demo',
  }));
}

// Подробности для страницы события — тексты из макета EventPage.
const ainura = { personId: 'ainura', note: 'Иду одна, хочу познакомиться', common: '3 ОБЩИХ · СТЕНДАП, ДЖАЗ, ГОРЫ' };
const EVENT_DETAILS: Record<string, Partial<EventItem>> = {
  jazz: {
    catLabel: 'МУЗЫКА / ДЖАЗ', coverLines: [['ДЖАЗ', 'ink'], ['ВО ДВОРЕ', 'ink']], whereShort: 'ПАНФИЛОВА 110',
    addressNote: 'вход через арку с улицы Панфилова', priceNote: 'донат музыкантам по желанию',
    about: 'Камерный вечер с джазовым трио во дворе старого дома: стандарты и немного своего. Можно прийти одному — за 15 минут до начала встречаемся у входа и знакомимся. Пледы дадут, стульев мало, лучше прийти пораньше.',
    organizer: 'Двор на Панфилова', source: 'Яндекс Афиша', goingCount: 18, lookingCount: 5,
    lookers: [ainura, { personId: 'erlan', note: 'Нас двое, ищем ещё 1–2', common: '2 ОБЩИХ · ДЖАЗ, НАСТОЛКИ' }, { personId: 'mira', note: 'Первый раз на таком', common: '1 ОБЩИЙ · ПРОГУЛКИ' }],
    chat: { title: 'Чат события', members: 12, who: 'Саша', text: 'займу столик у сцены, нас уже четверо' },
  },
  hike: {
    catLabel: 'ГОРЫ / ПОХОД', coverLines: [['ПОХОД', 'paper'], ['НА КОК-', 'paper'], ['ЖАЙЛЯУ', 'paper']], whereShort: 'МЕДЕУ',
    addressNote: 'точку сбора закрепят в чате похода', priceNote: 'нужны вода, ветровка и удобная обувь',
    about: 'Однодневный поход с горным клубом: около 14 км туда и обратно, средняя сложность — подойдёт новичкам в неплохой форме. Наверху плато с видом на город и обед из своих запасов. Идём в темпе группы, никого не бросаем.',
    organizer: 'Горный клуб «Тропа»', source: 'Threads', goingCount: 14, lookingCount: 3,
    lookers: [{ personId: 'ainura', note: 'Первый раз так высоко, иду одна', common: '3 ОБЩИХ · ГОРЫ, ДЖАЗ, ПРОГУЛКИ' }, { personId: 'nurlan', note: 'Хожу с клубом второй год', common: '2 ОБЩИХ · ГОРЫ, КОФЕ' }],
    chat: { title: 'Чат похода', members: 14, who: 'Клуб «Тропа»', text: 'закрепили точку сбора и трек маршрута' },
  },
  standup: {
    catLabel: 'СТЕНДАП', coverLines: [['ОТКРЫТЫЙ', 'paper'], ['МИКРОФОН', 'accent']], whereShort: 'АБАЯ 52',
    addressNote: 'вход со двора, второй этаж', priceNote: 'билет на входе или у организатора',
    about: 'Восемь новых комиков пробуют свежий материал, ведущий держит зал. Бывает неровно, но смешно. Места не нумерованы — приходи к 19:40, чтобы сесть ближе к сцене.',
    organizer: 'Открытый микрофон «Гараж»', source: 'Яндекс Афиша', goingCount: 38, lookers: [ainura],
    chat: { title: 'Чат события', members: 38, who: 'Ведущий', text: 'закрепил список выступающих' },
  },
  anime: {
    catLabel: 'ВЫСТАВКА', coverLines: [['ТОКИО', 'ink'], ['В АЛМАТЫ', 'ink']], whereShort: 'АБАЯ 109',
    addressNote: 'вход через главный атриум', priceNote: 'студентам 1 500 ₸, билет на кассе',
    about: 'Оригинальные эскизы, фигурки и уголок с мангой, которую можно читать на месте. Вечером — косплей-фотозона и мастер-класс по рисованию персонажей.',
    organizer: 'Выставочный проект «Токио»', source: 'Instagram', goingCount: 59, lookingCount: 2,
    lookers: [{ personId: 'mira', note: 'Хочу на мастер-класс', common: '2 ОБЩИХ · АНИМЕ, ПРОГУЛКИ' }],
    chat: { title: 'Чат выставки', members: 61, who: 'Антон', text: 'на фотозоне почти нет очереди' },
  },
  games: {
    catLabel: 'НАСТОЛКИ', coverLines: [['НАСТОЛКИ', 'ink'], ['БЕЗ СВОЕЙ', 'ink'], ['КОМПАНИИ', 'ink']], whereShort: 'ЖИБЕК ЖОЛЫ 64',
    addressNote: '2 этаж, звонок «Игротека»', priceNote: 'чай и игры включены',
    about: 'Ведущий рассаживает всех за столы по 4–5 человек и объясняет правила. Можно прийти одному — за этим и собираемся.',
    organizer: 'Игротека «Ход»', source: 'Telegram', goingCount: 23,
    lookers: [{ personId: 'erlan', note: 'Люблю «Каркассон»', common: '2 ОБЩИХ · НАСТОЛКИ, ДЖАЗ' }],
    chat: { title: 'Чат события', members: 23, who: 'Ведущий', text: 'столов хватит всем, приходите' },
  },
  concert: {
    catLabel: 'КОНЦЕРТ', coverLines: [['4 200', 'accent'], ['ИДУТ', 'paper']], whereShort: 'ЦЕНТРАЛЬНЫЙ СТАДИОН',
    addressNote: 'вход с Сатпаева, открытие в 18:30', priceNote: 'билеты у организатора',
    about: 'Большой вечерний концерт на открытом воздухе. Вход по билетам с QR-кодом, большие сумки не пускают. После концерта такси лучше ловить за два квартала.',
    organizer: 'Центральный стадион', source: 'Яндекс Афиша', lookingCount: 12, lookers: [ainura],
    chat: { title: 'Чат события', members: 4200, who: 'Организатор', text: 'схема входов в закрепе' },
  },
  food: {
    catLabel: 'ЕДА / МАРКЕТ', coverLines: [['ФУД-', 'ink'], ['МАРКЕТ', 'ink']], whereShort: 'АБАЯ 150', coverColor: '#EADFB8',
    addressNote: 'во дворе ТРЦ, вход с Абая', priceNote: 'вход свободный',
    organizer: 'Маркет «Двор»', source: 'Instagram',
    chat: { title: 'Чат маркета', members: 40, who: 'Организатор', text: 'сегодня плов и фермерский сыр' },
  },
  bike: {
    catLabel: 'СПОРТ / ВЕЛО', coverLines: [['ВЕЛО-', 'ink'], ['ПРОГУЛКА', 'ink']], whereShort: 'ПАРК ПАНФИЛОВЦЕВ', coverColor: '#D6E0EE',
    addressNote: 'сбор у главного входа', priceNote: 'свой велосипед или прокат у парка',
    organizer: 'Вело-клуб «Круг»', source: 'Telegram',
    chat: { title: 'Чат прогулки', members: 14, who: 'Тимур', text: 'маршрут в закрепе' },
  },
};

// ——— Чаты ———
export const CHATS: Chat[] = [
  { id: 'ev-jazz', kind: 'event', title: 'Джаз во дворе', eventId: 'jazz', lastText: 'Саша: займу столик у сцены', lastTime: '18:02', unread: 3,
    meetPoint: 'Вход во двор с Панфилова, 19:15', members: 12, memberIds: ['sasha', 'igor', 'denis', 'ainura', 'erlan', 'mira'] },
  { id: 'ev-games', kind: 'event', title: 'Настолки без своей компании', eventId: 'games', lastText: 'Ерлан: кто берёт Каркассон?', lastTime: '17:40', unread: 0,
    meetPoint: 'Антикафе, 2 этаж, звонок «Игротека», 19:50', members: 23, memberIds: ['erlan'] },
  { id: 'ev-bike', kind: 'event', title: 'Велопрогулка по городу', eventId: 'bike', lastText: 'Маршрут в закрепе', lastTime: 'вчера', unread: 0,
    meetPoint: 'Главный вход в парк Панфиловцев, 09:50', members: 14, memberIds: ['timur'], pinnedNote: 'Маршрут: парк → Весновка → Арбат, 20 км' },
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
  m('dm-igor', 1, 'me', 'sticker', 'ТЫ ГДЕ?', '17:50'),
  m('dm-igor', 2, 'igor', 'voice', '', '17:51', { duration: '0:09' }),
  m('dm-igor', 3, 'igor', 'photo', 'Я тут, у окна', '17:53', { media: 'igor1' }),
  m('dm-igor', 4, 'me', 'invite', 'Вместе на джаз', '17:54', { sub: 'Сегодня 19:30 · Панфилова, 110', answer: 'Игорь: иду', eventId: 'jazz' }),
  m('dm-igor', 5, 'igor', 'text', 'Го! Встретимся у арки в 19:15', '17:56'),
  m('dm-igor', 6, 'igor', 'text', 'Ты уже выходишь?', '18:10'),
  m('dm-ainura', 1, 'me', 'text', 'Увидел, что ты ищешь компанию на стендап в пятницу. Я тоже хотел — пойдём вместе?', '11:04'),
  m('dm-ainura', 2, 'ainura', 'voice', '', '11:05', { duration: '0:14' }),
  m('dm-ainura', 3, 'ainura', 'text', 'Давай! Возьму нам места поближе к сцене', '11:05'),
  m('dm-ainura', 4, 'me', 'circle', '', '11:06', { media: 'krug', duration: '0:07' }),
  m('dm-ainura', 5, 'ainura', 'video', 'С прошлого микрофона, будет смешно', '11:08', { duration: '0:21', media: 'hike' }),
  m('ev-jazz', 1, 'system', 'system', 'АЙНУРА ПРИСОЕДИНИЛАСЬ', '17:30'),
  m('ev-jazz', 2, 'sasha', 'text', 'Займу столик у сцены, нас уже четверо', '17:41'),
  m('ev-jazz', 3, 'igor', 'text', 'Буду в 19:20, чуть опоздаю', '17:52'),
  m('ev-jazz', 4, 'sasha', 'poll', 'Куда после?', '17:58', { poll: { question: 'Куда после?', options: [{ text: 'Гулять по Панфилова', votes: 5 }, { text: 'Кофе рядом', votes: 3 }, { text: 'Домой, завтра работа', votes: 1 }] } }),
  m('ev-jazz', 5, 'me', 'text', 'Я впервые, буду у входа в зелёной куртке', '18:04'),
  m('ev-games', 1, 'erlan', 'text', 'Кто берёт Каркассон?', '17:40'),
  m('ev-bike', 1, 'timur', 'system', 'Маршрут в закрепе', 'вчера'),
];

// Точки разложены как на макете Main (демо-координаты, адреса — текстом). Где друзья сейчас: Игорь в кофейне у джаза, Денис едет по Абая, Антон на выставке, Тимур на паузе.
export const FRIEND_SPOTS: FriendSpot[] = [
  { personId: 'igor', lat: 43.2529, lon: 76.9476, state: 'here', place: 'Кофейня на Панфилова', minutesAgo: 2, note: 'джаз с 19:00' },
  { personId: 'denis', lat: 43.2620, lon: 76.9415, state: 'moving', place: 'Едет по Абая к аниме-выставке', speedKmh: 14, heading: 90, doing: 'едет на аниме-выставку', vehicle: 'самокат', note: 'выставка до 21:00' },
  { personId: 'anton', lat: 43.2631, lon: 76.9537, state: 'here', place: 'Аниме-выставка, ТРЦ на Абая', minutesAgo: 1, note: 'свободен весь вечер' },
  { personId: 'timur', lat: 43.2561, lon: 76.9373, state: 'paused', place: 'Был здесь 25 минут назад', minutesAgo: 25 },
];
export const MY_SPOT = { lat: 43.2533, lon: 76.9409 };

// Моя история (демо): 185 сот с событиями вокруг центра, 37 открыто → 20% города, уровень 4.
function demoCells(): { all: string[]; visited: string[] } {
  const center = latLngToCell(43.2465, 76.9280, 8);
  const all = gridDisk(center, 8).sort((a, b) => gridDistance(center, a) - gridDistance(center, b) || a.localeCompare(b)).slice(0, 185);
  const visited = all.filter((_, i) => i % 5 === 0).slice(0, 37);
  return { all, visited };
}

export function demoProfile(): MyProfile {
  const cells = demoCells();
  return {
    handle: 'fromvtk', instagram: '@fromvtk', about: 'Джаз, настолки и горы по выходным', phoneMasked: '+7 7•• ••• •• 34',
    stats: { events: 14, friends: 12 },
    visitedCells: cells.visited, eventCells: cells.all,
    districts: [{ name: 'Медеу', pct: 41 }, { name: 'Алмалы', pct: 38 }, { name: 'Бостандык', pct: 27 }, { name: 'Жетысу', pct: 12 }],
    districtsTotal: 8,
    cities: [
      { name: 'Алматы', note: 'Казахстан · дом', pct: 20 }, { name: 'Астана', note: 'Казахстан', pct: 6 }, { name: 'Шымкент', note: 'Казахстан', pct: 3 },
      { name: 'Ташкент', note: 'Узбекистан', pct: 2 }, { name: 'Бишкек', note: 'Кыргызстан', pct: 1 },
    ],
    countries: [
      { iso: 'KZ', name: 'Казахстан', note: '3 города', got: true }, { iso: 'UZ', name: 'Узбекистан', note: '1 город', got: true },
      { iso: 'KG', name: 'Кыргызстан', note: '1 город', got: true }, { iso: 'GE', name: 'Грузия', note: 'ещё нет', got: false },
      { iso: 'TR', name: 'Турция', note: 'ещё нет', got: false }, { iso: 'AE', name: 'ОАЭ', note: 'ещё нет', got: false },
    ],
    timeline: [
      { date: 'СБ 26', title: 'Кинопоказ во дворе', meta: 'с Игорем и Денисом · +1 место' },
      { date: 'ЧТ 24', title: 'Настолки без своей компании', meta: '+2 друга: Ерлан, Мира' },
      { date: 'ВС 20', title: 'Утро на Кок-Тобе', meta: 'значок «Выше города»' },
      { date: 'ПТ 11', title: 'Лекция в Ташкенте', meta: 'новый город и страна' },
    ],
    badgeProgress: { opener: 1, above: 1, host: 1, countries3: 3, cities5: 5, regular: 3, night: 2, districts: 6, conqueror: 1, jazz: 1, games: 2 },
    invitesToMe: [{ eventId: 'games', fromId: 'denis' }],
  };
}

// Профили людей — тексты из макетов Person / PersonFriend / Friends.
const sharing = { ...DEFAULT_PRIVACY, sharingLocation: true, achievements: 'friends' as const };
const i = (label: string, common = true) => ({ label, common });
export const PERSON_DETAILS: Record<string, PersonDetails> = {
  igor: {
    id: 'igor', about: 'Люблю смотреть на город сверху и живую музыку. Всегда за движ, особенно если там есть еда.',
    interests: [i('Живая музыка'), i('Горы'), i('Настолки'), i('Стритфуд'), i('Тату')], interestKeys: ['music', 'hike', 'games', 'food'],
    badges: ['above', 'jazz', 'soul', 'night'], gallery: ['igor', 'igor2', 'igor3', 'igor4'], online: true, instagram: '@igor.almaty',
    commonFriends: ['denis', 'anton', 'timur'], friendsCount: 34, commonCount: 7, friendIds: ['denis', 'anton', 'me', 'timur'],
    plans: [{ eventId: 'jazz', title: 'Джаз во дворе', when: 'СЕГОДНЯ', note: 'вы идёте вместе' }, { title: 'Ужин у Данила', when: 'ПТ 2.10', note: 'несёт напитки' }, { title: 'Шашлыки у Антона', when: 'ВС 4.10', note: 'для друзей · ты тоже приглашён' }],
    now: { place: 'кофейня на Панфилова', sharingUntil: '18:40' }, privacy: sharing,
    planLine: { text: 'Вечером идёт на джаз — ты тоже', eventId: 'jazz', color: '#F0521F' },
  },
  denis: {
    id: 'denis', about: 'Катаю на самокате по всему городу. Аниме, настолки и джаз по настроению.',
    interests: [i('Аниме'), i('Настолки'), i('Живая музыка'), i('Самокат', false)], interestKeys: ['art', 'games', 'music'],
    badges: ['wheels', 'games', 'opener'], gallery: ['denis'], online: true, commonFriends: ['igor', 'anton'], friendsCount: 21, commonCount: 5,
    friendIds: ['igor', 'anton', 'me'], plans: [{ eventId: 'anime', title: 'Аниме-выставка «Токио в Алматы»', when: 'СЕГОДНЯ', note: 'едет туда' }, { eventId: 'jazz', title: 'Джаз во дворе', when: 'СЕГОДНЯ', note: 'вы идёте вместе' }],
    now: { place: 'едет по Абая к аниме-выставке', sharingUntil: '20:30' }, privacy: sharing,
    planLine: { text: 'Идёт на аниме-выставку до 21:00', eventId: 'anime', color: '#E7E2D6' },
  },
  anton: {
    id: 'anton', about: 'Выставки, аниме и хорошая еда. Зову на шашлыки по воскресеньям.',
    interests: [i('Выставки'), i('Аниме'), i('Еда и маркеты')], interestKeys: ['art', 'food'],
    badges: ['host', 'art'], gallery: ['anton'], online: true, commonFriends: ['igor', 'denis'], friendsCount: 18, commonCount: 4,
    friendIds: ['igor', 'denis', 'me'], plans: [{ eventId: 'anime', title: 'Аниме-выставка', when: 'СЕГОДНЯ', note: 'уже там' }, { title: 'Шашлыки у Антона', when: 'ВС 4.10', note: 'устраивает' }],
    now: { place: 'аниме-выставка, ТРЦ на Абая', sharingUntil: '21:00' }, privacy: sharing,
    planLine: { text: 'Свободен весь вечер', color: '#D9E4D2' },
  },
  timur: {
    id: 'timur', about: 'Горы по субботам, велосипед по воскресеньям.',
    interests: [i('Горы'), i('Бег и вело'), i('Стендап')], interestKeys: ['hike', 'sport', 'standup'],
    badges: ['conqueror', 'wheels', 'early'], gallery: [], online: false, lastSeen: 'был 25 минут назад', commonFriends: ['igor'], friendsCount: 15, commonCount: 3,
    friendIds: ['igor', 'me'], plans: [{ eventId: 'hike', title: 'Поход на Кок-Жайляу', when: 'СБ 3.10', note: 'вы идёте вместе' }, { eventId: 'bike', title: 'Велопрогулка по городу', when: 'СБ 3.10', note: 'зовёт тебя' }],
    // Геолокация на паузе: друзья видят последнюю точку и «25 МИН».
    privacy: { ...DEFAULT_PRIVACY, sharingLocation: true },
    planLine: { text: 'В субботу идёт в поход — ты тоже', eventId: 'hike', color: '#17161A' },
  },
  ainura: {
    id: 'ainura', about: 'Снимаю на плёнку, собираю винтаж, летом хожу в горы. Ищу людей, с которыми не страшно пойти на что-то новое.',
    interests: [i('Стендап'), i('Джаз'), i('Горы', false), i('Плёночная фотография', false), i('Винтаж', false)], interestKeys: ['standup', 'music', 'hike'],
    badges: ['above', 'countries3', 'film', 'laugh'], badgeLine: 'АЛМАТЫ 31% · 4 СТРАНЫ', gallery: ['ainura'], online: false, lastSeen: 'Была недавно', instagram: '@ainura.film',
    commonFriends: ['igor', 'denis'], friendsCount: 40, commonCount: 2, friendIds: [],
    lookingFor: { eventId: 'standup', note: 'Иду одна, хочу познакомиться' }, plans: [],
    privacy: { ...DEFAULT_PRIVACY, company: 'all', achievements: 'all' }, suggestNote: 'Тоже идёт на джаз',
  },
  erlan: {
    id: 'erlan', about: 'Настолки, квизы и джаз. Если зовут — прихожу.', interests: [i('Настолки'), i('Джаз'), i('Квизы', false)], interestKeys: ['games', 'music'],
    badges: ['games'], gallery: [], online: true, commonFriends: [], friendsCount: 12, commonCount: 0, friendIds: [],
    lookingFor: { eventId: 'jazz', note: 'Нас двое, ищем ещё 1–2' }, plans: [], privacy: { ...DEFAULT_PRIVACY, company: 'all' }, suggestNote: 'Были вместе на настолках',
  },
  mira: {
    id: 'mira', about: 'Недавно переехала в Алматы, знакомлюсь с городом.', interests: [i('Прогулки'), i('Аниме'), i('Выставки', false)], interestKeys: ['art', 'people'],
    badges: [], gallery: [], online: false, lastSeen: 'Была вчера', commonFriends: ['anton', 'denis'], friendsCount: 6, commonCount: 2, friendIds: [],
    lookingFor: { eventId: 'jazz', note: 'Первый раз на таком' }, plans: [], privacy: { ...DEFAULT_PRIVACY, company: 'fof' }, suggestNote: '2 общих друга',
  },
  sasha: {
    id: 'sasha', about: 'Бегаю по средам, по пятницам — стендап.', interests: [i('Бег'), i('Стендап')], interestKeys: ['sport', 'standup'],
    badges: [], gallery: [], online: false, lastSeen: 'Был недавно', commonFriends: ['igor'], friendsCount: 9, commonCount: 1, friendIds: [], plans: [], privacy: DEFAULT_PRIVACY,
  },
  nurlan: {
    id: 'nurlan', about: 'Хожу с горным клубом второй год.', interests: [i('Горы'), i('Кофе', false)], interestKeys: ['hike'],
    badges: ['conqueror'], gallery: [], online: false, lastSeen: 'Был недавно', commonFriends: [], friendsCount: 30, commonCount: 0, friendIds: [],
    lookingFor: { eventId: 'hike', note: 'Хожу с клубом второй год' }, plans: [], privacy: { ...DEFAULT_PRIVACY, company: 'all' },
  },
};

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
    getMyProfile: async () => demoProfile(),
    getPersonDetails: async (id) => PERSON_DETAILS[id] ?? null,
    getForecast: async () => DEMO_FORECAST,
  };
}
