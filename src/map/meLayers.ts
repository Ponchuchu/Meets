// Моя точка слоями карты: GeoJSON для точки и конуса направления. Конус — три вложенных сектора с убывающей прозрачностью
// (имитация градиента), длина задана в пикселях экрана и пересчитывается в метры по текущему масштабу.
const EARTH = 40075016.686; // длина экватора, м
const CONE_PX = [58, 40, 22];
const CONE_OPACITY = [0.1, 0.12, 0.16];
const HALF_ANGLE = 34; // градусов в каждую сторону от направления

type Pos = [number, number];

/** Метров в одном пикселе на этом широте и масштабе (тайлы Mapbox GL — 512 px). */
export function metersPerPixel(lat: number, zoom: number): number {
  return (EARTH * Math.cos((lat * Math.PI) / 180)) / (512 * 2 ** zoom);
}

/** Точка на расстоянии dist (м) от центра под азимутом bearing (0 — север, по часовой). */
function offset(lat: number, lon: number, dist: number, bearing: number): Pos {
  const dLat = (dist * Math.cos((bearing * Math.PI) / 180)) / 111320;
  const dLon = (dist * Math.sin((bearing * Math.PI) / 180)) / (111320 * Math.max(0.01, Math.cos((lat * Math.PI) / 180)));
  return [lon + dLon, lat + dLat];
}

export function coneRing(lat: number, lon: number, heading: number, zoom: number, px: number): Pos[] {
  const r = px * metersPerPixel(lat, zoom);
  const ring: Pos[] = [[lon, lat]];
  for (let i = 0; i <= 10; i++) ring.push(offset(lat, lon, r, heading - HALF_ANGLE + (i * HALF_ANGLE * 2) / 10));
  ring.push([lon, lat]);
  return ring;
}

export function meFeatures(lat: number, lon: number, heading: number | null, zoom: number) {
  const point = { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [lon, lat] } };
  const cone = heading == null ? null : {
    type: 'FeatureCollection',
    features: CONE_PX.map((px, i) => ({ type: 'Feature', properties: { o: CONE_OPACITY[i] }, geometry: { type: 'Polygon', coordinates: [coneRing(lat, lon, heading, zoom, px)] } })),
  };
  return { point, cone };
}
