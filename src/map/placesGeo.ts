// Места справочника → GeoJSON для слоя карты (одинаково на телефоне и в web).
import { PLACE_COLORS, type MapPlace } from './types';

export const NO_PLACES: MapPlace[] = [];

export function placesGeo(places: MapPlace[]) {
  return {
    type: 'FeatureCollection',
    features: places.map((p) => ({
      type: 'Feature', id: p.id,
      properties: { id: p.id, name: p.name, color: PLACE_COLORS[p.kind] ?? '#55524C' },
      geometry: { type: 'Point', coordinates: [p.lon, p.lat] },
    })),
  };
}
