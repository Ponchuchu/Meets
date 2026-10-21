// Ошибки с телефона (FIX3 Ф1). Падение JS сохраняем в AsyncStorage сразу, отправляем в client_errors при следующем
// запуске после входа — так видно, почему приложение закрылось, даже если сеть пропала вместе с ним.
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { config } from './config';

const KEY = 'meets:crashes';
const MAX = 10;

export interface CrashRecord { at: string; fatal: boolean; screen?: string; message: string; stack?: string }

let screen = '';
/** Текущий экран: в журнале видно, где именно упало. */
export const setCrashScreen = (name: string) => { screen = name.slice(0, 120); };

export async function recordCrash(err: unknown, fatal: boolean): Promise<void> {
  const e = err instanceof Error ? err : new Error(String(err));
  const rec: CrashRecord = { at: new Date().toISOString(), fatal, screen, message: `${e.name}: ${e.message}`.slice(0, 2000), stack: e.stack?.slice(0, 8000) };
  try {
    const old = JSON.parse((await AsyncStorage.getItem(KEY)) ?? '[]') as CrashRecord[];
    await AsyncStorage.setItem(KEY, JSON.stringify([...old, rec].slice(-MAX)));
  } catch { /* хранилище недоступно — не мешаем падению */ }
}

let installed = false;
/** Ставит общий обработчик ошибок поверх стандартного (тот после записи закрывает приложение, как и раньше). */
export function installCrashHandler(): void {
  if (installed || Platform.OS === 'web') return;
  installed = true;
  const g = globalThis as unknown as { ErrorUtils?: { getGlobalHandler: () => (e: unknown, fatal?: boolean) => void; setGlobalHandler: (h: (e: unknown, fatal?: boolean) => void) => void } };
  const eu = g.ErrorUtils;
  if (!eu) return;
  const prev = eu.getGlobalHandler();
  eu.setGlobalHandler((e, fatal) => {
    void recordCrash(e, !!fatal).finally(() => prev(e, fatal));
  });
}

/** Отправка накопленного. Вызывается после входа; без сети записи остаются до следующего раза. */
export async function flushCrashes(send: (rows: object[]) => Promise<void>): Promise<number> {
  if (config.dataMode === 'demo') return 0;
  let list: CrashRecord[] = [];
  try { list = JSON.parse((await AsyncStorage.getItem(KEY)) ?? '[]') as CrashRecord[]; } catch { return 0; }
  if (!list.length) return 0;
  const version = Constants.expoConfig?.version ?? null;
  await send(list.map(r => ({ at: r.at, fatal: r.fatal, screen: r.screen || null, message: r.message, stack: r.stack ?? null, app_version: version, platform: Platform.OS })));
  await AsyncStorage.removeItem(KEY);
  return list.length;
}
