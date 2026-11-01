import type { Camera } from './types';
import { okPoint } from './linesGeo';

type Point = Pick<Camera, 'lat' | 'lon'>;
const longitudeDelta = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);

/** Android can report a partially reset camera, e.g. (0, expected longitude), after a style/gesture change. */
export function cameraNeedsRecovery(actual: Point, expected: Point, gestured: boolean): boolean {
  if (!okPoint([expected.lon, expected.lat])) return false;
  if (!okPoint([actual.lon, actual.lat])) return true;
  const lonGap = longitudeDelta(actual.lon, expected.lon);
  const originLost = Math.abs(actual.lat) < 3 && Math.abs(actual.lon) < 3 && (Math.abs(expected.lat) >= 3 || Math.abs(expected.lon) >= 3);
  const latitudeDropped = Math.abs(actual.lat) < 1e-6 && Math.abs(expected.lat) > 1 && lonGap < 1e-5;
  const longitudeDropped = Math.abs(actual.lon) < 1e-6 && Math.abs(expected.lon) > 1 && Math.abs(actual.lat - expected.lat) < 1e-5;
  return originLost || latitudeDropped || longitudeDropped || (!gestured && Math.hypot(actual.lat - expected.lat, lonGap) > 0.5);
}

/** Recovery events must never replace the last good camera and become the next launch target. */
export function rememberHealthyCamera(previous: Camera | null, candidate: Camera, expected: Point, gestured: boolean): Camera | null {
  return Number.isFinite(candidate.zoom) && candidate.zoom >= 0 && candidate.zoom <= 22 && !cameraNeedsRecovery(candidate, expected, gestured) ? candidate : previous;
}
