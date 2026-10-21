import { useChat } from '../state/chat';
// Очередь отправок (ALPHA §0): без сети сообщение встаёт в очередь и уходит, как только интернет вернётся.
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { deviceStorage } from '../state/storage';
import { useNet } from './net';
import { myId, useAuth } from './auth';

export interface OutItem {
  id: string; // локальный id — по нему экран показывает «часики» у сообщения
  /** message — новое сообщение; edit — исправление текста (payload: message_id, body). */
  kind: 'message' | 'edit';
  chatId: string;
  ownerId?: string;
  payload: Record<string, unknown>;
  tries: number;
  at: string;
}

type Sender = (item: OutItem) => Promise<void>;
let sender: Sender | null = null;
/** Слой данных регистрирует, как отправлять (чтобы очередь не зависела от api). */
export const setOutboxSender = (fn: Sender) => { sender = fn; void useOutbox.getState().flush(); };

interface OutboxState {
  items: OutItem[];
  add: (item: Omit<OutItem, 'tries' | 'at'>) => void;
  updatePayload: (id: string, payload: Record<string, unknown>) => void;
  flush: () => Promise<void>;
}

let flushing = false;
/** Ошибка связи (таймаут, нет сети, обрыв), а не отказ сервера: у отказов Postgres/PostgREST есть код. */
export function isNetworkError(e: unknown): boolean {
  const err = e as { code?: string; status?: number; message?: string } | null;
  if (!err) return true;
  if (err.code && !/^(PGRST000|PGRST001|PGRST002)$/.test(err.code)) return false;
  if (typeof err.status === 'number' && err.status >= 400 && err.status < 500 && err.status !== 408 && err.status !== 429) return false;
  return true;
}
let retryTimer: ReturnType<typeof setTimeout> | undefined;
export const useOutbox = create<OutboxState>()(
  persist(
    (set, get) => ({
      items: [],
      add: (item) => {
        set((s) => ({ items: [...s.items.filter(x => x.id !== item.id), { ...item, tries: 0, at: new Date().toISOString() }] }));
        void get().flush();
      },
      updatePayload: (id, payload) => set(s => ({ items: s.items.map(x => x.id === id ? { ...x, payload: { ...x.payload, ...payload } } : x) })),
      flush: async () => {
        if (flushing || !sender || !useNet.getState().online || !myId()) return;
        clearTimeout(retryTimer);
        flushing = true;
        try {
          // Пока отправляли файл, в очередь могли добавить ещё сообщения.
          // Старые записи другого аккаунта никогда не отправляем от нового пользователя.
          while (true) {
            const it = get().items.find(x => (x.ownerId ?? x.payload.owner) === myId());
            if (!it) break;
            if (!useNet.getState().online) break;
            try {
              await sender(it);
              set((s) => ({ items: s.items.filter((x) => x.id !== it.id) }));
            } catch (e) {
              // Нет сети или сервер не ответил — сообщение остаётся «часиками» и уйдёт само, как только связь вернётся.
              // Сервер отказал по-настоящему (правила, нет доступа) — «Не отправилось · Повторить», очередь идёт дальше.
              if (isNetworkError(e)) {
                set((s) => ({ items: s.items.map((x) => (x.id === it.id ? { ...x, tries: x.tries + 1 } : x)) }));
                retryTimer = setTimeout(() => { void get().flush(); }, Math.min(30000, 2000 * 2 ** Math.min(it.tries, 4)));
                break; // по порядку: следующее не обгоняет застрявшее
              }
              useChat.getState().updateMessage(it.id, { delivery: 'failed' });
              set((s) => ({ items: s.items.filter((x) => x.id !== it.id) }));
            }
          }
        } finally {
          flushing = false;
        }
      },
    }),
    { name: 'ryadom-outbox', storage: deviceStorage(), onRehydrateStorage: () => state => { if (state) void state.flush(); } },
  ),
);

// Вернулся интернет — отправляем всё, что накопилось.
useNet.subscribe((s, prev) => { if (s.online && !prev.online) void useOutbox.getState().flush(); });
useAuth.subscribe((s, prev) => { if (s.session && s.session.user.id !== prev.session?.user.id) void useOutbox.getState().flush(); });
