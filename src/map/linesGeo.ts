// Линии маршрута и друзей для одного постоянного источника карты (FIX3 Ф1). Без интерфейса — покрыто тестами.
import type { MapCanvasProps } from './types';

export const okPoint = (p: unknown): p is [number, number] => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite) && Math.abs(p[0] as number) <= 180 && Math.abs(p[1] as number) <= 90;
/** Только целые линии из двух и более правильных точек; пустая коллекция — тоже правильная форма. */
export function linesGeo(lines: NonNullable<MapCanvasProps['lines']>) {
  return {
    type: 'FeatureCollection' as const,
    features: lines.filter(l => l.coords.length >= 2 && l.coords.every(okPoint)).map(l => ({
      type: 'Feature' as const, id: l.id, properties: { color: l.color, width: l.width ?? 5, dash: !!l.dash },
      geometry: { type: 'LineString' as const, coordinates: l.coords },
    })),
  };
}
