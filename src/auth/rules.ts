// Правила регистрации: телефон, код, дата рождения, 18+, интересы. Чистые функции — покрыты тестами.

export const DEMO_CODE = '4821';
export const RESEND_SECONDS = 42;
export const MIN_INTERESTS = 3;
export const MIN_AGE = 18;

/** «7071234567» → «707 123 45 67». Лишние символы выбрасываются, максимум 10 цифр. */
export function formatPhone(input: string): string {
  const d = input.replace(/\D/g, '').replace(/^[78](?=\d{10})/, '').slice(0, 10);
  const parts = [d.slice(0, 3), d.slice(3, 6), d.slice(6, 8), d.slice(8, 10)].filter(Boolean);
  return parts.join(' ');
}

export function isPhoneComplete(formatted: string): boolean {
  return formatted.replace(/\D/g, '').length === 10;
}

export function onlyCode(input: string): string {
  return input.replace(/\D/g, '').slice(0, 4);
}

/** Маска даты «ДД.ММ.ГГГГ» по мере ввода. */
export function maskBirthDate(input: string): string {
  const d = input.replace(/\D/g, '').slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}.${d.slice(2)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 4)}.${d.slice(4)}`;
}

/** «ДД.ММ.ГГГГ» → дата или null, если такой даты нет. */
export function parseBirthDate(value: string): Date | null {
  const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(value.trim());
  if (!m) return null;
  const [dd, mm, yyyy] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(yyyy, mm - 1, dd));
  if (date.getUTCFullYear() !== yyyy || date.getUTCMonth() !== mm - 1 || date.getUTCDate() !== dd) return null;
  if (yyyy < 1900) return null;
  return date;
}

export function ageOn(birth: Date, now = new Date()): number {
  let age = now.getUTCFullYear() - birth.getUTCFullYear();
  const beforeBirthday = now.getUTCMonth() < birth.getUTCMonth() ||
    (now.getUTCMonth() === birth.getUTCMonth() && now.getUTCDate() < birth.getUTCDate());
  if (beforeBirthday) age--;
  return age;
}

export type BirthCheck = { ok: true; age: number } | { ok: false; reason: 'empty' | 'invalid' | 'future' | 'young' };

export function checkBirthDate(value: string, now = new Date()): BirthCheck {
  if (!value.trim()) return { ok: false, reason: 'empty' };
  const d = parseBirthDate(value);
  if (!d) return { ok: false, reason: 'invalid' };
  if (d.getTime() > now.getTime()) return { ok: false, reason: 'future' };
  const age = ageOn(d, now);
  if (age < MIN_AGE) return { ok: false, reason: 'young' };
  if (age > 110) return { ok: false, reason: 'invalid' };
  return { ok: true, age };
}

export const BIRTH_ERRORS: Record<Exclude<BirthCheck, { ok: true }>['reason'], string> = {
  empty: 'Нужно 18+. Другим покажем только возраст.',
  invalid: 'Проверь дату: ДД.ММ.ГГГГ',
  future: 'Проверь дату: ДД.ММ.ГГГГ',
  young: 'Пока рано: «рядом.» только для тех, кому 18+',
};
