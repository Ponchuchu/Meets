// Соревнования по шагам (FIX3): лидер, сколько осталось, победитель. Без интерфейса — покрыто тестами.
import type { Challenge } from '../live/profileExtras';

const dayNum = (d: string) => Math.round(Date.parse(`${d}T00:00:00Z`) / 86400e3);

export function challengeState(c: Challenge, today: string) {
  const joined = c.members.filter(m => m.status === 'joined').sort((a, b) => b.steps - a.steps);
  const left = dayNum(c.ends_on) - dayNum(today);
  const reached = c.kind === 'goal' && c.goal != null ? joined.filter(m => m.steps >= c.goal!) : [];
  const finished = left < 0 || reached.length > 0;
  const winner = finished ? (reached[0] ?? joined[0] ?? null) : null;
  const top = Math.max(1, c.kind === 'goal' && c.goal ? c.goal : joined[0]?.steps ?? 1);
  return {
    joined, finished, winner,
    leader: joined[0] ?? null,
    daysLeft: Math.max(0, left + 1),
    /** Доля полосы участника: от цели или от лидера. */
    share: (steps: number) => Math.min(1, steps / top),
    label: finished ? (winner ? `Победил ${winner.name}` : 'Закончилось') : left === 0 ? 'Последний день' : `Осталось ${left + 1} дн.`,
  };
}

/** Место в рейтинге: 1–3 — медаль, остальные — номер. */
export const rankTone = (i: number) => (['#E2A21B', '#9AA3AE', '#B8733F'] as const)[i] ?? null;
