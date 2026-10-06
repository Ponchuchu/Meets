// «Создать встречу»: из формы — событие на карте. Точный адрес видят только принявшие приглашение.
import type { Category, EventItem, MeetupItem } from '../data/types';
import { dayIndex, dayStart } from '../lib/clock';

export type MeetupKind = 'dinner' | 'movie' | 'games' | 'walk' | 'sport' | 'party';
export type MeetupMode = 'friends' | 'open';

export const KIND_CATEGORY: Record<MeetupKind, Category> = {
  dinner: 'food', movie: 'talks', games: 'games', walk: 'meetup', sport: 'sport', party: 'party',
};

// Центры районов Алматы: остальным показываем только район, не адрес.
export const DISTRICTS: Record<string, { lat: number; lon: number }> = {
  'Алмалы': { lat: 43.2560, lon: 76.9230 },
  'Бостандык': { lat: 43.2240, lon: 76.9180 },
  'Медеу': { lat: 43.2560, lon: 76.9650 },
  'Ауэзов': { lat: 43.2330, lon: 76.8550 },
  'Жетысу': { lat: 43.2900, lon: 76.9300 },
  'Турксиб': { lat: 43.3300, lon: 76.9600 },
  'Наурызбай': { lat: 43.1950, lon: 76.8000 },
  'Алатау': { lat: 43.2600, lon: 76.8000 },
};

export interface MeetupForm {
  mode: MeetupMode;
  kind: MeetupKind;
  title: string;
  note: string;
  dayOffset: number;
  time: string; // HH:MM
  place: string;
  district: string;
  address: string;
  invited: string[];
  plusOne: boolean;
  items: MeetupItem[];
  /** Точка, выбранная на карте. Нет — центр района. */
  point?: { lat: number; lon: number } | null;
  entrance?: string;
  floor?: string;
  apt?: string;
}

/** «Абая 44 · подъезд 2 · этаж 5 · кв. 41» — как в доставке. */
export function fullAddress(f: Pick<MeetupForm, 'address' | 'entrance' | 'floor' | 'apt'>): string {
  return [f.address.trim(), f.entrance?.trim() && `подъезд ${f.entrance.trim()}`, f.floor?.trim() && `этаж ${f.floor.trim()}`, f.apt?.trim() && `кв. ${f.apt.trim()}`]
    .filter(Boolean).join(' · ');
}

export function meetupStart(dayOffset: number, time: string, now: Date): string {
  const [h, m] = time.split(':').map(Number);
  return new Date(dayStart(dayIndex(now) + dayOffset).getTime() + (h * 60 + m) * 60000).toISOString();
}

export function validateMeetup(f: MeetupForm, now?: Date): string | null {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(f.time) || !Number.isInteger(f.dayOffset) || f.dayOffset < 0) return 'Проверь дату и время';
  if (!f.address.trim()) return 'Выбери адрес встречи';
  if (f.point && (!Number.isFinite(f.point.lat) || !Number.isFinite(f.point.lon) || Math.abs(f.point.lat)>90 || Math.abs(f.point.lon)>180)) return 'Выбери точку на карте';
  if (now && new Date(meetupStart(f.dayOffset, f.time, now)).getTime() <= now.getTime()) return 'Выбери время в будущем';
  if (!f.title.trim()) return 'Назови встречу';
  if (f.mode === 'friends' && f.invited.length === 0) return 'Выбери, кого позвать';
  return null;
}

export function buildMeetup(f: MeetupForm, now: Date, id = `meet-${Date.now()}`): EventItem {
  const start = meetupStart(f.dayOffset, f.time, now);
  const point = f.point ?? DISTRICTS[f.district] ?? DISTRICTS['Алмалы'];
  const addr = fullAddress(f);
  return {
    id, title: f.title.trim(), category: KIND_CATEGORY[f.kind], tags: [], startsAt: start,
    endsAt: new Date(new Date(start).getTime() + 3 * 3600000).toISOString(), isLong: false,
    venueName: f.place || null,
    // Адрес целиком — только у меня и у принявших; в общих данных — район.
    address: addr ? (f.place ? `${f.place} · ${addr}` : addr) : `${f.place} · ${f.district}`,
    addressNote: 'точный адрес видят только гости, которые приняли приглашение',
    lat: point.lat, lon: point.lon, needsPin: false,
    priceMin: 0, priceMax: 0, isFree: true, about: f.note, organizer: 'Ты', sourceUrl: null, source: undefined,
    cover: null, visibility: f.mode === 'friends' ? 'friends' : 'public', origin: 'demo',
    friendsGoing: [], lookingCount: 0, goingCount: 1,
    meetup: { kind: f.kind, plusOne: f.plusOne, invited: f.invited, items: f.items },
  };
}

export function ctaLabel(f: Pick<MeetupForm, 'mode' | 'invited'>): string {
  if (f.mode === 'open') return 'Опубликовать на карте';
  const n = f.invited.length;
  if (!n) return 'Выбери, кого позвать';
  const word = n % 10 === 1 && n % 100 !== 11 ? 'друга' : 'друзей';
  return `Позвать ${n} ${word}`;
}
