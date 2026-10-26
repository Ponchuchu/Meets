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

/** Неделя по Алматы со сдвигом (0 — эта, -1 — прошлая): даты понедельника…воскресенья «YYYY-MM-DD». */
export function weekDays(today: string, offset = 0): string[] {
  const t = Date.parse(`${today}T00:00:00Z`);
  const monday = t - ((new Date(t).getUTCDay() + 6) % 7) * 86400e3 + offset * 7 * 86400e3;
  return Array.from({ length: 7 }, (_, i) => new Date(monday + i * 86400e3).toISOString().slice(0, 10));
}

/** Рейтинг за выбранные дни: сумма шагов на человека, по убыванию; при равенстве — по имени. */
export function rankFor<T extends { user_id: string; day: string | null; steps: number }>(rows: T[], days: string[]): (T & { total: number })[] {
  const set = new Set(days);
  const by = new Map<string, T & { total: number }>();
  for (const r of rows) {
    const cur = by.get(r.user_id) ?? { ...r, total: 0 };
    // Строка без дня — запасной ответ старой функции: там уже сумма за период.
    if (r.day == null || set.has(r.day)) cur.total += r.steps;
    by.set(r.user_id, cur);
  }
  return [...by.values()].sort((a, b) => b.total - a.total || String((a as { name?: string }).name ?? '').localeCompare(String((b as { name?: string }).name ?? '')));
}
