// Есть ли интернет и отвечает ли сервер (ALPHA §0): «Нет интернета» — кэш и очередь; «Нет связи с сервером · Повторить».
// «Нет связи с сервером» — только когда база реально не отвечает (FIX1 И2 п.12): 3 неудачи подряд за 20 с
// на запросах к базе (не к функциям маршрута и погоды). Первый успех — плашка уходит сама.
import * as Network from 'expo-network';
import { useEffect } from 'react';
import { create } from 'zustand';
import { focusManager, onlineManager } from '@tanstack/react-query';
import { AppState, Platform } from 'react-native';

interface NetState {
  online: boolean;
  /** Последний запрос к Supabase упал не из-за интернета — сервер недоступен. */
  serverDown: boolean;
  setOnline: (v: boolean) => void;
  setServerDown: (v: boolean) => void;
}

export const useNet = create<NetState>((set) => ({
  online: true,
  serverDown: false,
  setOnline: (online) => {
    if (!online) fails = [];
    onlineManager.setOnline(online);
    set({ online, ...(!online ? { serverDown: false } : {}) });
  },
  setServerDown: (serverDown) => set({ serverDown }),
}));

const WINDOW_MS = 20e3;
const FAILS = 3;
let fails: number[] = [];

/** Итог запроса к базе: ok — сбросить счётчик, иначе — ещё одна неудача подряд. */
export function reportDb(ok: boolean, now = Date.now()) {
  const net = useNet.getState();
  if (ok) {
    fails = [];
    if (net.serverDown) net.setServerDown(false);
    return;
  }
  if (!net.online) return; // нет интернета — это другая плашка
  fails = [...fails.filter((t) => now - t < WINDOW_MS), now];
  if (fails.length >= FAILS && !net.serverDown) net.setServerDown(true);
}

/** Ошибка функции (маршрут, погода, пробки) или входа — не «сервер упал»: её показывает своё место. */
export function isDbError(err: unknown): boolean {
  const e = err as { name?: string; message?: string; code?: string; status?: number } | null;
  if (!e) return false;
  if (e.name?.startsWith('Functions')) return false;
  // RLS, отсутствующая миграция, пустой профиль и истёкшая сессия — ошибки конкретного запроса.
  // Они не доказывают, что сервер недоступен.
  if (e.status && e.status >= 400 && e.status < 500) return false;
  if ((e.status ?? 0) >= 500 || /^(08|53|57P)|^PGRST00[0-3]$/.test(e.code ?? '')) return true;
  if (e.code) return false;
  return /^(timeout)$|failed to fetch|fetch failed|network request failed|networkerror|load failed|connection (refused|reset)|service unavailable|gateway timeout/i.test(e.message ?? '');
}

/** Следит за сетью всё время, пока открыто приложение (один раз в корневом layout). */
export function useNetWatch() {
  useEffect(() => {
    let live = true;
    let receivedEvent = false;
    const apply = (s: Network.NetworkState) => useNet.getState().setOnline(s.isConnected !== false && s.isInternetReachable !== false);
    const refresh = () => Network.getNetworkStateAsync().then(s => { if (live) apply(s); }).catch(() => undefined);
    Network.getNetworkStateAsync().then(s => { if (live && !receivedEvent) apply(s); }).catch(() => undefined);
    const sub = Network.addNetworkStateListener(s => { receivedEvent = true; apply(s); });
    const app = AppState.addEventListener('change', state => {
      if (Platform.OS !== 'web') focusManager.setFocused(state === 'active');
      if (state === 'active') void refresh();
    });
    return () => { live = false; sub.remove(); app.remove(); };
  }, []);
}
