// Постоянные места в «Рекомендациях» (21 октября): раз в неделю — Кок-Тобе, боулинг, музей, — по вкусу и настроению.
// Не больше двух мест на колоду; одно место — не чаще раза в неделю, «Мимо» убирает его на четыре недели.
// Механика пользователю не показывается (CLAUDE.md).
import { inSeason, topSpots, type Attraction } from '../data/attractions';
import type { Category, EventItem } from '../data/types';
import type { Taste } from './startTaste';

const CATEGORY: Partial<Record<Attraction['kind'], Category>> = {
  ski: 'sport', skate: 'sport', climb: 'sport', trampoline: 'sport', golf: 'sport', aqua: 'sport', zipline: 'sport', paintball: 'games',
  bowling: 'games', quest: 'games', vr: 'games', wheel: 'games', museum: 'art', photo: 'art', park: 'hike', garden: 'hike', view: 'hike', cable: 'hike', zoo: 'hike',
};
const TAGS: Partial<Record<Attraction['kind'], string[]>> = {
  ski: ['горы', 'спорт', 'лыжи'], skate: ['каток', 'спорт'], cable: ['горы', 'прогулка', 'виды'], park: ['прогулка', 'парк'], garden: ['прогулка', 'природа'],
  view: ['виды', 'прогулка'], photo: ['фото', 'прогулка'], museum: ['выставка', 'музей', 'искусство'], zoo: ['прогулка'], bowling: ['боулинг', 'игры'],
  quest: ['квест', 'игры'], vr: ['игры'], climb: ['спорт', 'скалодром'], trampoline: ['спорт'], wheel: ['виды'], golf: ['спорт'],
};

/** Номер недели (по Алматы) — чтобы место показывалось не чаще раза в неделю. */
export const weekOf = (now: Date) => Math.floor((now.getTime() + 5 * 3600e3 + 3 * 86400e3) / (7 * 86400e3));

/** Место → карточка ленты (то же устройство, что у события, с пометкой spotId). */
export function spotCard(a: Attraction, now: Date): EventItem {
  return {
    id: `spot:${a.id}`, spotId: a.id, spot: a, title: a.name, category: CATEGORY[a.kind] ?? 'meetup', tags: [...(TAGS[a.kind] ?? []), ...(a.solo ? ['можно одному'] : [])],
    startsAt: now.toISOString(), endsAt: null, isLong: true, venueName: a.name, address: a.address ?? a.name, lat: a.lat, lon: a.lon, needsPin: false,
    priceMin: a.free ? 0 : a.priceFrom ?? null, priceMax: null, isFree: !!a.free, about: a.tips?.[0] ?? a.about, organizer: null, sourceUrl: a.buy ?? a.info ?? null,
    cover: null, visibility: 'public', origin: 'real', friendsGoing: [], lookingCount: 0, goingCount: 0,
  } as EventItem;
}

export interface SpotMemory { seen: Record<string, number>; skipped: Record<string, number> }

/** До двух мест для колоды: в сезоне, не показанные на этой неделе, не пропущенные за 4 недели, ближе ко вкусу. */
export function pickSpots(all: Attraction[], taste: Taste, mem: SpotMemory, now: Date, opts: { solo?: boolean; max?: number } = {}): Attraction[] {
  const week = weekOf(now);
  return topSpots(all)
    .filter((a) => inSeason(a, now) && mem.seen[a.id] !== week && !(mem.skipped[a.id] != null && week - mem.skipped[a.id] < 4))
    .map((a) => {
      const tags = [...(TAGS[a.kind] ?? []), ...(a.solo ? ['можно одному'] : [])];
      const t = tags.reduce((s, x) => s + (taste.tags[x] ?? 0), 0) / Math.max(1, tags.length);
      // Стабильный «случай» на неделю: каждую неделю — разные места при равном вкусе.
      const jitter = ((a.id.length * 31 + week * 17) % 10) / 40;
      return { a, score: t + (opts.solo && a.solo ? 0.4 : 0) + (a.free ? 0.05 : 0) + jitter };
    })
    .sort((x, y) => y.score - x.score)
    .slice(0, opts.max ?? 2)
    .map((x) => x.a);
}

/** Вставить места в колоду: на 4-ю и 9-ю позиции (или в конец, если событий мало). */
export function withSpots(deck: EventItem[], spots: EventItem[]): EventItem[] {
  const out = [...deck];
  [3, 8].forEach((pos, i) => { if (spots[i]) out.splice(Math.min(pos, out.length), 0, spots[i]); });
  return out;
}
