// Жизнь точки на карте (PRODUCT.md, раздел 3; Pipeline, блок 06).
import { almaty, dayIndex } from '../lib/clock';
import type { EventItem } from '../data/types';

export type Phase = 'announce' | 'today' | 'soon' | 'live' | 'closing' | 'hidden';

const MIN = 60000;
const HOUR = 60 * MIN;
const LATE_HIDE = 40 * MIN; // через 40 минут после начала опоздавшим уже поздно
const SOON = HOUR;
const CLOSING = 30 * MIN;
const DEFAULT_LENGTH = 2 * HOUR;

export function endOf(e: Pick<EventItem, 'startsAt' | 'endsAt'>): number {
  return e.endsAt ? new Date(e.endsAt).getTime() : new Date(e.startsAt).getTime() + DEFAULT_LENGTH;
}

/**
 * Фаза точки. going — я нажал «Я иду»: тогда событие видно до конца, а не 40 минут.
 * Длинные события (выставка, маркет) видны до закрытия, за 30 минут — «скоро закроется».
 */
export function phaseOf(e: Pick<EventItem, 'startsAt' | 'endsAt' | 'isLong'>, now: Date, going = false): Phase {
  const t = now.getTime();
  const start = new Date(e.startsAt).getTime();
  const end = endOf(e);
  if (t >= end) return 'hidden';
  if (e.isLong) {
    if (t < start) return dayIndex(e.startsAt) === dayIndex(now) ? (start - t <= SOON ? 'soon' : 'today') : 'announce';
    // Длинное событие идёт несколько дней: «открыто» только в свои часы (часы открытия = часы первого дня).
    // До открытия — «сегодня», после закрытия — скрыто до завтра.
    if (!openNow(e, now)) return minutesOfDay(now) < minutesOfDay(new Date(e.startsAt)) ? 'today' : 'hidden';
    return closesToday(e, now) - t <= CLOSING ? 'closing' : 'live';
  }
  if (t >= start) return t - start <= LATE_HIDE || going ? 'live' : 'hidden';
  if (start - t <= SOON) return 'soon';
  return dayIndex(e.startsAt) === dayIndex(now) ? 'today' : 'announce';
}

function minutesOfDay(d: Date): number {
  const a = almaty(d);
  return a.getUTCHours() * 60 + a.getUTCMinutes();
}

function openNow(e: Pick<EventItem, 'startsAt' | 'endsAt'>, now: Date): boolean {
  const open = minutesOfDay(new Date(e.startsAt));
  const close = minutesOfDay(new Date(endOf(e)));
  const m = minutesOfDay(now);
  return close > open ? m >= open && m < close : true;
}

function closesToday(e: Pick<EventItem, 'startsAt' | 'endsAt'>, now: Date): number {
  const close = minutesOfDay(new Date(endOf(e)));
  const a = almaty(now);
  const diff = close - (a.getUTCHours() * 60 + a.getUTCMinutes());
  return now.getTime() + diff * MIN;
}

const hm = (d: Date | string) => {
  const a = almaty(d);
  return `${String(a.getUTCHours()).padStart(2, '0')}:${String(a.getUTCMinutes()).padStart(2, '0')}`;
};

function left(ms: number): string {
  const total = Math.max(1, Math.round(ms / MIN));
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h ? (m ? `${h} Ч ${m} МИН` : `${h} Ч`) : `${m} МИН`;
}

/** Подпись времени для пина и мини-карточки, капсом как в макете. */
export function whenLabel(e: Pick<EventItem, 'startsAt' | 'endsAt' | 'isLong'>, now: Date, going = false): string {
  const phase = phaseOf(e, now, going);
  const start = new Date(e.startsAt);
  switch (phase) {
    case 'live':
      return e.isLong ? `ИДЁТ ДО ${hm(new Date(endOfDayClose(e, now)))}` : `ИДЁТ · ЕЩЁ ${left(endOf(e) - now.getTime())}`;
    case 'closing':
      return 'СКОРО ЗАКРОЕТСЯ';
    case 'soon':
      return `СКОРО · ${hm(start)}`;
    case 'today':
      return e.isLong && now.getTime() >= start.getTime() ? `СЕГОДНЯ С ${hm(start)}` : `СЕГОДНЯ ${hm(start)}`;
    default: {
      const DAYS = ['ВС', 'ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ'];
      const a = almaty(start);
      if (dayIndex(start) - dayIndex(now) === 1) return `ЗАВТРА ${hm(start)}`;
      return `${DAYS[a.getUTCDay()]} ${a.getUTCDate()}.${a.getUTCMonth() + 1} · ${hm(start)}`;
    }
  }
}

function endOfDayClose(e: Pick<EventItem, 'startsAt' | 'endsAt'>, now: Date): number {
  return closesToday(e, now);
}
