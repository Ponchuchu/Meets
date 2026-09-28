// Форматирование чисел и дат как в макете: JetBrains Mono капсом — «СЕГОДНЯ · 19:30», «3 000 ₸».
const DAYS = ['ВС', 'ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ'];
const TZ_OFFSET_MIN = 5 * 60; // Алматы, UTC+5

/** Время события в часовом поясе Алматы, независимо от часового пояса устройства. */
function almaty(iso: string): Date {
  const d = new Date(iso);
  return new Date(d.getTime() + TZ_OFFSET_MIN * 60000);
}

export function formatPrice(min: number | null, max: number | null, isFree: boolean): string {
  if (isFree || min === 0) return '0 ₸';
  if (min == null) return '';
  const n = (v: number) => String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return max != null && max !== min ? `ОТ ${n(min)} ₸` : max == null ? `ОТ ${n(min)} ₸` : `${n(min)} ₸`;
}

export function formatWhen(iso: string, now = new Date()): string {
  const d = almaty(iso);
  const t = almaty(now.toISOString());
  const hm = `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
  const dayKey = (x: Date) => Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate());
  const diff = Math.round((dayKey(d) - dayKey(t)) / 86400000);
  if (diff === 0) return `СЕГОДНЯ · ${hm}`;
  if (diff === 1) return `ЗАВТРА · ${hm}`;
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()}.${d.getUTCMonth() + 1} · ${hm}`;
}
