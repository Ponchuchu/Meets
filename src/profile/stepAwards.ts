// Награды за шаги (FIX3 Ф7): считаются по истории дней с сервера (daily_steps) и шагам сегодня.
// Медали с id «steps-…» — их можно поставить рядом с именем, как обычные значки.
export interface StepDay { day: string; steps: number }
export interface StepAward { id: string; name: string; how: string; goal: number; progress: number; got: boolean }

const DEFS: { id: string; name: string; how: string; goal: number; value: (days: StepDay[]) => number }[] = [
  { id: 'steps-first', name: 'Первые 10 000', how: '10 000 шагов за один день', goal: 10000, value: d => Math.max(0, ...d.map(x => x.steps)) },
  { id: 'steps-streak', name: 'Неделя в движении', how: '7 дней подряд от 6 000 шагов', goal: 7, value: d => bestStreak(d, 6000) },
  { id: 'steps-week', name: 'Сто тысяч', how: '100 000 шагов за 7 дней подряд', goal: 100000, value: d => bestWindow(d, 7) },
  { id: 'steps-marathon', name: 'Марафонец', how: '55 000 шагов за день — это как 42 км', goal: 55000, value: d => Math.max(0, ...d.map(x => x.steps)) },
  { id: 'steps-month', name: 'Город пешком', how: '300 000 шагов за 30 дней', goal: 300000, value: d => bestWindow(d, 30) },
];

const dayNum = (day: string) => Math.round(Date.parse(`${day}T00:00:00Z`) / 86400e3);

/** Самая длинная серия дней подряд, в которые шагов ≥ min. */
export function bestStreak(days: StepDay[], min: number): number {
  const ok = [...new Set(days.filter(d => d.steps >= min).map(d => dayNum(d.day)))].sort((a, b) => a - b);
  let best = 0, run = 0, prev = Number.NaN;
  for (const n of ok) { run = n === prev + 1 ? run + 1 : 1; prev = n; best = Math.max(best, run); }
  return best;
}

/** Больше всего шагов за любые `size` календарных дней подряд. */
export function bestWindow(days: StepDay[], size: number): number {
  const by = new Map<number, number>();
  for (const d of days) by.set(dayNum(d.day), Math.max(by.get(dayNum(d.day)) ?? 0, d.steps));
  let best = 0;
  for (const start of by.keys()) {
    let sum = 0;
    for (let i = 0; i < size; i++) sum += by.get(start + i) ?? 0;
    best = Math.max(best, sum);
  }
  return best;
}

/** История с сервера + сегодняшние шаги с телефона (они свежее). */
export function stepAwards(history: StepDay[], today: StepDay | null): StepAward[] {
  const days = today ? [...history.filter(d => d.day !== today.day), { day: today.day, steps: Math.max(today.steps, history.find(d => d.day === today.day)?.steps ?? 0) }] : history;
  return DEFS.map(def => { const v = def.value(days); return { id: def.id, name: def.name, how: def.how, goal: def.goal, progress: Math.min(v, def.goal), got: v >= def.goal }; });
}

/** Последние 7 дней для столбиков: от старого к сегодняшнему, пропуски — нули. */
export function lastWeek(history: StepDay[], todayDay: string, todaySteps: number): StepDay[] {
  const t = dayNum(todayDay);
  return Array.from({ length: 7 }, (_, i) => {
    const n = t - 6 + i;
    const day = new Date(n * 86400e3).toISOString().slice(0, 10);
    const steps = n === t ? Math.max(todaySteps, history.find(d => d.day === day)?.steps ?? 0) : history.find(d => d.day === day)?.steps ?? 0;
    return { day, steps };
  });
}
