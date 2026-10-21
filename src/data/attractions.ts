// Постоянные места (21 октября, идея владельца): горы, катки, боулинг, батуты, квесты, фотозоны.
// Работают каждый день — на карте свой значок, по нажатию — карточка: что это, сезон, цена, «Купить билет» или «Часы и цены».
// Точки — из справочника Overture (проверены вручную, дубли и ошибки отброшены). Часы работы меняются по сезону,
// поэтому мы их не выдумываем: кнопка ведёт на официальный сайт (где он точно есть) или в карточку 2ГИС с часами и ценами.

export type AttractionKind = 'ski' | 'skate' | 'cable' | 'wheel' | 'bowling' | 'trampoline' | 'climb' | 'quest' | 'vr' | 'golf' | 'paintball' | 'aqua' | 'photo' | 'zipline';

export interface Attraction {
  id: string;
  name: string;
  kind: AttractionKind;
  lat: number;
  lon: number;
  address?: string;
  /** Одной строкой: что там делать. */
  about: string;
  free?: boolean;
  /** Сезон: месяцы работы (1–12), например горнолыжка — с ноября по апрель. Нет — круглый год. */
  season?: [number, number];
  /** Официальная страница покупки (только где уверены, что она есть). */
  buy?: string;
}

export const KIND_LABEL: Record<AttractionKind, string> = {
  ski: 'Горнолыжный курорт', skate: 'Каток', cable: 'Канатная дорога', wheel: 'Колесо обозрения', bowling: 'Боулинг',
  trampoline: 'Батутный парк', climb: 'Скалодром', quest: 'Квесты', vr: 'VR-парк', golf: 'Гольф', paintball: 'Пейнтбол',
  aqua: 'Аквапарк', photo: 'Фотозона', zipline: 'Зиплайн',
};

export const KIND_COLOR: Record<AttractionKind, string> = {
  ski: '#2C6FB0', skate: '#4FA3D9', cable: '#1F9AA8', wheel: '#E0457B', bowling: '#3A3046', trampoline: '#E2A21B', climb: '#B5651D',
  quest: '#5B5BD6', vr: '#7E5BD6', golf: '#2F8F5B', paintball: '#C83A26', aqua: '#2AA5B8', photo: '#F0521F', zipline: '#3E7E4E',
};

export const ATTRACTIONS: Attraction[] = [
  // Горы
  { id: 'shymbulak', name: 'Шымбулак', kind: 'ski', lat: 43.12786, lon: 77.08092, address: 'ул. Горная, 640', about: 'Горнолыжный курорт: трассы, гондола с Медеу, виды на 3200 м', season: [11, 4], buy: 'https://shymbulak.com' },
  { id: 'medeu', name: 'Медеу', kind: 'skate', lat: 43.15755, lon: 77.05856, address: 'ул. Горная, 465', about: 'Высокогорный каток под открытым небом', season: [11, 3] },
  { id: 'medeu-gondola', name: 'Гондола Медеу — Шымбулак', kind: 'cable', lat: 43.16306, lon: 77.05164, about: 'Канатная дорога в горы, работает круглый год' },
  { id: 'tabagan', name: 'Табаган', kind: 'ski', lat: 43.21460, lon: 77.09642, about: 'Горнолыжная база и зона отдыха в Талгарском ущелье', season: [12, 3] },
  { id: 'oi-qaragai', name: 'Пейнтбол Ой-Карагай', kind: 'paintball', lat: 43.22729, lon: 77.14919, about: 'Пейнтбол в лесу ущелья Ой-Карагай' },
  // Город
  { id: 'koktobe', name: 'Кок-Тобе', kind: 'cable', lat: 43.24242, lon: 76.95908, address: 'пр. Достык, 104А', about: 'Канатка на гору, смотровая площадка, аттракционы', buy: 'https://koktobe.com' },
  { id: 'happy-eye', name: 'Колесо Happy Eye', kind: 'wheel', lat: 43.20108, lon: 76.89373, address: 'ул. Розыбакиева, 273', about: 'Колесо обозрения с видом на горы и город' },
  { id: 'octopus', name: 'Аквапарк «Осьминог»', kind: 'aqua', lat: 43.26234, lon: 76.97124, address: 'Парк Горького, ул. Гоголя, 1', about: 'Летний аквапарк в Центральном парке', season: [6, 8] },
  { id: 'gorilla', name: 'Gorilla Zipline', kind: 'zipline', lat: 43.21041, lon: 76.93334, address: 'пр. аль-Фараби, 128/В', about: 'Зиплайн и верёвочный парк' },
  { id: 'zhailjau', name: 'Гольф-клуб «Жайляу»', kind: 'golf', lat: 43.18163, lon: 76.87844, address: 'мкр. Мирас, 188', about: 'Поле для гольфа с видом на горы', season: [4, 10] },
  // Боулинг
  { id: 'family-bowling', name: 'Family Bowling', kind: 'bowling', lat: 43.22803, lon: 76.85302, address: 'ул. Улугбека, 57', about: 'Боулинг и семейный парк развлечений' },
  { id: 'madison', name: 'Боулинг «Мэдисон»', kind: 'bowling', lat: 43.23915, lon: 76.93348, address: 'ТРК «Форум», пр. Сейфуллина, 617', about: 'Боулинг и караоке' },
  { id: 'bastau', name: 'Bowling Bastau', kind: 'bowling', lat: 43.25070, lon: 76.92062, address: 'ул. Шагабутдинова, 109а', about: 'Боулинг в центре' },
  { id: 'krapiva', name: 'Боулинг «Крапива»', kind: 'bowling', lat: 43.23988, lon: 76.85767, address: '1-й мкр., 12', about: 'Боулинг и бар' },
  // Активно
  { id: 'kango', name: 'Батутный парк Kango', kind: 'trampoline', lat: 43.20263, lon: 76.89090, address: 'MEGA, ул. Розыбакиева, 247А', about: 'Батуты, поролоновая яма, ниндзя-полоса' },
  { id: 'gravity', name: 'Батутный парк «Гравитация»', kind: 'trampoline', lat: 43.23671, lon: 76.84572, address: 'ул. Кабдолова, 1', about: 'Батутный парк' },
  { id: 'cozyrock', name: 'CozyRock', kind: 'climb', lat: 43.24190, lon: 76.87749, address: 'ул. Брусиловского, 167', about: 'Скалодром: болдеринг и трассы' },
  { id: 'questoria', name: 'Questoria', kind: 'quest', lat: 43.22185, lon: 76.90236, address: 'ул. Жарокова, 210Б', about: 'Квесты в реальности' },
  { id: 'rift-vr', name: 'Rift VR Park', kind: 'vr', lat: 43.20918, lon: 76.95374, about: 'Виртуальная реальность для компании' },
  // Бесплатные фотозоны
  { id: 'shymbulak-swing', name: 'Качели у Шымбулака', kind: 'photo', lat: 43.12766, lon: 77.08080, about: 'Качели над ущельем — самый узнаваемый кадр в горах', free: true },
  { id: 'koktobe-view', name: 'Смотровая Кок-Тобе', kind: 'photo', lat: 43.23390, lon: 76.97590, about: 'Весь город и горы в одном кадре, вечером — огни', free: true },
  { id: 'arbat', name: 'Арбат', kind: 'photo', lat: 43.2614, lon: 76.9450, address: 'ул. Жибек Жолы', about: 'Пешеходная улица: музыканты, художники, вечерний свет', free: true },
  { id: 'republic-sq', name: 'Площадь Республики', kind: 'photo', lat: 43.2381, lon: 76.9454, about: 'Монумент Независимости и горы за ним', free: true },
];

/** Работает ли сезонное место в этом месяце. */
export function inSeason(a: Attraction, now = new Date()): boolean {
  if (!a.season) return true;
  const m = new Date(now.getTime() + 5 * 3600e3).getUTCMonth() + 1;
  const [from, to] = a.season;
  return from <= to ? m >= from && m <= to : m >= from || m <= to;
}

const MONTHS = ['январе', 'феврале', 'марте', 'апреле', 'мае', 'июне', 'июле', 'августе', 'сентябре', 'октябре', 'ноябре', 'декабре'];
const FROM = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
/** «сезон до апреля» / «откроется в ноябре» / «круглый год». */
export function seasonText(a: Attraction, now = new Date()): string {
  if (!a.season) return 'круглый год';
  return inSeason(a, now) ? `сезон до ${FROM[a.season[1] - 1]}` : `откроется в ${MONTHS[a.season[0] - 1]}`;
}

/** Часы, цены и отзывы — в карточке 2ГИС (там их обновляют сами места). */
export const gisUrl = (a: Attraction) => `https://2gis.kz/almaty/search/${encodeURIComponent(a.name)}/geo/${a.lon},${a.lat}`;
