// Иконки категорий для пинов (пути из макета Main / Feed).
import type { Category } from '../data/types';

export const CAT_ICON: Record<Category, string> = {
  music: 'M9 18V5l11-2v13M6 21a3 3 0 100-6 3 3 0 000 6zM17 19a3 3 0 100-6 3 3 0 000 6z',
  concert: 'M3 11v2a1 1 0 001 1h2l5 4V6L6 10H4a1 1 0 00-1 1zM15.5 8.5a5 5 0 010 7M18.5 5.5a9 9 0 010 13',
  party: 'M4 20l5-14 9 9zM14 4l1 2M19 7l2-1M18 3l-1 2',
  standup: 'M9 3h6v11H9zM5 11a7 7 0 0014 0M12 18v3',
  art: 'M12 3l2.6 5.6L20 9.3l-4 4 1 5.7-5-2.8-5 2.8 1-5.7-4-4 5.4-.7z',
  movie: 'M4 3h16v18H4zM4 7h16M4 17h16M8 3v18M16 3v18',
  theatre: 'M12 3l2.6 5.6L20 9.3l-4 4 1 5.7-5-2.8-5 2.8 1-5.7-4-4 5.4-.7z',
  hike: 'M3 20l6-10 4 6 3-4 5 8z',
  games: 'M4 4h16v16H4zM9 9h.01M15 15h.01M15 9h.01M9 15h.01',
  food: 'M4 8h13v5a5 5 0 01-5 5H9a5 5 0 01-5-5V8zM17 10h1.5a2.5 2.5 0 010 5H17',
  sport: 'M5.5 20.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM18.5 20.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM5.5 17L9 9h6l3.5 8M9 9L7.5 6H5.5',
  bike: 'M5.5 20.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM18.5 20.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM5.5 17L9 9h6l3.5 8M9 9L7.5 6H5.5',
  talks: 'M4 5h16v14H4zM8 5v14M16 5v14M4 9h4M4 15h4M16 9h4M16 15h4',
  lecture: 'M4 5h16v14H4zM8 5v14M16 5v14M4 9h4M4 15h4M16 9h4M16 15h4',
  meetup: 'M9 11.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5M16 4.5a3.5 3.5 0 010 7M18 14.8c1.9.7 3.1 2.5 3.5 5.2',
};

export const CAT_LABEL: Record<Category, string> = {
  music: 'МУЗЫКА', concert: 'КОНЦЕРТ', party: 'ВЕЧЕРИНКА', standup: 'СТЕНДАП', art: 'ВЫСТАВКА', theatre: 'ТЕАТР', movie: 'КИНО',
  hike: 'ГОРЫ', games: 'НАСТОЛКИ', food: 'ЕДА', sport: 'СПОРТ', bike: 'ВЕЛО', talks: 'ЛЕКЦИЯ', lecture: 'ЛЕКЦИЯ', meetup: 'ВСТРЕЧА',
};

/** Цвет точки по категории: карта читается с одного взгляда. Тёплые — музыка и вечер, холодные — спорт и горы. */
export const CAT_COLOR: Record<Category, string> = {
  music: '#F0521F', concert: '#D8362A', party: '#8B4FD8', standup: '#F2B632', art: '#2E86A8', theatre: '#C23B74', movie: '#6856A8',
  hike: '#3F8F4E', games: '#5A6BDB', food: '#E07A2C', sport: '#179C87', bike: '#179C87', talks: '#6B5E4E',
  lecture: '#6B5E4E', meetup: '#17161A',
};

/** Иконка поверх цвета: на светлых (стендап) — тёмная, на остальных — белая. */
export const catFg = (c: Category) => (c === 'standup' ? '#17161A' : '#FFFFFF');
