// Часы работы постоянного места: «Открыто до 22:00», «Перерыв до 14:00», «Закрыто · откроется завтра в 10:00».
// Время — по Алматы (UTC+5). Часы хранятся по дням недели ISO; два интервала в дне — между ними перерыв.
import type { Hours } from './attractions';

type Day = keyof Hours;
const DAY_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const toMin = (hm: string) => { const [h, m] = hm.split(':').map(Number); return h * 60 + (m || 0); };
const fromMin = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
/** День недели ISO и минуты от полуночи по Алматы. */
export function almatyNow(now: Date): { day: number; min: number } {
  const d = new Date(now.getTime() + 5 * 3600e3);
  return { day: ((d.getUTCDay() + 6) % 7) + 1, min: d.getUTCHours() * 60 + d.getUTCMinutes() };
}
const spansOf = (h: Hours, day: number): [number, number][] =>
  (h[String(day) as Day] ?? []).map(([a, b]) => { const s = toMin(a), e = toMin(b); return [s, e <= s ? e + 24 * 60 : e] as [number, number]; });

/** Все 7 дней 00:00–24:00. */
export const alwaysOpen = (h: Hours) => [1, 2, 3, 4, 5, 6, 7].every((d) => { const x = h[String(d) as Day]; return x?.length === 1 && x[0][0] === '00:00' && (x[0][1] === '24:00' || x[0][1] === '23:59'); });

export type OpenState = 'open' | 'break' | 'closed' | 'unknown';
export interface OpenStatus { state: OpenState; text: string; breakText?: string }

export function openStatus(h: Hours | null | undefined, now = new Date()): OpenStatus {
  if (!h || !Object.keys(h).length) return { state: 'unknown', text: 'Часы уточняются' };
  if (alwaysOpen(h)) return { state: 'open', text: 'Открыто круглосуточно' };
  const { day, min } = almatyNow(now);
  // Ночные часы вчерашнего дня (до 02:00) тоже считаются.
  const yesterday = spansOf(h, day === 1 ? 7 : day - 1).find(([, e]) => e > 24 * 60 && min < e - 24 * 60);
  if (yesterday) return { state: 'open', text: `Открыто до ${fromMin(yesterday[1])}` };
  const today = spansOf(h, day);
  const brk = today.length > 1 ? `перерыв ${fromMin(today[0][1])}–${fromMin(today[1][0])}` : undefined;
  const cur = today.find(([s, e]) => min >= s && min < e);
  if (cur) return { state: 'open', text: `Открыто до ${fromMin(cur[1])}`, breakText: brk && min < today[0][1] ? brk : undefined };
  const later = today.find(([s]) => s > min);
  if (later && today.some(([, e]) => e <= min)) return { state: 'break', text: `Перерыв до ${fromMin(later[0])}` };
  if (later) return { state: 'closed', text: `Откроется в ${fromMin(later[0])}`, breakText: brk };
  for (let k = 1; k <= 7; k++) {
    const d = ((day - 1 + k) % 7) + 1;
    const first = spansOf(h, d)[0];
    if (first) return { state: 'closed', text: `Закрыто · откроется ${k === 1 ? 'завтра' : DAY_SHORT[d - 1].toLowerCase()} в ${fromMin(first[0])}` };
  }
  return { state: 'closed', text: 'Сейчас закрыто' };
}

/** Неделя строками: «Пн  10:00–13:00, 14:00–22:00» / «Вс  выходной». Одинаковые дни подряд склеиваются: «Пн–Пт». */
export function weekLines(h: Hours | null | undefined): { days: string; time: string }[] {
  if (!h) return [];
  if (alwaysOpen(h)) return [{ days: 'Каждый день', time: 'круглосуточно' }];
  const rows = DAY_SHORT.map((label, i) => ({ label, time: (h[String(i + 1) as Day] ?? []).map(([a, b]) => `${a}–${b}`).join(', ') || 'выходной' }));
  const out: { days: string; time: string }[] = [];
  for (let i = 0; i < rows.length;) {
    let j = i;
    while (j + 1 < rows.length && rows[j + 1].time === rows[i].time) j++;
    out.push({ days: i === j ? rows[i].label : `${rows[i].label}–${rows[j].label}`, time: rows[i].time });
    i = j + 1;
  }
  return out;
}

/** Время, на которое можно запланировать поход в этот день: каждые 30 минут, пока открыто (и хотя бы час до закрытия). */
export function slotsFor(h: Hours | null | undefined, dayIso: number, fromMinute = 0): string[] {
  const spans = h && Object.keys(h).length ? spansOf(h, dayIso) : [[9 * 60, 21 * 60] as [number, number]];
  const out: string[] = [];
  for (const [s, e] of spans) for (let m = Math.ceil(Math.max(s, fromMinute) / 30) * 30; m <= e - 60; m += 30) out.push(fromMin(m));
  return out;
}
