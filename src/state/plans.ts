// «Мои планы» и всё, что я делаю с событиями: иду, сохранил, ищу компанию, позвал, создал встречу.
// Хранится на устройстве; в Supabase (attendance, company_requests, invites, meetups) — этап 8.
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { track } from '../analytics';
import { pushAttendance } from '../data/sync';
import { deviceStorage } from './storage';
import type { EventItem } from '../data/types';

export type Mood = 'music' | 'meet' | 'walk' | 'notalone';
export type CompanyVisibility = 'all' | 'fof';

export interface CompanyRequest {
  eventId: string;
  moods: Mood[];
  visibility: CompanyVisibility;
  note: string;
  at: string;
}

export interface Invite {
  id: string;
  eventId: string;
  friendIds: string[];
  at: string;
}

/** Лимит новых разговоров с незнакомыми в день (PRODUCT.md, раздел 5). */
export const NEW_CHATS_PER_DAY = 10;
/** Причин «зачем идёшь» — сколько угодно из списка. */
export const MAX_MOODS = 4;

interface PlansState {
  /** Чьи это планы (id аккаунта) — при входе другим аккаунтом всё стирается. */
  owner: string | null;
  going: Record<string, string>; // eventId → когда нажал
  saved: Record<string, true>;
  company: Record<string, CompanyRequest>;
  invites: Invite[];
  meetups: EventItem[];
  newChats: { day: string; people: string[] };
  declined: Record<string, true>;
  decline: (eventId: string) => void;
  go: (eventId: string) => void;
  ungo: (eventId: string) => void;
  toggleSave: (eventId: string) => void;
  lookForCompany: (r: Omit<CompanyRequest, 'at'>) => void;
  withdrawCompany: (eventId: string) => void;
  invite: (eventId: string, friendIds: string[]) => void;
  addMeetup: (e: EventItem) => void;
  /** Начать разговор с незнакомым: false, если лимит на сегодня исчерпан. */
  startChat: (personId: string, today: string) => boolean;
}

export const usePlans = create<PlansState>()(
  persist(
    (set, get) => ({
      owner: null,
      going: {},
      saved: {},
      company: {},
      invites: [],
      meetups: [],
      newChats: { day: '', people: [] },
      declined: {},
      decline: (id) => set((s) => ({ declined: { ...s.declined, [id]: true } })),
      go: (id) => {
        pushAttendance(id, 'going');
        set((s) => ({ going: { ...s.going, [id]: new Date().toISOString() } }));
      },
      ungo: (id) => set((s) => {
        pushAttendance(id, null);
        track('cancel_plan', id);
        const going = { ...s.going };
        delete going[id];
        return { going };
      }),
      toggleSave: (id) => set((s) => {
        const saved = { ...s.saved };
        if (saved[id]) delete saved[id];
        else saved[id] = true;
        return { saved };
      }),
      lookForCompany: (r) => set((s) => ({ company: { ...s.company, [r.eventId]: { ...r, moods: r.moods.slice(0, MAX_MOODS), at: new Date().toISOString() } } })),
      withdrawCompany: (id) => set((s) => {
        const company = { ...s.company };
        delete company[id];
        return { company };
      }),
      invite: (eventId, friendIds) => set((s) => ({ invites: [...s.invites, { id: `inv-${Date.now()}`, eventId, friendIds, at: new Date().toISOString() }] })),
      addMeetup: (e) => set((s) => ({ meetups: [...s.meetups, e], going: { ...s.going, [e.id]: new Date().toISOString() } })),
      startChat: (personId, today) => {
        const { newChats } = get();
        const people = newChats.day === today ? newChats.people : [];
        if (people.includes(personId)) return true;
        if (people.length >= NEW_CHATS_PER_DAY) return false;
        set({ newChats: { day: today, people: [...people, personId] } });
        return true;
      },
    }),
    {
      name: 'ryadom-plans',
      storage: deviceStorage(),
    },
  ),
);

/** Заявка «ищу компанию» снимается сама, когда событие началось. */
export function activeCompany(r: CompanyRequest | undefined, e: Pick<EventItem, 'startsAt'>, now: Date): boolean {
  return !!r && now.getTime() < new Date(e.startsAt).getTime();
}
