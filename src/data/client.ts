// Клиент Supabase — один на всё приложение. Сессия входа хранится на устройстве (AsyncStorage / localStorage).
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import { config } from '../lib/config';

const ssr = Platform.OS === 'web' && typeof window === 'undefined';

let client: SupabaseClient | null = null;
export function supabase(): SupabaseClient {
  if (!client) {
    client = createClient(config.supabaseUrl, config.supabaseKey, {
      auth: {
        storage: ssr ? undefined : AsyncStorage,
        persistSession: !ssr,
        autoRefreshToken: !ssr,
        detectSessionInUrl: false,
      },
    });
  }
  return client;
}

export class NoSessionError extends Error {
  constructor() {
    super('no-session');
  }
}

/** id вошедшего человека. Без входа в Supabase — NoSessionError, и слой данных берёт демо. */
export async function requireUser(): Promise<string> {
  const { data } = await supabase().auth.getSession();
  const id = data.session?.user.id;
  if (!id) throw new NoSessionError();
  return id;
}

/** Промис с таймаутом: сеть не должна подвешивать экран. */
export function withTimeout<T>(p: PromiseLike<T>, ms = 6000): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('timeout')), ms); });
  return Promise.race([Promise.resolve(p), timeout]).finally(() => clearTimeout(timer));
}

let topicSeq = 0;
/** Своё имя канала на каждую подписку: при одинаковом имени Supabase отдаёт уже подписанный канал,
 *  и второй экран с тем же каналом падал «cannot add postgres_changes callbacks after subscribe()». */
export const uniqTopic = (base: string) => `${base}:${Date.now().toString(36)}${(++topicSeq).toString(36)}`;
