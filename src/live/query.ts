// Один QueryClient на приложение + офлайн-кэш (последние данные переживают перезапуск и отсутствие сети).
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { QueryClient } from '@tanstack/react-query';
import { Platform } from 'react-native';
import { isDbError, reportDb } from './net';
import { config } from '../lib/config';

const ssr = Platform.OS === 'web' && typeof window === 'undefined';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60e3,
      gcTime: 7 * 24 * 3600e3, // кэш живёт неделю — столько же хранит persister (KEEP_MS)
      retry: (n, err) => n < 2 && isDbError(err),
      networkMode: 'offlineFirst',
    },
    mutations: { networkMode: 'offlineFirst' },
  },
});

// Каждый ответ базы — в счётчик «Нет связи с сервером» (3 неудачи подряд за 20 с). Функции маршрута и погоды не считаются.
queryClient.getQueryCache().subscribe((e) => {
  if (e.type !== 'updated' || e.action.type !== 'success' && e.action.type !== 'error') return;
  const dbQueries = ['events', 'people', 'chats', 'messages', 'friendRequests', 'friendSpots', 'me', 'person', 'invites'];
  if (config.dataMode === 'demo' || !dbQueries.includes(String(e.query.queryKey[0]))) return;
  if (e.action.type === 'success') reportDb(true);
  else if (isDbError(e.action.error)) reportDb(false);
});

export const CACHE_KEY = 'ryadom-cache-v6';
export const persister = ssr ? undefined : createAsyncStoragePersister({ storage: AsyncStorage, key: CACHE_KEY, throttleTime: 5000 });

/** Что сохраняем на телефон для работы без сети: ленту, чаты, сообщения, людей и свой профиль.
 *  Точки друзей, пробки, погоду, админку не сохраняем — они меняются каждые секунды, и запись всего кэша
 *  раз в 2 с (как было) нагружала телефон. */
const KEEP = new Set(['events', 'people', 'chats', 'messages', 'me', 'person', 'invites', 'friendRequests', 'plans']);
export const shouldPersist = (key: readonly unknown[]) => KEEP.has(String(key[0]));
/** Сохранённое живёт неделю (стереть раньше — Настройки → Память). */
export const KEEP_MS = 7 * 24 * 3600e3;
