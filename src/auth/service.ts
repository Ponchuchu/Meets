// Вход через Supabase Auth: телефон (SMS через Send SMS Hook), Google и Apple (id-токен от нативного входа).
// Если SMS-шлюз ещё не подключён или сети нет — демо: код 4821, вход только на устройстве.
import { supabase, withTimeout } from '../data/client';
import { config } from '../lib/config';
import { DEMO_CODE, parseBirthDate } from './rules';

export type AuthMode = 'sms' | 'demo';

let mode: AuthMode = 'demo';
let pending: Promise<AuthMode> | null = null;
export const authMode = () => mode;

/** «707 123 45 67» → «+77071234567». */
export const e164 = (formatted: string) => `+7${formatted.replace(/\D/g, '')}`;

export function sendCode(phone: string): Promise<AuthMode> {
  pending = requestCode(phone);
  return pending;
}

async function requestCode(phone: string): Promise<AuthMode> {
  mode = 'demo';
  if (config.dataMode === 'demo') return mode;
  try {
    const { error } = await withTimeout(supabase().auth.signInWithOtp({ phone: e164(phone) }), 8000);
    if (!error) mode = 'sms';
    else if (__DEV__) console.warn('[auth] SMS не отправлено, демо-код', error.message);
  } catch (err) {
    if (__DEV__) console.warn('[auth] нет связи с Supabase, демо-код', err);
  }
  return mode;
}

export async function verifyCode(phone: string, code: string): Promise<boolean> {
  if (pending) await pending;
  if (mode === 'demo') return code === DEMO_CODE;
  const { error } = await supabase().auth.verifyOtp({ phone: e164(phone), token: code, type: 'sms' });
  return !error;
}

/** Google / Apple: нативный вход отдаёт id-токен, Supabase его проверяет. Нужны ключи из docs/KEYS.md. */
export async function signInWithIdToken(provider: 'google' | 'apple', token: string, nonce?: string): Promise<boolean> {
  const { error } = await supabase().auth.signInWithIdToken({ provider, token, nonce });
  return !error;
}

export async function signOut(): Promise<void> {
  try {
    await supabase().auth.signOut();
  } catch {
    // вход был демо — выходить неоткуда
  }
}

export interface ProfileDraft {
  name: string;
  photo: string | null;
  birthDate: string;
  interests: string[];
  times: string[];
  withWho: string;
  budget: string;
}

/** После анкеты сохраняем профиль и ответы в базу. Без входа в Supabase — ничего не делаем. */
export async function saveProfile(d: ProfileDraft): Promise<boolean> {
  try {
    const { data } = await supabase().auth.getSession();
    const id = data.session?.user.id;
    const birth = parseBirthDate(d.birthDate);
    if (!id || !birth) return false;
    const photo = d.photo && /^https?:/.test(d.photo) ? d.photo : null;
    const p = await supabase().from('profiles').upsert({ id, name: d.name, birth_date: birth.toISOString().slice(0, 10), photo_url: photo });
    if (p.error) return false;
    const a = await supabase().from('start_answers').upsert({ user_id: id, interests: d.interests, times: d.times, with_who: d.withWho, budget: d.budget, updated_at: new Date().toISOString() });
    return !a.error;
  } catch {
    return false;
  }
}
