// Знаменитые здания объёмом (21 октября): в данных карты их нет или они плоские — рисуем сами из простых частей
// (цилиндры и коробки друг на друге). Координаты — по Википедии/Structurae; высоты — над землёй (рельеф поднимает сам).
type Part = { r?: number; w?: number; l?: number; rot?: number; base: number; top: number; color?: string };
interface Landmark { id: string; lat: number; lon: number; parts: Part[] }

const WHITE = '#F1EEE8', GREY = '#C9C6C0', RED = '#D2483A';

export const LANDMARKS: Landmark[] = [
  // Телебашня на Кок-Тобе, 372 м: опора, ствол, две «тарелки» и антенна в красно-белую полоску.
  { id: 'tv-tower', lat: 43.22872, lon: 76.97642, parts: [
    { r: 16, base: 0, top: 22, color: GREY },
    { r: 6, base: 22, top: 146, color: WHITE },
    { r: 13, base: 146, top: 162, color: GREY },
    { r: 4.5, base: 162, top: 250, color: WHITE },
    { r: 10, base: 250, top: 262, color: GREY },
    { r: 3, base: 262, top: 300, color: WHITE },
    ...[0, 1, 2, 3, 4, 5].map((i) => ({ r: 1.6, base: 300 + i * 12, top: 312 + i * 12, color: i % 2 ? WHITE : RED })),
  ] },
];

const M_LAT = 111_320;
/** Кольцо полигона вокруг точки: круг (24 вершины) или повёрнутый прямоугольник. */
function ring(lat: number, lon: number, p: Part): [number, number][] {
  const mLon = M_LAT * Math.cos((lat * Math.PI) / 180);
  const pt = (dx: number, dy: number): [number, number] => [lon + dx / mLon, lat + dy / M_LAT];
  if (p.r != null) {
    const out = Array.from({ length: 24 }, (_, i) => { const a = (i / 24) * 2 * Math.PI; return pt(p.r! * Math.cos(a), p.r! * Math.sin(a)); });
    return [...out, out[0]];
  }
  const a = ((p.rot ?? 0) * Math.PI) / 180, w = (p.w ?? 10) / 2, l = (p.l ?? 10) / 2;
  const c = [[-w, -l], [w, -l], [w, l], [-w, l]].map(([x, y]) => pt(x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)));
  return [...c, c[0]];
}

/** GeoJSON для слоя «landmarks» (fill-extrusion по свойствам base / top / color). */
export function landmarksGeoJSON() {
  return {
    type: 'FeatureCollection',
    features: LANDMARKS.flatMap((m) => m.parts.map((p, i) => ({
      type: 'Feature', id: `${m.id}-${i}`,
      properties: { base: p.base, top: p.top, color: p.color ?? WHITE },
      geometry: { type: 'Polygon', coordinates: [ring(m.lat, m.lon, p)] },
    }))),
  };
}
