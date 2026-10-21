// «Год в Алматы» (21 октября, решение владельца): большие городские события, занесённые один раз вручную.
// Даты 2027 года ещё не объявлены — ориентируемся на 2026. Точные дни — только у фиксированных праздников;
// у остальных — месяц, и честная пометка «точная дата позже». Точка на карте — только там, где место известно.
import type { LucideIcon } from 'lucide-react-native';
import { BookOpen, Cpu, Disc3, Flag, Footprints, Landmark, Medal, MountainSnow, Music4, Snowflake, Sparkles, Tent } from 'lucide-react-native';

export interface CityEvent {
  id: string;
  title: string;
  /** Чем запомнится — одна строка. */
  sub: string;
  /** Ориентир 2026: первый и последний день (YYYY-MM-DD). Без точного дня — весь месяц. */
  from: string;
  to: string;
  /** Точный день известен (праздник) — иначе показываем только месяц. */
  exact: boolean;
  hours?: string;
  free?: boolean;
  place?: string;
  point?: { lat: number; lon: number };
  Icon: LucideIcon;
  color: string;
}

const REPUBLIC_SQ = { lat: 43.2381, lon: 76.9454 };

export const CITY_YEAR: CityEvent[] = [
  { id: 'winter-run', title: 'Winter Run', sub: 'зимний забег по городу', from: '2026-02-01', to: '2026-02-28', exact: false, Icon: Snowflake, color: '#5AA9E6' },
  { id: 'kitapfest', title: 'KitapFest', sub: 'книжный фестиваль на Наурыз', from: '2026-03-21', to: '2026-03-23', exact: true, Icon: BookOpen, color: '#C98A1B' },
  { id: 'half-marathon', title: 'Алматинский полумарафон', sub: '21 км и короткие дистанции', from: '2026-04-01', to: '2026-04-30', exact: false, Icon: Footprints, color: '#2F8F5B' },
  { id: 'museum-night', title: 'Ночь музеев', sub: 'музеи открыты вечером, вход свободный', from: '2026-05-16', to: '2026-05-18', exact: false, hours: '18:00–00:00', free: true, place: 'музеи по всему городу', Icon: Landmark, color: '#7E5BD6' },
  { id: 'gitex', title: 'GITEX', sub: 'технологии и стартапы', from: '2026-05-01', to: '2026-05-31', exact: false, Icon: Cpu, color: '#2447B8' },
  { id: 'park-live', title: 'Park Live', sub: 'большой летний музыкальный фестиваль', from: '2026-07-01', to: '2026-07-31', exact: false, Icon: Music4, color: '#E0457B' },
  { id: 'oyu-fest', title: 'OYU Fest', sub: 'летний фестиваль музыки и искусства', from: '2026-06-01', to: '2026-08-31', exact: false, Icon: Tent, color: '#D9822B' },
  { id: 'beu-fest', title: 'Beu Fest', sub: 'танцы и музыка под открытым небом', from: '2026-06-01', to: '2026-08-31', exact: false, Icon: Sparkles, color: '#C83A26' },
  { id: 'marathon', title: 'Almaty Marathon', sub: 'главный забег года', from: '2026-09-01', to: '2026-09-30', exact: false, place: 'район площади Республики', point: REPUBLIC_SQ, Icon: Medal, color: '#F0521F' },
  { id: 'salsamania', title: 'Salsamania', sub: 'фестиваль сальсы и бачаты', from: '2026-09-01', to: '2026-09-30', exact: false, Icon: Disc3, color: '#B5651D' },
  { id: 'republic-day', title: 'День Республики', sub: 'праздник, концерты и салют', from: '2026-10-25', to: '2026-10-25', exact: true, free: true, place: 'площадь Республики', point: REPUBLIC_SQ, Icon: Flag, color: '#1F9AA8' },
  { id: 'ski-season', title: 'Горнолыжный сезон', sub: 'Шымбулак открывает трассы', from: '2026-11-15', to: '2027-04-15', exact: false, place: 'Шымбулак', point: { lat: 43.1286, lon: 77.0805 }, Icon: MountainSnow, color: '#2C6FB0' },
];

const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const MONTH_NOM = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
const day = (iso: string) => Date.parse(`${iso}T00:00:00+05:00`);

export type CityStatus = 'now' | 'soon' | 'later' | 'next';
export interface CityState { e: CityEvent; status: CityStatus; when: string; daysLeft: number }

/** Где событие сейчас: идёт, скоро (до 14 дней), позже в этом году или уже прошло — тогда ждём следующего года. */
export function cityState(e: CityEvent, now = new Date()): CityState {
  const t = now.getTime();
  const start = day(e.from), end = day(e.to) + 86400e3;
  const m = (iso: string) => Number(iso.slice(5, 7)) - 1;
  const span = e.exact
    ? (e.from === e.to ? `${Number(e.from.slice(8))} ${MONTHS[m(e.from)]}` : `${Number(e.from.slice(8))}–${Number(e.to.slice(8))} ${MONTHS[m(e.to)]}`)
    : m(e.from) === m(e.to) ? MONTH_NOM[m(e.from)] : `${MONTH_NOM[m(e.from)]} – ${MONTH_NOM[m(e.to)]}`;
  if (t >= start && t < end) return { e, status: 'now', when: e.exact ? `сегодня · ${span}` : `сейчас · ${span}`, daysLeft: 0 };
  if (t < start) {
    const days = Math.ceil((start - t) / 86400e3);
    return { e, status: days <= 14 ? 'soon' : 'later', when: e.exact ? span : `${span} · точная дата позже`, daysLeft: days };
  }
  // Прошло в этом году — ориентир на следующий, даты ещё не объявлены.
  return { e, status: 'next', when: `${span} ${Number(e.from.slice(0, 4)) + 1} · даты ещё не объявлены`, daysLeft: Infinity };
}

/** Весь год по порядку: сначала то, что идёт и скоро, потом позже, в конце — уже прошедшее (ждём следующего года). */
export function cityYear(now = new Date()): CityState[] {
  const rank: Record<CityStatus, number> = { now: 0, soon: 1, later: 2, next: 3 };
  return CITY_YEAR.map((e) => cityState(e, now)).sort((a, b) => rank[a.status] - rank[b.status] || a.e.from.localeCompare(b.e.from));
}

/** «через 4 дня», «завтра», «идёт сейчас». */
export function leftText(s: CityState): string {
  if (s.status === 'now') return 'идёт сейчас';
  if (s.daysLeft === 1) return 'завтра';
  const n = s.daysLeft, m10 = n % 10, m100 = n % 100;
  return `через ${n} ${m10 === 1 && m100 !== 11 ? 'день' : m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20) ? 'дня' : 'дней'}`;
}
