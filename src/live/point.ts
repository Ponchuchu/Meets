/** PostGIS возвращает GeoJSON, EWKT или шестнадцатеричный EWKB в зависимости от запроса. */
export function readPoint(value: unknown): { lat: number; lon: number } | null {
  let lon: number | undefined, lat: number | undefined;
  if (value && typeof value === 'object' && 'coordinates' in value) {
    const p = (value as { coordinates: unknown }).coordinates;
    if (Array.isArray(p)) [lon, lat] = p;
  } else if (typeof value === 'string') {
    const text = /POINT\s*\(\s*([\d.+-]+)\s+([\d.+-]+)\s*\)/i.exec(value);
    if (text) { lon = Number(text[1]); lat = Number(text[2]); }
    else if (/^(?:[\da-f]{2})+$/i.test(value) && value.length >= 42) {
      try {
        const bytes = Uint8Array.from(value.match(/../g)!, h => parseInt(h, 16));
        const data = new DataView(bytes.buffer);
        const little = data.getUint8(0) === 1;
        const type = data.getUint32(1, little);
        if ((type & 0xff) !== 1) return null;
        const offset = (type & 0x20000000) ? 9 : 5;
        lon = data.getFloat64(offset, little); lat = data.getFloat64(offset + 8, little);
      } catch { return null; }
    }
  }
  return typeof lat === 'number' && typeof lon === 'number' && Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 85 && Math.abs(lon) <= 180 ? { lat, lon } : null;
}
