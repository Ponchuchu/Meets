// Профиль на устройстве: отметки «Я на месте», мой значок на карте, настройки, предложенные события.
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { deviceStorage } from './storage';

export type SpeedMode = 'exact' | 'approx' | 'simple';
export type Ring = 'blue' | 'orange' | 'green' | 'ink' | 'fire' | 'acid' | 'zebra' | 'gold' | 'candy' | 'rainbow' | 'neon';

/** Кольцо значка: основной цвет + узор + живой эффект (fx). Рисует src/profile/ui/MarkerArt.tsx. */
export interface RingStyle {
  name: string; color: string; second?: string; dashed?: boolean; glow?: boolean;
  /** flame — языки пламени, spin — крутится, pulse — дышит свечением, sparkle — искры, rainbow — радуга по кругу. */
  fx?: 'flame' | 'spin' | 'pulse' | 'sparkle' | 'rainbow';
}
export const RING_STYLES: Record<Ring, RingStyle> = {
  blue: { name: 'Синее', color: '#2447B8' },
  orange: { name: 'Рыжее', color: '#F0521F' },
  green: { name: 'Зелёное', color: '#2F8F5B' },
  ink: { name: 'Чёрное', color: '#17161A' },
  fire: { name: 'Огонь', color: '#F0521F', second: '#F2B632', fx: 'flame' },
  acid: { name: 'Кислота', color: '#B6F23A', second: '#17161A', glow: true, fx: 'pulse' },
  zebra: { name: 'Зебра', color: '#17161A', second: '#FFFFFF', dashed: true, fx: 'spin' },
  gold: { name: 'Золото', color: '#D9A21B', second: '#FFF1B8', fx: 'sparkle' },
  candy: { name: 'Карамель', color: '#E0487E', second: '#8B4FD8', dashed: true, fx: 'spin' },
  rainbow: { name: 'Радуга', color: '#8B4FD8', fx: 'rainbow' },
  neon: { name: 'Неон', color: '#00E0FF', second: '#17161A', glow: true, fx: 'pulse' },
};
export const RING_COLORS: Record<Ring, string> = Object.fromEntries(Object.entries(RING_STYLES).map(([k, v]) => [k, v.color])) as Record<Ring, string>;

/** Статусы над значком — готовые наклейки, без своего текста. «НА СОБЫТИИ» ставится сам по «Я на месте».
 *  shape — как наклейка нарисована: dymo (лента-этикетка), torn (рваная бумага), die (вырезанная с белой каймой),
 *  tape (приклеена скотчем), burst (взрыв-звезда), stamp (штамп). */
export type StickerShape = 'dymo' | 'torn' | 'die' | 'tape' | 'burst' | 'stamp';
export interface StatusSticker { label: string; bg: string; fg: string; rot: number; shape: StickerShape }
export const STATUS_STICKERS: StatusSticker[] = [
  { label: 'СВОБОДЕН', bg: '#17161A', fg: '#B6F23A', rot: -3, shape: 'dymo' },
  { label: 'ИЩУ ДВИЖ', bg: '#F0521F', fg: '#17161A', rot: 2, shape: 'torn' },
  { label: 'ТУСИМ', bg: '#8B4FD8', fg: '#FFFFFF', rot: -4, shape: 'die' },
  { label: 'ЗА КОФЕ', bg: '#EADFB8', fg: '#17161A', rot: 3, shape: 'tape' },
  { label: 'ГУЛЯЮ', bg: '#179C87', fg: '#FFFFFF', rot: -2, shape: 'torn' },
  { label: 'ЕБ#$%У', bg: '#F2B632', fg: '#17161A', rot: 5, shape: 'burst' },
  { label: 'НЕ ТРОГАТЬ', bg: '#D8362A', fg: '#D8362A', rot: -6, shape: 'stamp' },
  { label: 'ЗАНЯТ', bg: '#FFFFFF', fg: '#17161A', rot: 2, shape: 'tape' },
];
export const statusSticker = (label: string) => STATUS_STICKERS.find((x) => x.label === label.toUpperCase()) ?? STATUS_STICKERS[0];

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

interface ProfileState {
  arrivals: { eventId: string; cell: string; at: string }[];
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
      arrivals: [],
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
