// Web Mercator: координата → пиксель на экране при заданной камере. Для подложки без Mapbox.
const TILE = 512; // Mapbox GL использует тайлы 512 px

export function project(lat: number, lon: number, cam: { lat: number; lon: number; zoom: number }, w: number, h: number) {
  const scale = TILE * 2 ** cam.zoom;
  const toX = (lo: number) => ((lo + 180) / 360) * scale;
  const toY = (la: number) => {
    const s = Math.sin((la * Math.PI) / 180);
    return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * scale;
  };
  return { x: w / 2 + toX(lon) - toX(cam.lon), y: h / 2 + toY(lat) - toY(cam.lat) };
}
