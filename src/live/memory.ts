// «Память» как в Telegram: сколько места занимает приложение по видам и очистка каждого вида.
// Сообщения, ленту и людей держим на телефоне, чтобы без интернета было что читать (кэш запросов, неделя);
// фото, видео и голосовые — в кэше телефона, их можно стереть в любой момент: загрузятся снова.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';
import { useOutbox } from './outbox';
import { CACHE_KEY, queryClient } from './query';
import { config } from '../lib/config';

export type MemKind = 'messages' | 'feed' | 'people' | 'photo' | 'video' | 'voice' | 'other';
export interface MemPart { kind: MemKind; bytes: number }

/** Какие запросы к какому виду относятся (первый элемент ключа). */
const DATA_KIND: Record<string, MemKind> = {
  messages: 'messages', chats: 'messages', invites: 'messages',
  events: 'feed', plans: 'feed',
  people: 'people', person: 'people', me: 'people', friendRequests: 'people',
};
const EXT: [RegExp, MemKind][] = [[/\.(jpe?g|png|webp|heic|gif)$/i, 'photo'], [/\.(mp4|mov|m4v|webm)$/i, 'video'], [/\.(m4a|aac|mp3|ogg|opus|wav|3gp|caf)$/i, 'voice']];
export const kindOfFile = (name: string): MemKind => EXT.find(([re]) => re.test(name))?.[1] ?? 'other';

function walk(dir: Directory, visit: (f: File) => void) {
  for (const it of dir.list()) {
    if (it instanceof Directory) walk(it, visit);
    else visit(it);
  }
}

/** Файлы, которые ещё ждут отправки: их не трогаем, иначе сообщение из очереди не уйдёт. */
const pendingFiles = () => new Set(useOutbox.getState().items.map((x) => String(x.payload.local_uri ?? '')).filter(Boolean));

/** Разбор сохранённого кэша по видам: размер каждого запроса в JSON. Строка с ключом — тоже чуть-чуть места. */
export function splitCache(raw: string | null): Partial<Record<MemKind, number>> {
  const out: Partial<Record<MemKind, number>> = {};
  if (!raw) return out;
  try {
    const parsed = JSON.parse(raw) as { clientState?: { queries?: { queryKey: unknown[] }[] } };
    for (const q of parsed.clientState?.queries ?? []) {
      const kind = DATA_KIND[String(q.queryKey?.[0])] ?? 'other';
      out[kind] = (out[kind] ?? 0) + JSON.stringify(q).length * 2;
    }
  } catch { out.other = raw.length * 2; }
  return out;
}

/** Демо (скриншоты, web без базы): правдоподобный телефон через неделю переписки. */
const DEMO: Record<MemKind, number> = { messages: 6.4e6, feed: 3.1e6, people: 0.9e6, photo: 148e6, video: 212e6, voice: 18e6, other: 2.2e6 };

export async function memoryUse(): Promise<MemPart[]> {
  if (config.dataMode === 'demo') return (Object.keys(DEMO) as MemKind[]).map((kind) => ({ kind, bytes: DEMO[kind] }));
  const sizes = splitCache(await AsyncStorage.getItem(CACHE_KEY).catch(() => null));
  if (Platform.OS !== 'web') {
    try { walk(Paths.cache, (f) => { const k = kindOfFile(f.name); sizes[k] = (sizes[k] ?? 0) + (f.size ?? 0); }); } catch { /* нет доступа — 0 */ }
  }
  const order: MemKind[] = ['messages', 'feed', 'people', 'photo', 'video', 'voice', 'other'];
  return order.map((kind) => ({ kind, bytes: sizes[kind] ?? 0 }));
}

/** Стереть один вид. Данные загрузятся снова из сети; очередь неотправленного не трогаем. */
export async function clearKind(kind: MemKind): Promise<void> {
  if (kind === 'photo' || kind === 'video' || kind === 'voice' || kind === 'other') {
    if (Platform.OS === 'web') return;
    const keep = pendingFiles();
    try { walk(Paths.cache, (f) => { if (kindOfFile(f.name) === kind && !keep.has(f.uri)) { try { f.delete(); } catch { /* занят */ } } }); } catch { /* папки нет */ }
    return;
  }
  const keys = Object.entries(DATA_KIND).filter(([, k]) => k === kind).map(([key]) => key);
  for (const key of keys) queryClient.removeQueries({ queryKey: [key], predicate: (q) => q.state.fetchStatus === 'idle' });
  for (const key of keys) void queryClient.invalidateQueries({ queryKey: [key] });
}

/** Стереть всё (кроме неотправленного). */
export async function clearAll(): Promise<void> {
  for (const k of ['photo', 'video', 'voice'] as const) await clearKind(k);
  await AsyncStorage.removeItem(CACHE_KEY).catch(() => undefined);
  queryClient.removeQueries({ predicate: (q) => q.state.fetchStatus === 'idle' });
  void queryClient.invalidateQueries();
}

export const sizeText = (b: number) => (b < 1024 * 1024 ? `${Math.max(0, Math.round(b / 1024))} КБ` : b < 1024 ** 3 ? `${(b / 1024 / 1024).toFixed(1).replace('.', ',')} МБ` : `${(b / 1024 ** 3).toFixed(2).replace('.', ',')} ГБ`);
