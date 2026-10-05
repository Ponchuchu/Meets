// Значки: 30 штук, «за разнообразие, а не за количество». Условия — docs/BADGES.md.
export interface BadgeDef {
  id: string;
  name: string;
  icon: string; // путь SVG 24×24
  goal: number; // сколько нужно для получения
  how: string;
}

const I = {
  compass: 'M12 3a9 9 0 100 18 9 9 0 000-18zM15.5 8.5l-2 5-5 2 2-5z',
  peak: 'M3 20l6-10 4 6 3-4 5 8z',
  home: 'M4 11l8-7 8 7v9H4zM10 20v-5h4v5',
  globe: 'M12 3a9 9 0 100 18 9 9 0 000-18zM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18',
  city: 'M4 21V9l6-4v16M10 21V3l10 5v13M4 21h16M14 11h2M14 15h2',
  people: 'M9 11.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5M16 4.5a3.5 3.5 0 010 7M18 14.8c1.9.7 3.1 2.5 3.5 5.2',
  moon: 'M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z',
  map: 'M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3zM9 3v15M15 6v15',
  boot: 'M5 3h5v8l7 3a3 3 0 013 3v2H5zM5 15h15',
  film: 'M4 5h16v14H4zM8 5v14M16 5v14M4 9h4M4 15h4M16 9h4M16 15h4',
  mic: 'M9 3h6v11H9zM5 11a7 7 0 0014 0M12 18v3',
  note: 'M9 18V5l11-2v13M6 21a3 3 0 100-6 3 3 0 000 6zM17 19a3 3 0 100-6 3 3 0 000 6z',
  heart: 'M12 20s-7-4.5-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.5-7 10-7 10z',
  sun: 'M12 8a4 4 0 110 8 4 4 0 010-8zM12 2.5v2M12 19.5v2M4.6 4.6L6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4L6 18M18 6l1.4-1.4',
  rain: 'M7 15.5a4 4 0 01-.5-7.97A6 6 0 0118 6.5a4.5 4.5 0 01-.5 9zM8 22l1.2-2.5M12 22l1.2-2.5M16 22l1.2-2.5',
  star: 'M12 3l2.6 5.6L20 9.3l-4 4 1 5.7-5-2.8-5 2.8 1-5.7-4-4 5.4-.7z',
  dice: 'M4 4h16v16H4zM9 9h.01M15 15h.01M15 9h.01M9 15h.01',
  cup: 'M4 8h13v5a5 5 0 01-5 5H9a5 5 0 01-5-5V8zM17 10h1.5a2.5 2.5 0 010 5H17',
  bike: 'M5.5 20.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM18.5 20.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM5.5 17L9 9h6l3.5 8M9 9L7.5 6H5.5',
  chat: 'M4 5h16v11H9l-5 4z',
  plus: 'M12 5v14M5 12h14M12 3a9 9 0 100 18 9 9 0 000-18z',
  book: 'M4 4h7a3 3 0 013 3v13a2 2 0 00-2-2H4zM20 4h-7a3 3 0 00-3 3v13a2 2 0 012-2h8z',
  flag: 'M5 21V4h11l-2 4 2 4H5',
  clock: 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 7v5l3 2',
  spark: 'M4 20l5-14 9 9zM14 4l1 2M19 7l2-1M18 3l-1 2',
  cam: 'M4 8h3l2-3h6l2 3h3v11H4zM12 9.5a3.5 3.5 0 100 7 3.5 3.5 0 000-7z',
};

export const BADGES: BadgeDef[] = [
  { id: 'opener', name: 'Открыватель', icon: I.compass, goal: 1, how: 'Первым из друзей отметился на новом месте' },
  { id: 'above', name: 'Выше города', icon: I.peak, goal: 1, how: 'Отметился на событии выше 1 500 м (Кок-Тобе, Медеу, горы)' },
  { id: 'host', name: 'Хозяин вечера', icon: I.home, goal: 1, how: 'Устроил встречу, на которую пришли 3+ гостя' },
  { id: 'countries3', name: 'Три страны', icon: I.globe, goal: 3, how: 'Отмечался на событиях в 3 странах' },
  { id: 'cities5', name: 'Пять городов', icon: I.city, goal: 5, how: 'Отмечался на событиях в 5 городах' },
  { id: 'regular', name: 'Свой человек', icon: I.people, goal: 3, how: 'Трижды на событиях одного организатора' },
  { id: 'night', name: 'Ночная смена', icon: I.moon, goal: 3, how: '3 события, закончившихся после полуночи' },
  { id: 'districts', name: 'Все районы', icon: I.map, goal: 8, how: 'Хотя бы одно событие в каждом из 8 районов Алматы' },
  { id: 'conqueror', name: 'Покоритель', icon: I.boot, goal: 3, how: '3 похода разных маршрутов' },
  { id: 'film', name: 'Плёночник', icon: I.film, goal: 3, how: '3 кинопоказа в разных местах' },
  { id: 'laugh', name: 'Смешинка', icon: I.mic, goal: 3, how: '3 стендапа или импрова' },
  { id: 'jazz', name: 'Джазмен', icon: I.note, goal: 3, how: '3 джазовых вечера' },
  { id: 'soul', name: 'Душа компании', icon: I.heart, goal: 5, how: 'Позвал друзей, и 5 из них пришли' },
  { id: 'early', name: 'Жаворонок', icon: I.sun, goal: 3, how: '3 события, начавшихся до 9 утра' },
  { id: 'rain', name: 'Не сахарный', icon: I.rain, goal: 1, how: 'Пришёл на open-air под дождём' },
  { id: 'first', name: 'Первый шаг', icon: I.star, goal: 1, how: 'Первая отметка «Я на месте»' },
  { id: 'games', name: 'Игроман', icon: I.dice, goal: 3, how: '3 вечера настолок или квизов' },
  { id: 'coffee', name: 'Кофейный круг', icon: I.cup, goal: 3, how: '3 маркета или фудфеста' },
  { id: 'wheels', name: 'На колёсах', icon: I.bike, goal: 3, how: '3 велопрогулки или забега' },
  { id: 'icebreaker', name: 'Ледокол', icon: I.chat, goal: 1, how: 'Нашёл компанию через «Ищу компанию» и пришёл вместе' },
  { id: 'plusone', name: 'Плюс один', icon: I.plus, goal: 3, how: 'Трижды привёл друга, который раньше не ходил' },
  { id: 'lecture', name: 'Вечный студент', icon: I.book, goal: 3, how: '3 лекции или мастер-класса' },
  { id: 'scout', name: 'Разведчик', icon: I.flag, goal: 1, how: 'Предложенное тобой событие прошло модерацию' },
  { id: 'streak', name: 'Четыре недели', icon: I.clock, goal: 4, how: 'Выбирался хотя бы раз в неделю 4 недели подряд' },
  { id: 'party', name: 'До рассвета', icon: I.spark, goal: 3, how: '3 вечеринки' },
  { id: 'photo', name: 'Летописец', icon: I.cam, goal: 5, how: 'Выложил фото в 5 чатах событий' },
  { id: 'art', name: 'Ценитель', icon: I.star, goal: 3, how: '3 выставки в разных музеях или галереях' },
  { id: 'genres', name: 'Всеядный', icon: I.compass, goal: 6, how: 'События в 6 разных категориях' },
  { id: 'newcomer', name: 'Проводник', icon: I.people, goal: 3, how: 'Пришёл вместе с тремя новыми знакомыми из приложения' },
  { id: 'city25', name: 'Горожанин', icon: I.map, goal: 25, how: 'Открыл 25% Алматы' },
];

export interface BadgeState extends BadgeDef {
  progress: number;
  got: boolean;
}

export function badgeStates(progress: Record<string, number>): BadgeState[] {
  return BADGES.map((b) => {
    const p = Math.min(b.goal, progress[b.id] ?? 0);
    return { ...b, progress: p, got: p >= b.goal };
  });
}

/** Порядок в профиле: сначала полученные, потом начатые, остальные — в конце (внутри — как в списке). */
export function sortBadges(list: BadgeState[]): BadgeState[] {
  const rank = (b: BadgeState) => (b.got ? 0 : b.progress > 0 ? 1 : 2);
  return [...list].sort((a, b) => rank(a) - rank(b));
}
