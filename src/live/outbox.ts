// Очередь отправок (ALPHA §0): без сети сообщение встаёт в очередь и уходит, как только интернет вернётся.
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { deviceStorage } from '../state/storage';
import { useNet } from './net';

export interface OutItem {
  id: string; // локальный id — по нему экран показывает «часики» у сообщения
  kind: 'message';
  chatId: string;
  payload: Record<string, unknown>;
  tries: number;
  at: string;
}

type Sender = (item: OutItem) => Promise<void>;
let sender: Sender | null = null;
/** Слой данных регистрирует, как отправлять (чтобы очередь не зависела от api). */
export const setOutboxSender = (fn: Sender) => { sender = fn; };

interface OutboxState {
  items: OutItem[];
  updatePayload: (id: string, patch: Record<string, unknown>) => void;
  add: (item: Omit<OutItem, 'tries' | 'at'>) => void;
  flush: () => Promise<void>;
}

let flushing = false;
export const useOutbox = create<OutboxState>()(
  persist(
    (set, get) => ({
      items: [],
      updatePayload: (id, patch) => set(s => ({ items: s.items.map(x => x.id === id ? { ...x, payload: { ...x.payload, ...patch } } : x) })),
      add: (item) => {
        set((s) => ({ items: [...s.items.filter(x => x.id !== item.id), { ...item, tries: 0, at: new Date().toISOString() }] }));
        void get().flush();
      },
      flush: async () => {
        if (flushing || !sender || !useNet.getState().online) return;
        flushing = true;
        try {
          while (get().items.length) {
            const it = get().items[0];
            try {
              await sender(it);
              set((s) => ({ items: s.items.filter((x) => x.id !== it.id) }));
            } catch {
              set((s) => ({ items: s.items.map((x) => (x.id === it.id ? { ...x, tries: x.tries + 1 } : x)) }));
              break; // по порядку: следующее не обгоняет застрявшее
            }
          }
        } finally {
          flushing = false;
        }
      },
    }),
    { name: 'ryadom-outbox', storage: deviceStorage() },
  ),
);

// Вернулся интернет — отправляем всё, что накопилось.
useNet.subscribe((s, prev) => { if (s.online && !prev.online) void useOutbox.getState().flush(); });
