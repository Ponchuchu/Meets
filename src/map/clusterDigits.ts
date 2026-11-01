import type { MapSymbol } from './symbols';
import { symbolCount } from './symbolsGeo';

/** One persistent native layer, ten cached images; digits stay readable offline. */
export function clusterDigitsGeo(symbols: MapSymbol[]) {
  return {
    type: 'FeatureCollection',
    features: symbols.flatMap(s => {
      const count = symbolCount(s.count);
      if (!s.dot || count <= 1 || !Number.isFinite(s.lat) || !Number.isFinite(s.lon) || Math.abs(s.lat) > 90 || Math.abs(s.lon) > 180) return [];
      const digits = String(Math.min(Number.MAX_SAFE_INTEGER, count));
      // 24×42 raster at 3×. Fit unusually large totals inside the 40pt badge too.
      const scale = Math.min(1 / 3, 32 / (digits.length * 24));
      return [...digits].map((digit, i) => ({
        type: 'Feature', id: `${s.id}:digit:${i}`,
        properties: { id: s.id, icon: `cluster-digit-${digit}`, offset: [(i - (digits.length - 1) / 2) * 24, 0], scale, op: s.faded ? 0.35 : 1 },
        geometry: { type: 'Point', coordinates: [s.lon, s.lat] },
      }));
    }),
  };
}
