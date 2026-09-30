// Фильтры карты: даты, цена, категории, слои (PRODUCT.md, раздел 3). Времени и расстояния в фильтре нет.
import { dayIndex } from '../lib/clock';
import type { Category, EventItem } from '../data/types';
import { endOf, phaseOf } from './lifecycle';

export type FilterCat = 'music' | 'standup' | 'hike' | 'art' | 'games' | 'food' | 'sport' | 'talks';

export const FILTER_CATS: [FilterCat, string][] = [
  ['music', 'Музыка'], ['standup', 'Стендап'], ['hike', 'Горы'], ['art', 'Выставки'],
  ['games', 'Настолки'], ['food', 'Еда'], ['sport', 'Спорт'], ['talks', 'Лекции'],
];

const CAT_GROUP: Record<Category, FilterCat | null> = {
  music: 'music', concert: 'music', party: 'music', standup: 'standup', hike: 'hike', art: 'art', theatre: 'art',
  games: 'games', food: 'food', sport: 'sport', bike: 'sport', talks: 'talks', lecture: 'talks', meetup: 'talks',
};

export const MAX_PRICE = 20000;

export interface MapFilters {
  /** Смещения дней от сегодня, включительно. */
  from: number;
  to: number;
  free: boolean;
  max: number; // 20000 — любой
  cats: FilterCat[];
  friends: boolean;
  company: boolean;
}

export const DEFAULT_FILTERS: MapFilters = { from: 0, to: 0, free: false, max: MAX_PRICE, cats: [], friends: true, company: false };

export function activeCount(f: MapFilters): number {
  return (f.free || f.max < MAX_PRICE ? 1 : 0) + (f.cats.length ? 1 : 0) + (!f.friends ? 1 : 0) + (f.company ? 1 : 0);
}

export function occursOnDay(e: Pick<EventItem, 'startsAt' | 'endsAt'>, day: number): boolean {
  const a = dayIndex(e.startsAt);
  const b = dayIndex(new Date(endOf(e) - 1));
  return day >= a && day <= b;
}

export function matchesPrice(e: Pick<EventItem, 'isFree' | 'priceMin'>, f: Pick<MapFilters, 'free' | 'max'>): boolean {
  const price = e.isFree ? 0 : e.priceMin ?? 0;
  if (f.free) return price === 0;
  return f.max >= MAX_PRICE || price <= f.max;
}

export function matchesCats(e: Pick<EventItem, 'category'>, cats: FilterCat[]): boolean {
  return cats.length === 0 || cats.includes(CAT_GROUP[e.category] as FilterCat);
}

/** События, которые показываем на карте с этими фильтрами. going — id событий, куда я иду. */
export function visibleEvents(events: EventItem[], f: MapFilters, now: Date, going: Set<string> = new Set()): EventItem[] {
  const today = dayIndex(now);
  return events.filter((e) => {
    // Сегодня действует жизнь точки (прошедшее и закрытое прячем), будущие дни — просто по датам.
    let inDays = false;
    for (let d = today + f.from; d <= today + f.to; d++) {
      if (!occursOnDay(e, d)) continue;
      if (d === today && phaseOf(e, now, going.has(e.id)) === 'hidden') continue;
      inDays = true;
      break;
    }
    return inDays && matchesPrice(e, f) && matchesCats(e, f.cats);
  });
}

export function pluralEvents(n: number): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return 'событие';
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return 'события';
  return 'событий';
}

export const showLabel = (n: number) => (n === 0 ? 'Ничего не нашлось' : `Показать ${n} ${pluralEvents(n)}`);
