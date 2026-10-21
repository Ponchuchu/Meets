// Своя геолокация → сервер (docs/ALPHA.md А2). Открыто — каждые ~4 с, закрыто — раз в 2–3 мин (фоновая задача,
// на Android — «Всё время» и уведомление сервиса). Батарея < 10 % — реже.
// Невидимка или «делиться до» истекло — точка вообще не уходит с телефона.
// Пишем: locations_last (последняя), location_points (история 14 дней, не чаще раза в 30 с), explore_cells («Где я был»),
// и Broadcast «locations:<я>» — друзьям мгновенно (канал читают только те, кому можно, — политика can_see_location).
import type { RealtimeChannel } from '@supabase/supabase-js';
import * as Battery from 'expo-battery';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { useEffect, useMemo, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { create } from 'zustand';
import { supabase } from '../data/client';
import { coarse } from '../data/realtime';
import { noDialog } from './accuracy';
import { myId } from './auth';
import { isEco } from '../state/perf';
import { cellOf, distM, isJump, sendInterval, statusOf, type Place, type Pt } from './geo';

export const BG_TASK = 'ryadom-location';

interface Share {
  /** Невидимка до (ISO) или навсегда (true). */
  invisible: boolean | string;
  /** «Делиться до»: после этого времени точка не уходит. */
  shareUntil?: string | null;
  districtOnly: boolean;
  places: Place[];
}
let share: Share = { invisible: false, districtOnly: false, places: [] };
export const setShareRules = (s: Partial<Share>) => { share = { ...share, ...s }; };

const hidden = () => share.invisible === true
  || (typeof share.invisible === 'string' && new Date(share.invisible).getTime() > Date.now())
  || (!!share.shareUntil && new Date(share.shareUntil).getTime() < Date.now());

/** Точный GPS нужен, только когда на экране карта или навигатор; в чатах, ленте и профиле — экономный
 *  (GPS высокой точности всё время — главный источник нагрева и разряда). Экраны отмечаются через usePreciseGps. */
export const useGpsMode = create<{ precise: number }>(() => ({ precise: 0 }));
export function usePreciseGps(on: boolean) {
  useEffect(() => {
    if (!on) return;
    useGpsMode.setState((s) => ({ precise: s.precise + 1 }));
    return () => useGpsMode.setState((s) => ({ precise: Math.max(0, s.precise - 1) }));
  }, [on]);
}

/** Последняя своя точка и её точность — для «моей точки» и состояния «Неточно». */
export const useMyFix = create<{ fix: Pt | null; set: (p: Pt) => void }>((set) => ({ fix: null, set: (fix) => set({ fix }) }));

let last: Pt | null = null;
let lastHistory = 0;
let lastSent: Pt | null = null;
let lastCell = '';
let channel: RealtimeChannel | null = null;
let channelFor = '';

function liveChannel(me: string) {
  if (channel && channelFor === me) return channel;
  if (channel) void supabase().removeChannel(channel);
  channelFor = me;
  // Свой канал не подписываем: читать его может только друг (can_see_location), и подписка на себя
  // бесконечно переподключалась с ошибкой «Unauthorized». Отправляем через HTTP — без подписки.
  channel = supabase().channel(`locations:${me}`, { config: { private: true, broadcast: { self: false } } });
  return channel;
}

export async function sendPoint(c: Location.LocationObjectCoords, at = Date.now()): Promise<void> {
  const me = myId();
  const p: Pt = { lat: c.latitude, lon: c.longitude, at, accuracy: c.accuracy, speed: c.speed, heading: c.heading != null && c.heading >= 0 ? c.heading : null };
  if (isJump(last, p)) return;
  // «Моя точка» для экранов обновляется не чаще раза в 1,5 с (3 с в экономии) и при сдвиге от 3 м:
  // каждая точка GPS перерисовывала карту и открытую карточку целиком.
  const shown = useMyFix.getState().fix;
  last = p;
  if (!shown || distM(shown, p) > 3 && at - shown.at > (isEco() ? 3000 : 1500) || at - shown.at > 15000) useMyFix.getState().set(p);
  if (!me || hidden()) return;
  const stationary = lastSent && distM(lastSent, p) < 15 && (p.speed ?? 0) < 1;
  const interval = AppState.currentState === 'active' ? (stationary ? 30000 : isEco() ? 10000 : 4000) : sendInterval(false, null, !stationary);
  if (lastSent && at - lastSent.at < interval) return;
  lastSent = p;
  const status = statusOf(p, share.places, (new Date().getUTCHours() + 5) % 24);
  const speed = c.speed != null && c.speed >= 0 ? c.speed : null;
  const heading = c.heading != null && c.heading >= 0 ? c.heading : null;
  const iso = new Date(at).toISOString();
  const geog = `SRID=4326;POINT(${p.lon} ${p.lat})`;
  const sb = supabase();
  const jobs: PromiseLike<unknown>[] = [
    sb.from('locations_last').upsert({ user_id: me, geog, speed, heading, accuracy: c.accuracy ?? null, status, updated_at: iso }),
  ];
  if (at - lastHistory >= 30000) {
    lastHistory = at;
    jobs.push(sb.from('location_points').insert({ user_id: me, point: geog, speed, heading, accuracy: c.accuracy ?? null, at: iso }));
  }
  const cell = cellOf(p.lat, p.lon);
  if (cell !== lastCell) {
    lastCell = cell;
    jobs.push(sb.from('explore_cells').upsert({ user_id: me, h3: cell }, { onConflict: 'user_id,h3', ignoreDuplicates: true }));
  }
  // «Только район»: координаты друзьям не уходят вовсе.
  const payload = share.districtOnly ? { updated_at: iso, status } : { ...coarse(p.lat, p.lon), speed, heading, accuracy: c.accuracy ?? null, status, updated_at: iso };
  void liveChannel(me).httpSend('pos', payload).catch(() => undefined);
  await Promise.all(jobs);
}

// Фоновая задача: телефон присылает точки, даже когда приложение свёрнуто.
if (Platform.OS !== 'web') {
  TaskManager.defineTask(BG_TASK, async ({ data, error }) => {
    if (error || !data) return;
    const { locations } = data as { locations: Location.LocationObject[] };
    const l = locations[locations.length - 1];
    if (l) await sendPoint(l.coords, l.timestamp).catch(() => undefined);
  });
}

async function battery(): Promise<number | null> {
  if (Platform.OS === 'web') return null;
  return Battery.getBatteryLevelAsync().catch(() => null);
}

/** Включить фон, если разрешено «Всё время». Повторный вызов просто обновляет частоту. */
export async function startBackground(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const bg = await Location.getBackgroundPermissionsAsync();
  if (!bg.granted) return false;
  const every = sendInterval(false, await battery(), true);
  await Location.startLocationUpdatesAsync(BG_TASK, noDialog({
    accuracy: Location.Accuracy.Balanced,
    timeInterval: every,
    distanceInterval: 40,
    deferredUpdatesInterval: every,
    pausesUpdatesAutomatically: true,
    showsBackgroundLocationIndicator: false,
    foregroundService: {
      notificationTitle: 'Meets',
      notificationBody: 'Друзья видят, где ты. Выключить — «Невидимка» в профиле.',
      notificationColor: '#F0521F',
    },
  }));
  return true;
}

export async function stopBackground() {
  if (Platform.OS === 'web') return;
  if (await TaskManager.isTaskRegisteredAsync(BG_TASK).catch(() => false)) await Location.stopLocationUpdatesAsync(BG_TASK).catch(() => undefined);
}

/** Пока приложение открыто: частая точка (4 с). Возвращает функцию остановки или null — разрешения ещё нет. */
export async function watchForeground(precise = useGpsMode.getState().precise > 0): Promise<(() => void) | null> {
  const perm = await Location.getForegroundPermissionsAsync();
  if (!perm.granted) return null;
  const sub = await Location.watchPositionAsync(
    noDialog(precise && !isEco()
      ? { accuracy: Location.Accuracy.High, timeInterval: sendInterval(true, await battery()), distanceInterval: 2 }
      : { accuracy: Location.Accuracy.Balanced, timeInterval: isEco() ? 15000 : 10000, distanceInterval: 15 }),
    (l) => { void sendPoint(l.coords, l.timestamp).catch(() => undefined); },
  );
  return () => sub.remove();
}

/** Где я сейчас: последняя отправленная точка, иначе — последняя известная или свежая от системы. */
export function useMyPos(): { lat: number; lon: number } | null {
  const fix = useMyFix((s) => s.fix);
  const [pos, setPos] = useState<{ lat: number; lon: number } | null>(null);
  useEffect(() => {
    if (fix) return;
    let live = true;
    (async () => {
      const perm = await Location.getForegroundPermissionsAsync().catch(() => null);
      if (!perm?.granted) return;
      const p = await Location.getLastKnownPositionAsync().catch(() => null) ?? await Location.getCurrentPositionAsync(noDialog({ accuracy: Location.Accuracy.Balanced })).catch(() => null);
      if (p && live) setPos({ lat: p.coords.latitude, lon: p.coords.longitude });
    })();
    return () => { live = false; };
  }, [fix]);
  return fix ? { lat: fix.lat, lon: fix.lon } : pos;
}

/** Где я — с точностью ~300 м: для ленты и подборок. Не меняется на каждом шаге, поэтому колода
 *  не пересчитывается и экран не перерисовывается каждые 1,5 с, пока идёшь. */
export function useMyArea(): { lat: number; lon: number } | null {
  const p = useMyPos();
  const lat = p ? Math.round(p.lat * 300) / 300 : null;
  const lon = p ? Math.round(p.lon * 220) / 220 : null;
  return useMemo(() => (lat == null || lon == null ? null : { lat, lon }), [lat, lon]);
}
