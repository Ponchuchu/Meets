// Путь по улицам без ключей и квот (21 октября): открытый маршрутизатор OpenStreetMap (FOSSGIS, routing.openstreetmap.de).
// Пешие участки поездки на автобусе (до остановки и от неё) и сам автобус по дорогам — раньше это были прямые линии.
// Нет сети или ответа — возвращаем null, экран рисует как раньше.
type P = [number, number];
const BASE = { foot: 'https://routing.openstreetmap.de/routed-foot', car: 'https://routing.openstreetmap.de/routed-car' } as const;

/** Не больше 25 точек на запрос: длинную линию автобуса прореживаем, концы оставляем. */
export function thin(pts: P[], max = 25): P[] {
  if (pts.length <= max) return pts;
  const step = (pts.length - 1) / (max - 1);
  return Array.from({ length: max }, (_, i) => pts[Math.round(i * step)]);
}

export async function streetPath(profile: keyof typeof BASE, pts: P[]): Promise<P[] | null> {
  if (pts.length < 2) return null;
  const coords = thin(pts).map(([lon, lat]) => `${lon.toFixed(5)},${lat.toFixed(5)}`).join(';');
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 8000);
    const r = await fetch(`${BASE[profile]}/route/v1/driving/${coords}?overview=full&geometries=geojson`, { signal: ctl.signal });
    clearTimeout(t);
    if (!r.ok) return null;
    const line = ((await r.json()) as { routes?: { geometry?: { coordinates?: P[] } }[] }).routes?.[0]?.geometry?.coordinates;
    return line && line.length >= 2 ? line : null;
  } catch { return null; }
}
