// «Память» как в Telegram: сколько места занимает приложение и очистка. Сообщения и ленту держим на телефоне,
// чтобы без интернета было что читать; фото, видео и голосовые — в кэше телефона, их можно стереть в любой момент.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';
import { useOutbox } from './outbox';
import { CACHE_KEY, queryClient } from './query';

export interface MemoryUse { data: number; media: number }

function walk(dir: Directory, visit: (f: File) => void) {
  for (const it of dir.list()) {
    if (it instanceof Directory) walk(it, visit);
    else visit(it);
  }
}

/** Файлы, которые ещё ждут отправки: их не трогаем, иначе сообщение из очереди не уйдёт. */
const pendingFiles = () => new Set(useOutbox.getState().items.map((x) => String(x.payload.local_uri ?? '')).filter(Boolean));

export async function memoryUse(): Promise<MemoryUse> {
  const raw = await AsyncStorage.getItem(CACHE_KEY).catch(() => null);
  let media = 0;
  if (Platform.OS !== 'web') {
    try { walk(Paths.cache, (f) => { media += f.size ?? 0; }); } catch { /* нет доступа к папке — считаем 0 */ }
  }
  return { data: raw ? raw.length * 2 : 0, media };
}

/** Стереть сохранённые чаты и ленту: всё снова загрузится из сети. Очередь неотправленного не трогаем. */
export async function clearData(): Promise<void> {
  await AsyncStorage.removeItem(CACHE_KEY).catch(() => undefined);
  queryClient.removeQueries({ predicate: (q) => q.state.fetchStatus === 'idle' });
  void queryClient.invalidateQueries();
}

/** Стереть фото, видео и голосовые из кэша. Они загрузятся снова, когда откроешь чат. */
export async function clearMedia(): Promise<void> {
  if (Platform.OS === 'web') return;
  const keep = pendingFiles();
  try {
    walk(Paths.cache, (f) => { if (!keep.has(f.uri)) { try { f.delete(); } catch { /* занят — пропускаем */ } } });
  } catch { /* папки нет */ }
}

export const sizeText = (b: number) => (b < 1024 * 1024 ? `${Math.max(0, Math.round(b / 1024))} КБ` : b < 1024 ** 3 ? `${(b / 1024 / 1024).toFixed(1).replace('.', ',')} МБ` : `${(b / 1024 ** 3).toFixed(2).replace('.', ',')} ГБ`);
