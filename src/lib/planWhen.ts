// Подпись времени плана: «СЕГОДНЯ · 19:00», «ЗАВТРА · 20:00», «ПТ 10.10 · 19:00».
import type { EventItem } from '../data/types';
import { almaty, dayIndex } from './clock';

const DAYS = ['ВС', 'ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ'];

export function planWhen(e: EventItem, now: Date): { text: string; today: boolean } {
  const a = almaty(e.startsAt);
  const hm = (d: Date) => `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
  const today = dayIndex(e.startsAt) === dayIndex(now) || (e.isLong && dayIndex(e.startsAt) <= dayIndex(now));
  if (e.isLong && e.endsAt && today) return { text: `СЕГОДНЯ · ДО ${hm(almaty(e.endsAt))}`, today };
  if (today) return { text: `СЕГОДНЯ · ${hm(a)}`, today };
  if (dayIndex(e.startsAt) - dayIndex(now) === 1) return { text: `ЗАВТРА · ${hm(a)}`, today: false };
  return { text: `${DAYS[a.getUTCDay()]} ${a.getUTCDate()}.${a.getUTCMonth() + 1} · ${hm(a)}`, today: false };
}
