// Календарь на карте: 5 недель с понедельника текущей недели, погода на 7 дней, плотность событий точками.
import { almaty, dayIndex, dayStart } from '../lib/clock';
import type { EventItem } from '../data/types';
import { occursOnDay } from './filters';

const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

export interface CalendarCell {
  offset: number; // дней от сегодня
  day: number; // число месяца
  month: number;
  weekday: number; // 0 — пн
  past: boolean;
  density: 1 | 2 | 3;
}

export function calendarCells(now: Date, events: EventItem[], weeks = 5): CalendarCell[] {
  const today = dayIndex(now);
  const a = almaty(now);
  const wd = (a.getUTCDay() + 6) % 7; // пн = 0
  const first = today - wd;
  const counts = new Map<number, number>();
  for (let d = first; d < first + weeks * 7; d++) counts.set(d, events.filter((e) => occursOnDay(e, d)).length);
  return Array.from({ length: weeks * 7 }, (_, i) => {
    const d = first + i;
    const date = almaty(dayStart(d));
    const n = counts.get(d) ?? 0;
    return {
      offset: d - today,
      day: date.getUTCDate(),
      month: date.getUTCMonth(),
      weekday: i % 7,
      past: d < today,
      density: n >= 5 ? 3 : n >= 2 ? 2 : 1,
    };
  });
}

/** «Сентябрь — октябрь»: месяц первого дня и месяц, где больше всего дней сетки. Хвост в 1–2 дня не считаем. */
export function monthsTitle(cells: CalendarCell[]): string {
  const count = new Map<number, number>();
  cells.forEach((c) => count.set(c.month, (count.get(c.month) ?? 0) + 1));
  const first = cells[0].month;
  const main = [...count.entries()].sort((a, b) => b[1] - a[1])[0][0];
  return main === first ? MONTHS[first] : `${MONTHS[first]} — ${MONTHS[main].toLowerCase()}`;
}

export function dayName(offset: number, now: Date): string {
  const d = almaty(dayStart(dayIndex(now) + offset));
  return `${d.getUTCDate()} ${MONTHS_SHORT[d.getUTCMonth()]}`;
}

/** Подпись на пилюле: «Сегодня», «Завтра», «Выходные», «3 окт», «28 сен – 4 окт». */
export function rangeLabel(from: number, to: number, now: Date): string {
  if (from === to) return from === 0 ? 'Сегодня' : from === 1 ? 'Завтра' : dayName(from, now);
  if (from === 0 && to === 6) return 'Неделя';
  const [sat, sun] = weekend(now);
  if (from === sat && to === sun) return 'Выходные';
  return `${dayName(from, now)} – ${dayName(to, now)}`;
}

/** Смещения ближайших субботы и воскресенья. */
export function weekend(now: Date): [number, number] {
  const wd = (almaty(now).getUTCDay() + 6) % 7;
  const sat = wd === 6 ? -1 : 5 - wd;
  return [Math.max(0, sat), 6 - wd];
}
