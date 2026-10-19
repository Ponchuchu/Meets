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

export function unproject(x: number, y: number, cam: { lat: number; lon: number; zoom: number }, w: number, h: number) {
  const scale = TILE * 2 ** cam.zoom;
  const sin = Math.sin(cam.lat * Math.PI / 180);
  const centerY = (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale;
  const worldY = centerY + y - h / 2;
  const lon = cam.lon + (x - w / 2) / scale * 360;
  const lat = Math.atan(Math.sinh(Math.PI * (1 - 2 * worldY / scale))) * 180 / Math.PI;
  return { lat, lon };
}
