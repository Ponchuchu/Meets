// Вход альфы (ALPHA §1): номер → alpha-login?probe (длина кода, тестер ли) → код → сессия Supabase.
import type { Session } from '@supabase/supabase-js';
import { useEffect } from 'react';
import { create } from 'zustand';
import { AppState, Platform } from 'react-native';
import { queryClient } from './query';
import { supabase, withTimeout } from '../data/client';
import { config } from '../lib/config';

const FN = `${config.supabaseUrl}/functions/v1/alpha-login`;

async function callLogin(body: Record<string, unknown>) {
  const res = await withTimeout(fetch(FN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: config.supabaseKey, Authorization: `Bearer ${config.supabaseKey}` },
    body: JSON.stringify(body),
  }), 12000);
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data: data as Record<string, unknown> };
}

/** «+7 747 …» → «+7747…». */
export const e164 = (formatted: string) => `+7${formatted.replace(/\D/g, '').replace(/^[78](?=\d{10})/, '').slice(-10)}`;

export async function probe(phone: string): Promise<{ codeLength: number; tester: boolean }> {
  const { status, data } = await callLogin({ probe: true, phone: e164(phone) });
  if (status !== 200) throw new Error(`probe ${status}`);
  return { codeLength: Number(data.codeLength) || 4, tester: !!data.tester };
}

export type LoginResult = 'ok' | 'bad_code' | 'not_tester' | 'too_many' | 'error';

export async function login(phone: string, code: string): Promise<LoginResult> {
  try {
    const { status, data } = await callLogin({ phone: e164(phone), code });
    if (status === 401) return 'bad_code';
    if (status === 403) return 'not_tester';
    if (status === 429) return 'too_many';
    if (status !== 200 || !data.access_token) return 'error';
    const { error } = await supabase().auth.setSession({ access_token: String(data.access_token), refresh_token: String(data.refresh_token) });
    return error ? 'error' : 'ok';
  } catch {
    return 'error';
  }
}

interface AuthState { ready: boolean; session: Session | null; set: (s: Session | null) => void }
export const useAuth = create<AuthState>((set) => ({ ready: false, session: null, set: (session) => set({ session, ready: true }) }));

/** Один раз в корне: подхватить сохранённую сессию и следить за входом/выходом. */
export function useAuthWatch() {
  useEffect(() => {
    const sb = supabase();
    sb.auth.getSession().then(({ data }) => useAuth.getState().set(data.session)).catch(() => useAuth.getState().set(null));
    const { data } = sb.auth.onAuthStateChange((_e, session) => {
      const previous = useAuth.getState().session?.user.id;
      useAuth.getState().set(session);
      if (session && previous !== session.user.id) {
        // Запросы, запущенные до восстановления сессии, повторяем после входа.
        setTimeout(() => { void queryClient.invalidateQueries(); }, 0);
      }
    });
    if (Platform.OS === 'web') return () => data.subscription.unsubscribe();
    if (AppState.currentState === 'active') sb.auth.startAutoRefresh();
    const app = AppState.addEventListener('change', state => {
      if (state === 'active') sb.auth.startAutoRefresh();
      else sb.auth.stopAutoRefresh();
    });
    return () => { data.subscription.unsubscribe(); app.remove(); sb.auth.stopAutoRefresh(); };
  }, []);
}

export const myId = () => useAuth.getState().session?.user.id ?? null;
