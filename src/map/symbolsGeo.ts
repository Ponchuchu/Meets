// Значки карты → GeoJSON для слоя SymbolLayer (FIX5). Отдельно от symbols.tsx, чтобы проверять без React Native.
import type { MapSymbol } from './symbols';

export const NO_SYMBOLS: MapSymbol[] = [];

export const symbolCount = (count?: number) => Number.isFinite(count) ? Math.max(1, Math.floor(count!)) : 1;

export function symbolsGeo(symbols: MapSymbol[], spritePx: number) {
  return {
    type: 'FeatureCollection',
    features: symbols.filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lon) && Math.abs(s.lat) <= 90 && Math.abs(s.lon) <= 180).map((s) => ({
      type: 'Feature', id: s.id,
      properties: {
        id: s.id, icon: s.icon, sz: s.size / spritePx, sort: s.sort, dot: s.dot ?? '', op: s.faded ? 0.35 : 1,
        text: s.text ?? (symbolCount(s.count) > 1 ? String(symbolCount(s.count)) : ''), tc: s.textColor ?? '#4A4640', th: s.halo ?? '#FCFBF8',
        count: symbolCount(s.count),
        countText: symbolCount(s.count) > 1 ? String(symbolCount(s.count)) : '',
      },
      geometry: { type: 'Point', coordinates: [s.lon, s.lat] },
    })),
  };
}
