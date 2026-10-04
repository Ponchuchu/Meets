// Точка входа слоя данных. Всё приложение ходит сюда, а не в demo/supabase напрямую.
import { config } from '../lib/config';
import { NoSessionError } from './client';
import { createDemoSource, demoEvents, mergeEvents } from './demo';
import { seedEvents } from './seed';
import { createSupabaseSource } from './supabase';
import type { DataSource } from './types';

export * from './types';

const demo = createDemoSource();
const remote = config.dataMode === 'demo' ? null : createSupabaseSource();

/** Пробует Supabase; в режиме auto при ошибке отдаёт демо, в live — пробрасывает ошибку. */
function withFallback(primary: DataSource | null, fallback: DataSource): DataSource & { lastSource: () => 'demo' | 'supabase' } {
  let last: 'demo' | 'supabase' = primary ? 'supabase' : 'demo';
  const wrap = <K extends keyof DataSource>(key: K) =>
    (async (...args: unknown[]) => {
      if (primary) {
        try {
          const res = await (primary[key] as (...a: unknown[]) => Promise<unknown>)(...args);
          last = 'supabase';
          return res;
        } catch (err) {
          // Альфа (live): никаких демо-подстановок — ошибку видит экран («Нет связи с сервером · Повторить»).
          if (config.dataMode === 'live') throw err;
          if (__DEV__ && !(err instanceof NoSessionError)) console.warn(`[data] ${String(key)}: Supabase недоступен, демо-режим`, err);
          last = 'demo';
        }
      }
      return (fallback[key] as (...a: unknown[]) => Promise<unknown>)(...args);
    }) as DataSource[K];
  return {
    kind: 'supabase',
    getMe: wrap('getMe'),
    getEvents: wrap('getEvents'),
    getPeople: wrap('getPeople'),
    getChats: wrap('getChats'),
    getChatRequests: wrap('getChatRequests'),
    getMessages: wrap('getMessages'),
    getFriendRequests: wrap('getFriendRequests'),
    getFriendSpots: wrap('getFriendSpots'),
    getMySpot: wrap('getMySpot'),
    getMyProfile: wrap('getMyProfile'),
    getPersonDetails: wrap('getPersonDetails'),
    getForecast: wrap('getForecast'),
    getWeatherNow: wrap('getWeatherNow'),
    lastSource: () => last,
  };
}

export const data = withFallback(remote, demo);

/** Мгновенный набор событий (демо + seed-файл): показываем сразу, пока идёт запрос в Supabase.
 *  В альфе (live) — пусто: никаких демо-событий, только база (и офлайн-кэш). */
export function eventsSnapshot() {
  return config.dataMode === 'live' ? [] : mergeEvents(demoEvents(), seedEvents());
}
