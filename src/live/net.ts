// Есть ли интернет и отвечает ли сервер (ALPHA §0): «Нет интернета» — кэш и очередь; «Нет связи с сервером · Повторить».
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

/** Следит за сетью всё время, пока открыто приложение (один раз в корневом layout). */
export function useNetWatch() {
  useEffect(() => {
    const apply = (s: Network.NetworkState) => useNet.getState().setOnline(s.isConnected !== false && s.isInternetReachable !== false);
    Network.getNetworkStateAsync().then(apply).catch(() => undefined);
    const sub = Network.addNetworkStateListener(apply);
    return () => sub.remove();
  }, []);
}
