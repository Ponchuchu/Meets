import * as Location from 'expo-location';
import { noDialog } from './accuracy';

/** Своя точка на открытой карте. Остановка действует и на ещё создающуюся подписку. */
export function watchMapPosition(onPoint: (p: { lat: number; lon: number }) => void, onOff: () => void): () => void {
  let stopped = false;
  let sub: Location.LocationSubscription | null = null;
  const point = (l: Location.LocationObject) => {
    if (!stopped) onPoint({ lat: l.coords.latitude, lon: l.coords.longitude });
  };
  void (async () => {
    const enabled = await Location.hasServicesEnabledAsync().catch(() => true);
    if (stopped) return;
    if (!enabled) { onOff(); return; }
    const last = await Location.getLastKnownPositionAsync().catch(() => null);
    if (stopped) return;
    if (last) point(last);
    const created = await Location.watchPositionAsync(
      noDialog({ accuracy: Location.Accuracy.Balanced, timeInterval: 2000, distanceInterval: 3 }), point,
    );
    if (stopped) created.remove(); else sub = created;
  })().catch(() => undefined);
  return () => { stopped = true; sub?.remove(); sub = null; };
}
