import { isRemoteId } from '../data/realtime';
import type { EventItem } from '../data/types';

/** Параметры экрана маршрута. У события из базы хватает id; у места или своей встречи id не из базы — передаём точку (27 окт.: иначе «Маршрут недоступен»). */
export function routeParams(e: Pick<EventItem, 'id' | 'lat' | 'lon' | 'title' | 'venueName' | 'address'>): Record<string, string> {
  if (isRemoteId(e.id) || !Number.isFinite(e.lat) || !Number.isFinite(e.lon)) return { id: e.id };
  return { id: e.id, lat: String(e.lat), lon: String(e.lon), title: e.venueName ?? e.title, address: e.address ?? '' };
}
