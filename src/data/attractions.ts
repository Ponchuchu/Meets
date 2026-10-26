// Постоянные места (21 октября, идеи владельца): горы, катки, парки, музеи, боулинг, батуты, квесты, фотозоны —
// и отдельный акцент «сходить одному»: куда пойти развеяться без компании.
// Это исходный список. В базе он живёт в таблице spots (миграция 37 собрана из этого файла скриптом scripts/spots-sql.mjs);
// сборщик (worker/src/spots.ts) сам дописывает туда часы работы с перерывами и цены — с официальных сайтов
// (разметка schema.org и текст страниц). Что известно наверняка (Терренкур, парки — всегда открыты), записано здесь.
// Фото — с Викисклада (свободная лицензия), грузятся по ссылке и кэшируются; не загрузилось — шапка цвета места.
// Точки — из справочника Overture, проверены вручную (там много дублей и ошибок).
import { COMMONS_HASH } from './commonsHash';

export type AttractionKind = 'ski' | 'skate' | 'cable' | 'wheel' | 'bowling' | 'trampoline' | 'climb' | 'quest' | 'vr' | 'golf' | 'paintball' | 'aqua' | 'photo' | 'zipline'
  | 'park' | 'museum' | 'zoo' | 'garden' | 'view' | 'fun' | 'billiards' | 'gallery' | 'horse';

/** Часы по дням недели ISO (1 — пн … 7 — вс): интервалы работы; два интервала — между ними перерыв; [] — выходной. */
export type Hours = Partial<Record<'1' | '2' | '3' | '4' | '5' | '6' | '7', [string, string][]>>;

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
  /** Хорошо и одному: можно прийти без компании и не скучать. */
  solo?: boolean;
  /** Советы, особенно если идёшь один. */
  tips?: string[];
  /** Часть большого места (смотровая — часть Кок-Тобе): на карте не рисуется, показывается внутри карточки родителя. */
  parent?: string;
  /** Сезон: месяцы работы (1–12), например горнолыжка — с ноября по апрель. Нет — круглый год. */
  season?: [number, number];
  /** Официальная страница покупки (только где уверены, что она есть). */
  buy?: string;
  /** Официальный сайт — сборщик читает с него часы и цены. */
  info?: string;
  /** Из базы (сборщик): часы, цена, когда проверено. */
  hours?: Hours | null;
  priceFrom?: number | null;
  priceNote?: string | null;
  kaspi?: string | null;
  checkedAt?: string | null;
  /** Фото для шапки карточки (листаются). */
  photos?: string[];
  /** Как попасть бесплатно и прочее, что важно знать до выхода. */
  howTo?: string;
  /** В каком ТРЦ (аквапарк — в Aport Mall West): карточка центра показывает место с фото. */
  mall?: string;
  /** Шаг выбора времени, мин: колесо показывает только реальные времена (12:00, 12:30…). */
  stepMin?: number;
}

/** Открыто всегда (парки, тропы). */
export const ALWAYS: Hours = { 1: [['00:00', '24:00']], 2: [['00:00', '24:00']], 3: [['00:00', '24:00']], 4: [['00:00', '24:00']], 5: [['00:00', '24:00']], 6: [['00:00', '24:00']], 7: [['00:00', '24:00']] };
/** Фото с Викисклада по имени файла: сервер сам отдаёт уменьшенную копию 1200 px. */
/** Фото Викисклада: прямая ссылка на уменьшенную копию 960 px (без переадресации); неизвестный файл — через Special:FilePath. */
export const commons = (file: string) => {
  const name = encodeURIComponent(file.replace(/ /g, '_'));
  const h = COMMONS_HASH[file];
  return h ? `https://upload.wikimedia.org/wikipedia/commons/thumb/${h}/${name}/960px-${name}` : `https://commons.wikimedia.org/wiki/Special:FilePath/${name}?width=960`;
};

export const KIND_LABEL: Record<AttractionKind, string> = {
  ski: 'Горнолыжный курорт', skate: 'Каток', cable: 'Канатная дорога', wheel: 'Колесо обозрения', bowling: 'Боулинг',
  trampoline: 'Батутный парк', climb: 'Скалодром', quest: 'Квесты', vr: 'VR-парк', golf: 'Гольф', paintball: 'Пейнтбол',
  aqua: 'Аквапарк', photo: 'Фотозона', zipline: 'Зиплайн', park: 'Парк', museum: 'Музей', zoo: 'Зоопарк', garden: 'Сад', view: 'Смотровая',
  fun: 'Парк развлечений', billiards: 'Бильярд', gallery: 'Галерея', horse: 'Конные прогулки',
};

export const KIND_COLOR: Record<AttractionKind, string> = {
  ski: '#2C6FB0', skate: '#4FA3D9', cable: '#1F9AA8', wheel: '#E0457B', bowling: '#3A3046', trampoline: '#E2A21B', climb: '#B5651D',
  quest: '#5B5BD6', vr: '#7E5BD6', golf: '#2F8F5B', paintball: '#C83A26', aqua: '#2AA5B8', photo: '#F0521F', zipline: '#3E7E4E',
  park: '#3E8E4E', museum: '#8A5A3C', zoo: '#C98A1B', garden: '#5C9E3F', view: '#D9822B',
  fun: '#E0457B', billiards: '#2F6B4F', gallery: '#6A45C9', horse: '#8A5A3C',
};

export const ATTRACTIONS: Attraction[] = [
  // ——— Горы ———
  { id: 'shymbulak', photos: [commons('Shymbulak mountain in February 2024 09.jpg'), commons('Chimbulak automne.JPG'), commons('Shymbulak Alatau mountains in Almaty.jpg')], name: 'Шымбулак', kind: 'ski', lat: 43.12786, lon: 77.08092, address: 'ул. Горная, 640', about: 'Горнолыжный курорт: трассы, гондола с Медеу, виды на 3200 м', season: [11, 4], buy: 'https://shymbulak.com', info: 'https://shymbulak.com', solo: true,
    tips: ['Одному — на кресельной канатке до Талгарского перевала: тишина и облака под ногами', 'Наверху холоднее на 10–15 градусов — возьми куртку и летом'] },
  { id: 'shymbulak-pass', parent: 'shymbulak', name: 'Талгарский перевал, 3200 м', kind: 'view', lat: 43.11294, lon: 77.11521, about: 'Верхняя точка канатки: ледник, облака, панорама' },
  { id: 'shymbulak-swing', parent: 'shymbulak', name: 'Качели у Шымбулака', kind: 'photo', lat: 43.12766, lon: 77.08080, about: 'Качели над ущельем — самый узнаваемый кадр в горах', free: true },
  { id: 'medeu', photos: [commons('Medeu Skating Rink in Almaty Kazakhstan.jpg'), commons('Medeu- 4.jpg')], howTo: 'Лестница к плотине и вид на ущелье — бесплатно в любое время.', name: 'Медеу', kind: 'skate', lat: 43.15755, lon: 77.05856, address: 'ул. Горная, 465', about: 'Высокогорный каток под открытым небом, плотина и тропы в горы', season: [11, 3], solo: true,
    tips: ['На каток можно одному — прокат коньков на месте', 'Вне сезона — лестница к плотине и вид на ущелье, это бесплатно'] },
  { id: 'medeu-dam', parent: 'medeu', name: 'Плотина и лестница', kind: 'view', lat: 43.15755, lon: 77.05856, about: 'Длинная лестница к плотине над Медеу: тренировка и лучший вид на ущелье', free: true },
  { id: 'medeu-gondola', parent: 'medeu', name: 'Гондола Медеу — Шымбулак', kind: 'cable', lat: 43.16306, lon: 77.05164, about: 'Канатная дорога в горы, работает круглый год' },
  { id: 'tabagan', name: 'Табаган', kind: 'ski', lat: 43.21460, lon: 77.09642, about: 'Горнолыжная база и зона отдыха в Талгарском ущелье', season: [12, 3] },
  { id: 'oi-qaragai', name: 'Пейнтбол Ой-Карагай', kind: 'paintball', lat: 43.22729, lon: 77.14919, about: 'Пейнтбол в лесу ущелья Ой-Карагай' },
  { id: 'bao', name: 'Большое Алматинское озеро', kind: 'view', lat: 43.0507, lon: 76.9850, about: 'Бирюзовое озеро в горах на высоте 2500 м', free: true, solo: true, season: [5, 10],
    photos: [commons('Big Almaty Lake (Bolshaya Almatinka), Almaty region, Kazakhstan. October 2007.jpg'), commons('Big Almaty Lake from pass.jpg')],
    howTo: 'Бесплатно. Дорога — по ущелью Большой Алматинки, последние километры пешком; купаться нельзя, это водохранилище.',
    tips: ['Выезжай утром: к обеду облака закрывают вершины', 'Наверху холодно даже летом — возьми тёплое'] },
  // ——— Кок-Тобе ———
  { id: 'koktobe', photos: [commons('Алматы, Кок-Тобе сверху.jpg'), commons('Almaty Skyline from the Kök Töbe hill.jpg')], howTo: 'Подняться можно бесплатно пешком — тропа от Терренкура, 40–50 минут вверх. Канатка — платно.', name: 'Кок-Тобе', kind: 'cable', lat: 43.24242, lon: 76.95908, address: 'пр. Достык, 104А', about: 'Канатка на гору: смотровая, аттракционы, кафе и огни города вечером', buy: 'https://koktobe.com', info: 'https://koktobe.com', solo: true,
    tips: ['Одному лучше всего к закату: подняться на канатке и смотреть, как зажигается город', 'Обратно можно пешком по тропе — 30–40 минут вниз'] },
  { id: 'koktobe-view', parent: 'koktobe', name: 'Смотровая площадка', kind: 'view', lat: 43.23390, lon: 76.97590, about: 'Весь город и горы в одном кадре, вечером — огни', free: true },
  { id: 'koktobe-beatles', parent: 'koktobe', name: 'Памятник The Beatles', kind: 'photo', lat: 43.23390, lon: 76.97590, about: 'Четвёрка на скамейке — можно сесть рядом и сфотографироваться', free: true },
  { id: 'koktobe-rides', parent: 'koktobe', name: 'Парк аттракционов', kind: 'fun', lat: 43.23390, lon: 76.97590, about: 'Горки, автодром, тир и детские карусели на вершине' },
  { id: 'koktobe-wheel', parent: 'koktobe', name: 'Колесо обозрения', kind: 'wheel', lat: 43.23395, lon: 76.97585, about: 'Закрытые кабинки над городом: весь Алматы и горы', solo: true, stepMin: 15 },
  { id: 'koktobe-rope', parent: 'koktobe', name: 'Верёвочный парк', kind: 'climb', lat: 43.23380, lon: 76.97560, about: 'Трассы на высоте среди деревьев, со страховкой' },
  { id: 'koktobe-coaster', parent: 'koktobe', name: 'Fast Coaster', kind: 'fun', lat: 43.23400, lon: 76.97620, about: 'Горка-бобслей по склону горы', stepMin: 15 },
  { id: 'koktobe-zoo', parent: 'koktobe', name: 'Контактный зоопарк', kind: 'zoo', lat: 43.23370, lon: 76.97600, about: 'Козы, кролики и птицы — можно покормить' },
  // ——— Сходить одному: город ———
  { id: 'panfilov-park', photos: [commons('Алматы, парк 28 панфиловцев сверху (2).jpg'), commons('Zenkov Cathedral Winter.jpg')], hours: ALWAYS, name: 'Парк 28 панфиловцев', kind: 'park', lat: 43.25883, lon: 76.95413, address: 'ул. Гоголя, 40', about: 'Старый парк в центре: Вознесенский собор, аллеи, кофе с собой', free: true, solo: true,
    tips: ['Утром в выходные тихо и красиво', 'Рядом Зелёный базар — можно зайти за фруктами'] },
  { id: 'gorky-park', name: 'Центральный парк', kind: 'park', lat: 43.26128, lon: 76.96327, address: 'ул. Гоголя, 1', about: 'Большой парк с озером, лодками и аттракционами', free: true, solo: true,
    tips: ['Лодку можно взять и одному', 'Вечером на набережной уличные музыканты'] },
  { id: 'president-park', hours: ALWAYS, name: 'Парк Первого Президента', kind: 'park', lat: 43.19366, lon: 76.88679, about: 'Фонтаны и вид на горы — лучшая прогулка на закате', free: true, solo: true,
    tips: ['Лучший свет за час до заката: горы розовые', 'Летом по вечерам работают поющие фонтаны'] },
  { id: 'botanic', name: 'Главный ботанический сад', kind: 'garden', lat: 43.22689, lon: 76.92887, address: 'ул. Тимирязева, 36д', about: 'Тихие аллеи, оранжерея и пруды посреди города', solo: true,
    tips: ['Идеально, чтобы побыть одному: людей мало, телефон можно убрать'] },
  { id: 'terrenkur', photos: [commons('View of Kok Tobe from Terrenkur.jpg'), commons('The Esentay with the Almaty Towers (AP4M2507 1PS) (29050959892).jpg')], hours: ALWAYS, howTo: 'Бесплатно и круглосуточно — это парковая тропа вдоль реки.', name: 'Терренкур', kind: 'park', lat: 43.22375, lon: 76.96713, address: 'за пр. Достык', about: 'Прогулочная тропа вдоль реки к горам', free: true, solo: true,
    tips: ['Можно идти час в сторону гор и вернуться — маршрут сам ведёт'] },
  { id: 'arbat', hours: ALWAYS, name: 'Арбат', kind: 'photo', lat: 43.2614, lon: 76.9450, address: 'ул. Жибек Жолы', about: 'Пешеходная улица: музыканты, художники, вечерний свет', free: true, solo: true },
  { id: 'republic-sq', hours: ALWAYS, name: 'Площадь Республики', kind: 'photo', lat: 43.2381, lon: 76.9454, about: 'Монумент Независимости и горы за ним', free: true },
  { id: 'kasteev', name: 'Музей искусств им. Кастеева', kind: 'museum', lat: 43.23593, lon: 76.91870, about: 'Казахское и мировое искусство — спокойный вечер наедине с картинами', solo: true,
    tips: ['Возьми аудиогид — с ним интереснее, чем в компании'] },
  { id: 'central-museum', name: 'Центральный государственный музей', kind: 'museum', lat: 43.23582, lon: 76.94966, address: 'мкр. Самал-1, 44', about: 'История Казахстана от саков до наших дней', solo: true },
  { id: 'museum-of-arts', name: 'Almaty Museum of Arts', kind: 'museum', lat: 43.22699, lon: 76.94903, about: 'Новый музей современного искусства', solo: true,
    tips: ['Кафе при музее — хорошее место посидеть с книгой'] },
  { id: 'zoo', name: 'Алматинский зоопарк', kind: 'zoo', lat: 43.26342, lon: 76.97471, address: 'ул. Есенберлина, 166', about: 'Зоопарк рядом с Центральным парком', solo: true },
  // ——— Активно ———
  { id: 'happy-eye', name: 'Колесо Happy Eye', kind: 'wheel', lat: 43.20108, lon: 76.89373, address: 'ул. Розыбакиева, 273', about: 'Колесо обозрения с видом на горы и город', solo: true },
  { id: 'octopus', name: 'Аквапарк «Осьминог»', kind: 'aqua', lat: 43.26234, lon: 76.97124, address: 'Парк Горького, ул. Гоголя, 1', about: 'Летний аквапарк в Центральном парке', season: [6, 8] },
  { id: 'gorilla', name: 'Gorilla Zipline · Сункар', kind: 'zipline', lat: 43.21041, lon: 76.93334, address: 'проспект Аль-Фараби, 128/8 (трамплины «Сункар»)', about: 'Спуск по тросу над трамплинами — сидя или лёжа, и прыжок rope jumping', priceFrom: 10000 },
  { id: 'gorilla-medeu', name: 'Gorilla Zipline · Медеу', kind: 'zipline', lat: 43.16306, lon: 77.05164, address: 'станция гондолы Медеу', about: 'Зиплайн над ущельем у катка Медеу', priceFrom: 4500 },
  { id: 'hawaii-miami', name: 'Аквапарк Hawaii & Miami', kind: 'aqua', lat: 43.23306, lon: 76.82176, address: 'Ташкентский тракт, 17к (Aport Mall West)', about: 'Круглый год: горки, волновой бассейн, тёплые бассейны и летняя зона Miami Sunrise', mall: 'Aport Mall West', priceFrom: 13940, stepMin: 60 },
  { id: 'zhailjau', name: 'Гольф-клуб «Жайляу»', kind: 'golf', lat: 43.18163, lon: 76.87844, address: 'мкр. Мирас, 188', about: 'Поле для гольфа с видом на горы', season: [4, 10] },
  // Конные прогулки (26 октября): адреса и точки — из справочника адресов; часы и цены уточняются по записи.
  { id: 'argamak', name: 'КСК «Аргамак»', kind: 'horse', lat: 43.31039, lon: 76.92518, address: 'улица Омарова, 10а (Центральный ипподром)', about: 'Прогулки верхом и занятия с тренером на ипподроме — по записи', solo: true },
  { id: 'tulpar', name: 'КСК «Тулпар»', kind: 'horse', lat: 43.31315, lon: 76.92923, address: 'улица Жансугурова, 262/2', about: 'Прогулки верхом и уроки езды с тренером, можно впервые' },
  { id: 'altyn-tai', name: 'Конный клуб «Алтын Тай»', kind: 'horse', lat: 43.18595, lon: 77.03847, address: 'Бутаковское ущелье, 7,5 км', about: 'Прогулки верхом по горам Бутаковки', solo: true },
  { id: 'family-bowling', name: 'Family Bowling', kind: 'bowling', lat: 43.22803, lon: 76.85302, address: 'ул. Улугбека, 57', about: 'Боулинг и семейный парк развлечений' },
  { id: 'madison', name: 'Боулинг «Мэдисон»', kind: 'bowling', lat: 43.23915, lon: 76.93348, address: 'ТРК «Форум», пр. Сейфуллина, 617', about: 'Боулинг и караоке' },
  { id: 'bastau', name: 'Bowling Bastau', kind: 'bowling', lat: 43.25070, lon: 76.92062, address: 'ул. Шагабутдинова, 109а', about: 'Боулинг в центре' },
  { id: 'krapiva', name: 'Боулинг «Крапива»', kind: 'bowling', lat: 43.23988, lon: 76.85767, address: '1-й мкр., 12', about: 'Боулинг и бар' },
  { id: 'kango', name: 'Батутный парк Kango', kind: 'trampoline', lat: 43.20263, lon: 76.89090, address: 'MEGA, ул. Розыбакиева, 247А', about: 'Батуты, поролоновая яма, ниндзя-полоса' },
  { id: 'gravity', name: 'Батутный парк «Гравитация»', kind: 'trampoline', lat: 43.23671, lon: 76.84572, address: 'ул. Кабдолова, 1', about: 'Батутный парк' },
  { id: 'cozyrock', name: 'CozyRock', kind: 'climb', lat: 43.24190, lon: 76.87749, address: 'ул. Брусиловского, 167', about: 'Скалодром: болдеринг и трассы', solo: true,
    tips: ['На болдеринг приходят по одному — с соседями по стене знакомишься сам собой'] },
  { id: 'questoria', name: 'Questoria', kind: 'quest', lat: 43.22185, lon: 76.90236, address: 'ул. Жарокова, 210Б', about: 'Квесты в реальности' },
  { id: 'rift-vr', name: 'Rift VR Park', kind: 'vr', lat: 43.20918, lon: 76.95374, about: 'Виртуальная реальность для компании' },
];

/** Работает ли сезонное место в этом месяце. */
export function inSeason(a: Pick<Attraction, 'season'>, now = new Date()): boolean {
  if (!a.season) return true;
  const m = new Date(now.getTime() + 5 * 3600e3).getUTCMonth() + 1;
  const [from, to] = a.season;
  return from <= to ? m >= from && m <= to : m >= from || m <= to;
}

const MONTHS = ['январе', 'феврале', 'марте', 'апреле', 'мае', 'июне', 'июле', 'августе', 'сентябре', 'октябре', 'ноябре', 'декабре'];
const FROM = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
/** «сезон до апреля» / «откроется в ноябре» / «круглый год». */
export function seasonText(a: Pick<Attraction, 'season'>, now = new Date()): string {
  if (!a.season) return 'круглый год';
  return inSeason(a, now) ? `сезон до ${FROM[a.season[1] - 1]}` : `откроется в ${MONTHS[a.season[0] - 1]}`;
}


/** Места на карте — без «частей» (они внутри карточки большого места). */
export const topSpots = (list: Attraction[]) => list.filter((a) => !a.parent);
export const partsOf = (list: Attraction[], id: string) => list.filter((a) => a.parent === id);
