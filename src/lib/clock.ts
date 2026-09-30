// Время приложения. В демо можно «заморозить» время дня, чтобы карта выглядела как макет
// (web: ?clock=18:10 или localStorage 'ryadom-clock'; телефон: EXPO_PUBLIC_DEMO_CLOCK).
const TZ_MIN = 5 * 60; // Алматы, UTC+5

function readOverride(): string | null {
  const env = process.env.EXPO_PUBLIC_DEMO_CLOCK;
  if (env) return env;
  if (typeof window === 'undefined' || typeof window.location === 'undefined') return null;
  try {
    const q = new URLSearchParams(window.location.search).get('clock');
    if (q) window.localStorage.setItem('ryadom-clock', q);
    return q ?? window.localStorage.getItem('ryadom-clock');
  } catch {
    return null;
  }
}

/** Сейчас. При демо-часах — сегодняшняя дата с заданным временем по Алматы. */
export function now(): Date {
  const real = new Date();
  const o = readOverride();
  const m = o ? /^(\d{1,2}):(\d{2})$/.exec(o) : null;
  if (!m) return real;
  const local = new Date(real.getTime() + TZ_MIN * 60000);
  local.setUTCHours(Number(m[1]), Number(m[2]), 0, 0);
  return new Date(local.getTime() - TZ_MIN * 60000);
}

/** Дата в поясе Алматы как «стенные часы» в UTC-полях (getUTCHours = час в Алматы). */
export function almaty(d: Date | string): Date {
  const t = typeof d === 'string' ? new Date(d) : d;
  return new Date(t.getTime() + TZ_MIN * 60000);
}

/** Номер дня (от эпохи) по Алматы — для сравнения «сегодня / завтра». */
export function dayIndex(d: Date | string): number {
  return Math.floor(almaty(d).getTime() / 86400000);
}

/** Полночь по Алматы для дня с индексом. */
export function dayStart(index: number): Date {
  return new Date(index * 86400000 - TZ_MIN * 60000);
}
