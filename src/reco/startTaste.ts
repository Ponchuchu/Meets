// Стартовый вкус из ответов регистрации (docs/RECOMMENDATIONS.md, разделы 2 и 4).
// Интерес = группа тегов; время — сетка 7 дней × утро/день/вечер; бюджет — потолок цены; с кем — множитель.

export const INTERESTS = [
  'music', 'standup', 'hike', 'sport', 'people', 'games', 'art', 'food', 'party', 'talks',
] as const;
export type Interest = (typeof INTERESTS)[number];

export const INTEREST_TAGS: Record<Interest, string[]> = {
  music: ['джаз', 'рок', 'акустика', 'джем', 'open-air-концерт', 'концерт', 'живая музыка'],
  standup: ['стендап', 'импров', 'открытый микрофон', 'юмор'],
  hike: ['поход', 'пикник', 'закат', 'озеро', 'горы'],
  sport: ['забег', 'велопрогулка', 'йога в парке', 'бег', 'спорт'],
  people: ['нетворкинг', 'языковой клуб', 'можно одному', 'знакомства'],
  games: ['мафия', 'настолки', 'квиз'],
  art: ['искусство', 'фото', 'аниме', 'музеи', 'выставка'],
  food: ['маркет', 'фудфест', 'дегустация', 'ярмарка'],
  party: ['вечеринка', 'диджей', 'танцы'],
  talks: ['лекция', 'кинопоказ', 'мастер-класс'],
};

export const TIME_SLOTS = ['weekday', 'friday', 'weekend', 'weekendNight', 'now'] as const;
export type TimeSlot = (typeof TIME_SLOTS)[number];
export type WithWho = 'friends' | 'alone' | 'mixed';
export type Budget = 'free' | 'mid' | 'any';

export interface StartAnswers {
  interests: Interest[];
  times: TimeSlot[];
  withWho: WithWho;
  budget: Budget;
}

export type DayPart = 'morning' | 'day' | 'evening';
/** 7 дней (0 — понедельник) × 3 части дня, значения 0…1. */
export type TimeGrid = Record<DayPart, number>[];

export interface Taste {
  tags: Record<string, number>;
  timeGrid: TimeGrid;
  priceCeiling: number | null; // null — не важно
  friendsMultiplier: number;
  startAnswers: StartAnswers;
}

const BASE = 0.15;

export function buildTimeGrid(times: TimeSlot[]): TimeGrid {
  const grid: TimeGrid = Array.from({ length: 7 }, () => ({ morning: BASE, day: BASE, evening: BASE }));
  const set = (days: number[], parts: DayPart[], v: number) =>
    days.forEach((d) => parts.forEach((p) => { grid[d][p] = Math.max(grid[d][p], v); }));
  if (times.includes('weekday')) set([0, 1, 2, 3, 4], ['evening'], 1);
  if (times.includes('friday')) set([4], ['evening'], 1);
  if (times.includes('weekend')) set([5, 6], ['morning', 'day'], 1);
  if (times.includes('weekendNight')) set([5, 6], ['evening'], 1);
  // «Спонтанно» — немного поднимаем всё: человек готов выбраться в любое время.
  if (times.includes('now')) grid.forEach((d) => (Object.keys(d) as DayPart[]).forEach((p) => { d[p] = Math.max(d[p], 0.5); }));
  return grid;
}

export const PRICE_CEILING: Record<Budget, number | null> = { free: 0, mid: 5000, any: null };
export const FRIENDS_MULTIPLIER: Record<WithWho, number> = { friends: 2.4, mixed: 1.6, alone: 1.1 };

export function buildStartTaste(a: StartAnswers): Taste {
  const tags: Record<string, number> = {};
  for (const i of a.interests) for (const t of INTEREST_TAGS[i]) tags[t] = 1;
  if (a.withWho === 'alone') tags['можно одному'] = Math.max(tags['можно одному'] ?? 0, 0.6);
  if (a.budget === 'free') tags['бесплатно'] = 0.8;
  return {
    tags,
    timeGrid: buildTimeGrid(a.times),
    priceCeiling: PRICE_CEILING[a.budget],
    friendsMultiplier: FRIENDS_MULTIPLIER[a.withWho],
    startAnswers: a,
  };
}
