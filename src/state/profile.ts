// Профиль на устройстве: отметки «Я на месте», мой значок на карте, настройки, предложенные события.
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { deviceStorage } from './storage';

export type SpeedMode = 'exact' | 'approx' | 'simple';
export type Ring = 'blue' | 'orange' | 'green' | 'ink' | 'fire' | 'acid' | 'zebra' | 'gold' | 'candy' | 'rainbow' | 'neon';

export interface MarkerSettings {
  showMoving: boolean;
  speedMode: SpeedMode;
  status: string; // одна из STATUS_STICKERS
  ring: Ring;
  inside: 'photo' | 'letter';
  shareUntil: string | null; // «Делиться 2 часа»
  invisible: boolean;
}

export interface Settings {
  plansVisible: 'all' | 'friends' | 'nobody';
  whereNow: 'off' | '2h' | 'always';
  whoCanWrite: 'all' | 'friends' | 'common';
  achievements: 'me' | 'friends' | 'all';
  instaAvatar: boolean;
  instaLink: boolean;
  notif: { friendNear: boolean; interestNear: boolean; remind2h: boolean; messages: boolean; weekend: boolean };
  mapStyle: 'paper' | 'night' | 'auto';
  popularBigger: boolean;
}

export interface Suggestion {
  id: string;
  title: string;
  at: string;
  status: 'review';
  /** Поля, как их разобрали с афиши: «Пт, 2 октября», «20:00», место, цена. */
  date?: string;
  time?: string;
  place?: string;
  price?: string;
}

/** Что я показываю в профиле (демо хранит здесь, живая версия — в profiles): статус, о себе, интересы, Instagram. */
export interface MyCard { status: string; about: string; tags: string[]; instagram: string }
export const EMPTY_CARD: MyCard = { status: '', about: '', tags: [], instagram: '' };

interface ProfileState {
  card: MyCard;
  /** Мои фото в демо (главное первым); в живой версии — profiles.photo_url + photos. */
  photos: string[];
  setPhotos: (p: string[]) => void;
  setCard: (p: Partial<MyCard>) => void;
  arrivals: { eventId: string; cell: string; at: string }[];
  mapFrame: string;
  setMapFrame: (id: string) => void;
  mapShape: string;
  setMapShape: (id: string) => void;
  marker: MarkerSettings;
  settings: Settings;
  suggestions: Suggestion[];
  arrive: (eventId: string, cell: string) => void;
  setMarker: (p: Partial<MarkerSettings>) => void;
  setSettings: (p: Partial<Settings>) => void;
  suggest: (s: Pick<Suggestion, 'title' | 'date' | 'time' | 'place' | 'price'>) => void;
}

export const DEFAULT_MARKER: MarkerSettings = {
  showMoving: true, speedMode: 'exact', status: 'СВОБОДЕН', ring: 'blue', inside: 'photo', shareUntil: null, invisible: false,
};

export const DEFAULT_SETTINGS: Settings = {
  plansVisible: 'friends', whereNow: '2h', whoCanWrite: 'common', achievements: 'friends', instaAvatar: true, instaLink: true,
  notif: { friendNear: true, interestNear: true, remind2h: true, messages: true, weekend: false },
  mapStyle: 'auto', popularBigger: true,
};

export const useProfile = create<ProfileState>()(
  persist(
    (set) => ({
      card: EMPTY_CARD,
      photos: [],
      setPhotos: (photos) => set({ photos: photos.slice(0, 6) }),
      setCard: (p) => set((s) => ({ card: { ...s.card, ...p } })),
      arrivals: [],
      mapFrame: 'classic',
      setMapFrame: (mapFrame) => set({ mapFrame }),
      mapShape: 'auto',
      setMapShape: (mapShape) => set({ mapShape }),
      marker: DEFAULT_MARKER,
      settings: DEFAULT_SETTINGS,
      suggestions: [],
      arrive: (eventId, cell) => set((s) => (s.arrivals.some((a) => a.eventId === eventId) ? s : { arrivals: [...s.arrivals, { eventId, cell, at: new Date().toISOString() }] })),
      setMarker: (p) => set((s) => ({ marker: { ...s.marker, ...p } })),
      setSettings: (p) => set((s) => ({ settings: { ...s.settings, ...p } })),
      suggest: (x) => set((s) => ({ suggestions: [...s.suggestions, { ...x, id: `sg-${Date.now()}`, at: new Date().toISOString(), status: 'review' }] })),
    }),
    { name: 'ryadom-profile', storage: deviceStorage() },
  ),
);

/** «Невидимка» и режимы скорости: что друзья видят о моём значке. */
export function speedLabel(kmh: number, m: MarkerSettings, vehicle = 'на самокате'): string | null {
  if (!m.showMoving || m.invisible || kmh <= 3) return null;
  if (m.speedMode === 'exact') return `${Math.round(kmh)} КМ/Ч`;
  if (m.speedMode === 'approx') return vehicle.toUpperCase();
  return 'В ПУТИ';
}
