// Начальная точка карты (FIX1 И1): последняя известная геопозиция, если разрешение уже есть; ждём не дольше 1 с.
// Нет разрешения или точки — центр Алматы. Запрос стартует при загрузке модуля, чтобы успеть к первому кадру карты.
import * as Location from 'expo-location';
import { Platform } from 'react-native';
import { ALMATY_CAMERA, type Camera } from '../map/types';

// После заставки карта плавно приближается в 1,22 раза.
export const START_ZOOM = 14.9;

async function lastKnown(): Promise<Camera | null> {
  if (Platform.OS === 'web') return null;
  const perm = await Location.getForegroundPermissionsAsync();
  if (!perm.granted) return null;
  const p = await Location.getLastKnownPositionAsync({ maxAge: 7 * 24 * 3600_000 });
  return p ? { lat: p.coords.latitude, lon: p.coords.longitude, zoom: START_ZOOM } : null;
}

let pending: Promise<Camera> | null = null;

/** Камера для первого кадра: я или центр Алматы. */
export function startCamera(): Promise<Camera> {
  pending ??= Promise.race([lastKnown().catch(() => null), new Promise<null>(resolve => setTimeout(() => resolve(null), 1000))]).then((c) => c ?? ALMATY_CAMERA);
  return pending;
}
