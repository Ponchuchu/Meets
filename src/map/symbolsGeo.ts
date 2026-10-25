// Значки карты → GeoJSON для слоя SymbolLayer (FIX5). Отдельно от symbols.tsx, чтобы проверять без React Native.
import type { MapSymbol } from './symbols';

export const NO_SYMBOLS: MapSymbol[] = [];

export function symbolsGeo(symbols: MapSymbol[], spritePx: number) {
  return {
    type: 'FeatureCollection',
    features: symbols.filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lon)).map((s) => ({
      type: 'Feature', id: s.id,
      properties: {
        id: s.id, icon: s.icon, sz: s.size / spritePx, sort: s.sort, dot: s.dot ?? '', op: s.faded ? 0.35 : 1,
        text: s.text ?? '', tc: s.textColor ?? '#4A4640', th: s.halo ?? '#FCFBF8',
      },
      geometry: { type: 'Point', coordinates: [s.lon, s.lat] },
    })),
  };
}
