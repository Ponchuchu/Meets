// Один QueryClient на приложение + офлайн-кэш (последние данные переживают перезапуск и отсутствие сети).
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { QueryClient } from '@tanstack/react-query';
import { Platform } from 'react-native';
import { useNet } from './net';

const ssr = Platform.OS === 'web' && typeof window === 'undefined';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60e3,
      gcTime: 24 * 3600e3, // кэш живёт сутки — столько же хранит persister
      retry: (n, err) => n < 2 && !/auth|JWT|permission/i.test(String((err as Error)?.message)),
      networkMode: 'offlineFirst',
    },
    mutations: { networkMode: 'offlineFirst' },
  },
});

// Сервер ответил ошибкой при живом интернете — показываем «Нет связи с сервером».
queryClient.getQueryCache().subscribe((e) => {
  if (e.type !== 'updated') return;
  const st = e.query.state;
  if (st.status === 'error' && useNet.getState().online) useNet.getState().setServerDown(true);
  if (st.status === 'success') useNet.getState().setServerDown(false);
});

export const persister = ssr ? undefined : createAsyncStoragePersister({ storage: AsyncStorage, key: 'ryadom-cache-v6', throttleTime: 2000 });
