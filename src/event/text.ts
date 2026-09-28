// Тексты страницы события: «Сегодня, 19:30–22:00», «через 2 часа · вечером +16°, ясно».
import type { EventItem } from '../data/types';
import { DEMO_FORECAST, tempLabel, type DayWeather } from '../data/weather';
import { almaty, dayIndex } from '../lib/clock';

const DAYS = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
const DAYS_SHORT = ['ВС', 'ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ'];
const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

const hm = (d: Date) => `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;

export function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
  return many;
}

/** «Сегодня, 19:30–22:00» / «Суббота, 3 октября, 08:00–15:00» / «Сегодня, до 21:00». */
export function whenTitle(e: Pick<EventItem, 'startsAt' | 'endsAt' | 'isLong'>, now: Date): string {
  const s = almaty(e.startsAt);
  const end = e.endsAt ? almaty(e.endsAt) : null;
  const diff = dayIndex(e.startsAt) - dayIndex(now);
  if (e.isLong && end && dayIndex(now) >= dayIndex(e.startsAt)) return `Сегодня, до ${hm(end)}`;
  const day = diff === 0 ? 'Сегодня' : diff === 1 ? 'Завтра' : `${DAYS[s.getUTCDay()]}, ${s.getUTCDate()} ${MONTHS[s.getUTCMonth()]}`;
  const time = end && dayIndex(e.endsAt!) === dayIndex(e.startsAt) ? `${hm(s)}–${hm(end)}` : hm(s);
  return `${day}, ${time}`;
}

export function relative(startsAt: string, now: Date): string {
  const ms = new Date(startsAt).getTime() - now.getTime();
  if (ms <= 0) return 'уже идёт';
  const min = Math.round(ms / 60000);
  if (min < 60) return `через ${min} ${plural(min, 'минуту', 'минуты', 'минут')}`;
  const days = dayIndex(startsAt) - dayIndex(now);
  if (days >= 1) return days === 1 ? 'завтра' : `через ${days} ${plural(days, 'день', 'дня', 'дней')}`;
  const h = Math.round(min / 60);
  return `через ${h} ${plural(h, 'час', 'часа', 'часов')}`;
}

export function dayPart(hour: number): string {
  return hour < 12 ? 'утром' : hour < 17 ? 'днём' : 'вечером';
}

/** Прогноз на время события: вечером на 2° прохладнее дневного. Демо — статичный прогноз на 7 дней. */
export function weatherAt(startsAt: string, now: Date, forecast: DayWeather[] = DEMO_FORECAST): { temp: number; text: string } | null {
  const w = forecast[dayIndex(startsAt) - dayIndex(now)];
  if (!w) return null;
  const h = almaty(startsAt).getUTCHours();
  return { temp: w.temp - (h >= 18 || h < 8 ? 2 : 0), text: w.text };
}

export function whenSub(e: Pick<EventItem, 'startsAt' | 'endsAt' | 'isLong'>, now: Date): string {
  const w = weatherAt(e.startsAt, now);
  const hour = almaty(e.startsAt).getUTCHours();
  const rel = e.isLong && new Date(e.startsAt).getTime() <= now.getTime() && e.endsAt
    ? `открыто ещё ${Math.max(1, Math.round((closeToday(e, now) - now.getTime()) / 3600000))} ${plural(Math.max(1, Math.round((closeToday(e, now) - now.getTime()) / 3600000)), 'час', 'часа', 'часов')}`
    : relative(e.startsAt, now);
  return w ? `${rel} · ${dayPart(hour)} ${tempLabel(w.temp)}, ${w.text}` : rel;
}

function closeToday(e: Pick<EventItem, 'endsAt'>, now: Date): number {
  const end = almaty(e.endsAt!);
  const a = almaty(now);
  const close = Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate(), end.getUTCHours(), end.getUTCMinutes());
  return close - 5 * 3600000;
}

/** Метка даты на обложке: «ПН 28.09». */
export function coverDate(startsAt: string): string {
  const d = almaty(startsAt);
  return `${DAYS_SHORT[d.getUTCDay()]} ${String(d.getUTCDate()).padStart(2, '0')}.${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Время на полосе обложки: «19:30—22:00», «ДО 21:00», «СБОР 08:00». */
export function coverTime(e: Pick<EventItem, 'startsAt' | 'endsAt' | 'isLong' | 'category'>): string {
  const s = almaty(e.startsAt);
  if (e.isLong && e.endsAt) return `ДО ${hm(almaty(e.endsAt))}`;
  if (e.category === 'hike') return `СБОР ${hm(s)}`;
  return e.endsAt ? `${hm(s)}—${hm(almaty(e.endsAt))}` : hm(s);
}

/** Крупный текст обложки из названия, если в данных его нет: до 3 строк по ~11 знаков. */
export function coverLinesFor(title: string): string[] {
  const words = title.replace(/[«»"]/g, '').toUpperCase().split(/\s+/);
  const lines: string[] = [];
  for (const w of words) {
    const last = lines[lines.length - 1];
    if (last && (last + ' ' + w).length <= 11) lines[lines.length - 1] = `${last} ${w}`;
    else lines.push(w);
  }
  return lines.length > 3 ? [...lines.slice(0, 2), `${lines[2]}…`] : lines;
}

export function priceTitle(e: Pick<EventItem, 'isFree' | 'priceMin' | 'priceMax'>): string {
  const n = (v: number) => String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  if (e.isFree || e.priceMin === 0) return 'Бесплатно';
  if (e.priceMin == null) return 'Цена у организатора';
  if (e.priceMax != null && e.priceMax !== e.priceMin) return `${n(e.priceMin)}–${n(e.priceMax)} ₸`;
  return e.priceMax == null ? `от ${n(e.priceMin)} ₸` : `${n(e.priceMin)} ₸`;
}
