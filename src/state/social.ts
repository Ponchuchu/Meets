import { config } from '../lib/config';
// Люди и связи на устройстве: заявки в друзья, стикеры, приглашения, скрытые и жалобы.
// В Supabase (friendships, friend_requests, blocks, reports, invites) — этап 8.
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { deviceStorage } from './storage';

export type RequestAnswer = 'accepted' | 'declined';

interface SocialState {
  answered: Record<string, RequestAnswer>; // входящие заявки
  sent: Record<string, true>; // мои заявки
  removed: Record<string, true>; // убрал из друзей
  hidden: Record<string, true>;
  reported: Record<string, true>;
  stickers: Record<string, string>; // personId → когда отправлен последний
  invitesSent: { personId: string; eventId: string | 'own'; at: string }[];
  linkInvited: boolean;
  /** Как я подписал друга: «Игорёк», «Денчик». Видно только мне. */
  nicknames: Record<string, string>;
  setNickname: (personId: string, name: string) => void;
  answer: (personId: string, a: RequestAnswer) => void;
  toggleRequest: (personId: string) => void;
  removeFriend: (personId: string) => void;
  hide: (personId: string) => void;
  report: (personId: string) => void;
  sticker: (personId: string) => void;
  invite: (personId: string, eventId: string | 'own') => void;
  inviteByLink: () => void;
}

export const useSocial = create<SocialState>()(
  persist(
    (set) => ({
      answered: {}, sent: {}, removed: {}, hidden: {}, reported: {}, stickers: {}, invitesSent: [], linkInvited: false, nicknames: {},
      setNickname: (id, name) => set((s) => {
        const nicknames = { ...s.nicknames };
        if (name.trim()) nicknames[id] = name.trim().slice(0, 24);
        else delete nicknames[id];
        return { nicknames };
      }),
      answer: (id, a) => set((s) => ({ answered: { ...s.answered, [id]: a } })),
      toggleRequest: (id) => set((s) => {
        const sent = { ...s.sent };
        if (sent[id]) delete sent[id];
        else sent[id] = true;
        return { sent };
      }),
      removeFriend: (id) => set((s) => ({ removed: { ...s.removed, [id]: true } })),
      hide: (id) => set((s) => ({ hidden: { ...s.hidden, [id]: true } })),
      report: (id) => set((s) => ({ reported: { ...s.reported, [id]: true } })),
      sticker: (id) => set((s) => ({ stickers: { ...s.stickers, [id]: new Date().toISOString() } })),
      invite: (id, eventId) => set((s) => ({ invitesSent: [...s.invitesSent, { personId: id, eventId, at: new Date().toISOString() }] })),
      inviteByLink: () => set({ linkInvited: true }),
    }),
    { name: 'ryadom-social', storage: deviceStorage() },
  ),
);

/** Друг ли человек сейчас: из данных + принятые заявки − убранные. */
export function isFriendNow(p: { id: string; isFriend: boolean }, s: Pick<SocialState, 'answered' | 'removed'>): boolean {
  if (config.dataMode === 'live') return p.isFriend;
  if (s.removed[p.id]) return false;
  return p.isFriend || s.answered[p.id] === 'accepted';
}

/** Имя друга с учётом моей подписи. */
export function displayName(p: { id: string; name: string }, nicknames: Record<string, string>): string {
  return nicknames[p.id] ?? p.name;
}
