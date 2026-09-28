// Сообщения на устройстве (демо): мои отправленные, голоса в опросах, ответы на приглашения, просмотр размытых медиа,
// блок и жалобы, прочитанные чаты. Realtime и Storage — этап 8.
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Message } from '../data/types';
import { deviceStorage } from './storage';

interface ChatState {
  sent: Message[];
  votes: Record<string, number>; // messageId → вариант
  answers: Record<string, 'yes' | 'no'>; // приглашение → ответ
  revealed: Record<string, true>;
  blocked: Record<string, true>;
  reported: Record<string, true>;
  read: Record<string, number>; // chatId → сколько непрочитанных уже видели
  requests: Record<string, 'accepted' | 'later'>;
  send: (m: Message) => void;
  vote: (messageId: string, i: number) => void;
  answer: (messageId: string, a: 'yes' | 'no') => void;
  reveal: (messageId: string) => void;
  block: (personId: string) => void;
  report: (personId: string) => void;
  markRead: (chatId: string, n: number) => void;
  answerRequest: (id: string, a: 'accepted' | 'later') => void;
}

export const useChat = create<ChatState>()(
  persist(
    (set) => ({
      sent: [], votes: {}, answers: {}, revealed: {}, blocked: {}, reported: {}, read: {}, requests: {},
      send: (m) => set((s) => ({ sent: [...s.sent, m] })),
      vote: (id, i) => set((s) => ({ votes: { ...s.votes, [id]: i } })),
      answer: (id, a) => set((s) => ({ answers: { ...s.answers, [id]: a } })),
      reveal: (id) => set((s) => ({ revealed: { ...s.revealed, [id]: true } })),
      block: (id) => set((s) => ({ blocked: { ...s.blocked, [id]: true } })),
      report: (id) => set((s) => ({ reported: { ...s.reported, [id]: true } })),
      markRead: (id, n) => set((s) => ({ read: { ...s.read, [id]: n } })),
      answerRequest: (id, a) => set((s) => ({ requests: { ...s.requests, [id]: a } })),
    }),
    { name: 'ryadom-chat', storage: deviceStorage() },
  ),
);

export function timeNow(d = new Date()): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
