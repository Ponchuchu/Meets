// Есть ли интернет и отвечает ли сервер (ALPHA §0): «Нет интернета» — кэш и очередь; «Нет связи с сервером · Повторить».
// «Нет связи с сервером» — только когда база реально не отвечает (FIX1 И2 п.12): 3 неудачи подряд за 20 с
// на запросах к базе (не к функциям маршрута и погоды). Первый успех — плашка уходит сама.
import * as Network from 'expo-network';
import { useEffect } from 'react';
import { create } from 'zustand';

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
  setOnline: (online) => set({ online }),
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
  const e = err as { name?: string; message?: string } | null;
  if (!e) return false;
  if (e.name?.startsWith('Functions')) return false;
  return !/auth|JWT|permission|staff-only/i.test(String(e.message));
}

/** Следит за сетью всё время, пока открыто приложение (один раз в корневом layout). */
export function useNetWatch() {
  useEffect(() => {
    const apply = (s: Network.NetworkState) => useNet.getState().setOnline(s.isConnected !== false && s.isInternetReachable !== false);
    Network.getNetworkStateAsync().then(apply).catch(() => undefined);
    const sub = Network.addNetworkStateListener(apply);
    return () => sub.remove();
  }, []);
}
