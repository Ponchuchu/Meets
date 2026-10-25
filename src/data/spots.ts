// Постоянные места из базы (таблица spots, миграция 37) с запасным списком из приложения,
// и превращение похода в план: «Кок-Тобе, сб 18:30» попадает в «Планы» с напоминанием.
import type { Attraction, AttractionKind, Hours } from './attractions';
import { ATTRACTIONS } from './attractions';
import type { Category, EventItem } from './types';
import { supabase, withTimeout } from './client';
import { config } from '../lib/config';

interface SpotRow {
  id: string; parent_id: string | null; name: string; kind: string; lat: number; lon: number; address: string | null; about: string; tips: string[] | null;
  solo: boolean; free: boolean; season: number[] | null; buy_url: string | null; info_url: string | null; kaspi_url: string | null;
  hours: Hours | null; price_from: number | null; price_note: string | null; checked_at: string | null;
}

const toSpot = (r: SpotRow): Attraction => ({
  id: r.id, parent: r.parent_id ?? undefined, name: r.name, kind: r.kind as AttractionKind, lat: r.lat, lon: r.lon, address: r.address ?? undefined,
  about: r.about, tips: r.tips ?? undefined, solo: r.solo, free: r.free, season: r.season?.length === 2 ? [r.season[0], r.season[1]] : undefined,
  buy: r.buy_url ?? undefined, info: r.info_url ?? undefined, kaspi: r.kaspi_url, hours: r.hours, priceFrom: r.price_from, priceNote: r.price_note, checkedAt: r.checked_at,
});

/** Места: из базы (там часы и цены от сборщика), без базы или без таблицы — встроенный список. */
export async function getSpots(): Promise<Attraction[]> {
  if (config.dataMode === 'demo') return ATTRACTIONS;
  try {
    const { data, error } = await withTimeout(supabase().from('spots').select('*').eq('enabled', true));
    if (error || !data?.length) return ATTRACTIONS;
    // Фото, «как попасть» и известные часы — из приложения; часы сборщика главнее.
    const local = new Map(ATTRACTIONS.map((a) => [a.id, a]));
    const rows = (data as SpotRow[]).map(toSpot).map((x) => {
      const l = local.get(x.id);
      return l ? { ...x, photos: l.photos, howTo: l.howTo, hours: x.hours && Object.keys(x.hours).length ? x.hours : l.hours } : x;
    });
    const missing = ATTRACTIONS.filter((a) => !rows.some((r) => r.id === a.id));
    return [...rows, ...missing];
  } catch { return ATTRACTIONS; }
}

const CATEGORY: Partial<Record<AttractionKind, Category>> = {
  ski: 'sport', skate: 'sport', climb: 'sport', trampoline: 'sport', golf: 'sport', paintball: 'games', bowling: 'games', quest: 'games', vr: 'games',
  museum: 'art', photo: 'art', park: 'hike', garden: 'hike', view: 'hike', cable: 'hike', zoo: 'hike', wheel: 'games', aqua: 'sport', zipline: 'sport',
  fun: 'games', billiards: 'games', gallery: 'art', horse: 'sport',
};

/** Поход в место → план (как своя встреча): время начала, 2 часа, место и пометка «один» или «с друзьями». */
export function spotPlan(a: Attraction, startsAt: string, solo: boolean): EventItem {
  return {
    id: `spot-${a.id}-${Date.parse(startsAt)}`, title: a.name, category: CATEGORY[a.kind] ?? 'meetup', tags: solo ? ['можно одному'] : [],
    startsAt, endsAt: new Date(Date.parse(startsAt) + 2 * 3600e3).toISOString(), isLong: false,
    venueName: a.name, address: a.address ?? a.name, lat: a.lat, lon: a.lon, needsPin: false,
    priceMin: a.priceFrom ?? (a.free ? 0 : null), priceMax: null, isFree: !!a.free, about: a.about, organizer: 'Ты', sourceUrl: a.buy ?? a.info ?? null,
    cover: null, visibility: 'friends', origin: 'demo', friendsGoing: [], lookingCount: 0, goingCount: 1,
    meetup: { kind: 'walk', plusOne: false, invited: [], items: [] },
  } as EventItem;
}
