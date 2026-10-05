// Автобусы Алматы для плитки «~22 мин · № 63» (V6 §4.5): направления из OpenStreetMap (data/seed/bus-stops-almaty.json),
// годные — где остановок достаточно для расчёта. Подпись «© участники OpenStreetMap» — на экране маршрута.
import seed from '../../data/seed/bus-stops-almaty.json';
import { bestDirectBus, type BusDirection, type BusEstimate, type LatLon } from './bus';

const DIRS: BusDirection[] = ((seed as { directions?: BusDirection[] }).directions ?? []).filter((d) => d.stops.length >= 6);

export function busFor(from: LatLon, to: LatLon, at: Date, traffic = 1): (BusEstimate & { path: [number, number][] }) | null {
  const best = bestDirectBus(DIRS, from, to, at, traffic);
  if (!best) return null;
  const dir = DIRS.find((d) => d.ref === best.ref && d.stops.some((s) => s.id === best.board.id) && d.stops.some((s) => s.id === best.alight.id));
  const a = dir ? dir.stops.findIndex((s) => s.id === best.board.id) : -1;
  const b = dir ? dir.stops.findIndex((s) => s.id === best.alight.id) : -1;
  const path = dir && a >= 0 && b > a ? dir.stops.slice(a, b + 1).map((s) => [s.lon, s.lat] as [number, number]) : [[best.board.lon, best.board.lat], [best.alight.lon, best.alight.lat]] as [number, number][];
  return { ...best, path };
}
