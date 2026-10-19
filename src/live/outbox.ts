import { useChat } from '../state/chat';
// Очередь отправок (ALPHA §0): без сети сообщение встаёт в очередь и уходит, как только интернет вернётся.
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { deviceStorage } from '../state/storage';
import { useNet } from './net';
import { myId, useAuth } from './auth';

export interface OutItem {
  id: string; // локальный id — по нему экран показывает «часики» у сообщения
  kind: 'message';
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
            } catch {
              useChat.getState().updateMessage(it.id, { delivery: 'failed' });
              set((s) => ({ items: s.items.map((x) => (x.id === it.id ? { ...x, tries: x.tries + 1 } : x)) }));
              retryTimer = setTimeout(() => { void get().flush(); }, Math.min(60000, 2000 * 2 ** Math.min(it.tries, 5)));
              break; // по порядку: следующее не обгоняет застрявшее
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
