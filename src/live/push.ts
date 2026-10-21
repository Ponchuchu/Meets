// Токен устройства сохраняется после входа и обновляется при возвращении из настроек.
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';
import { create } from 'zustand';
import { AppState, Platform } from 'react-native';
import { supabase, withTimeout } from '../data/client';
import { config } from '../lib/config';
import { useAuth } from './auth';

let registeredToken: string | null = null;
let askedThisRun = false;

/** Что с пушами на этом телефоне — показываем в «Настройки → Уведомления» (FIX3 Ф6). */
export type PushState = 'unknown' | 'ok' | 'denied' | 'ask' | 'nofirebase' | 'error' | 'unsupported';
export const usePushStatus = create<{ state: PushState; retry: () => void }>(() => ({ state: 'unknown', retry: () => undefined }));

/** Переключатели «Уведомлений» → таблица, которую читает сервер (раньше они жили только в настройках профиля). */
const PREF_COLUMN: Record<string, string> = { n_messages: 'messages', n_near: 'friend_near', n_remind: 'remind_2h', n_taste: 'interest_near', n_weekend: 'weekend' };
export async function savePushPref(key: string, value: boolean) {
  const column = PREF_COLUMN[key];
  const userId = useAuth.getState().session?.user.id;
  if (!column || !userId || config.dataMode === 'demo') return;
  await withTimeout(supabase().from('notification_prefs').upsert({ user_id: userId, [column]: value }, { onConflict: 'user_id' }));
}

/** Кнопка «Разрешить»: системный запрос, затем повторная регистрация. */
export async function askPushPermission() {
  const p = await Notifications.requestPermissionsAsync();
  usePushStatus.getState().retry();
  return p.granted;
}
export async function unregisterDevicePush() {
  if (!registeredToken) return;
  const token = registeredToken; registeredToken = null;
  await withTimeout(supabase().from('push_tokens').delete().eq('token', token), 2000);
}

export async function preparePushChannel() {
  if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('messages', {
    name: 'Сообщения и приглашения', importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 150], lightColor: '#F0521F', sound: 'default',
  });
}

export function usePushRegistration() {
  const userId = useAuth(s => s.session?.user.id);
  useEffect(() => {
    if (!userId || config.dataMode === 'demo' || Platform.OS === 'web' || !Device.isDevice) { usePushStatus.setState({ state: 'unsupported' }); return; }
    let cancelled = false;
    let busy = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const save = async () => {
      if (busy || cancelled) return;
      busy = true;
      try {
        clearTimeout(retry);
        await preparePushChannel();
        let perm = await Notifications.getPermissionsAsync();
        // Android 13+: разрешение спрашиваем сами один раз за запуск, если его ещё не давали и не запрещали.
        if (!perm.granted && perm.canAskAgain && !askedThisRun) { askedThisRun = true; perm = await Notifications.requestPermissionsAsync(); }
        if (!perm.granted) { usePushStatus.setState({ state: perm.canAskAgain ? 'ask' : 'denied' }); return; }
        const projectId = Constants.easConfig?.projectId ?? Constants.expoConfig?.extra?.eas?.projectId;
        if (!projectId) { console.warn('[push] Не указан projectId EAS'); return; }
        const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
        if (cancelled) return;
        const { error } = await supabase().from('push_tokens').upsert({ token, user_id: userId, platform: Platform.OS, updated_at: new Date().toISOString() }, { onConflict: 'token' });
        if (error) throw error;
        registeredToken = token;
        usePushStatus.setState({ state: 'ok' });
      } catch (err) {
        const text = String((err as Error)?.message ?? err);
        // Без google-services.json в сборке Android не выдаёт токен (docs/KEYS.md, «Пуши на Android»).
        usePushStatus.setState({ state: /firebase|FCM|google-services/i.test(text) ? 'nofirebase' : 'error' });
        console.warn('[push] Не удалось зарегистрировать уведомления; повтор при возвращении в приложение');
        if (!cancelled) retry = setTimeout(() => void save(), 60000);
      }
      finally { busy = false; }
    };
    usePushStatus.setState({ retry: () => void save() });
    void save();
    const app = AppState.addEventListener('change', s => { if (s === 'active') void save(); });
    const token = Notifications.addPushTokenListener(() => void save());
    return () => { cancelled = true; clearTimeout(retry); app.remove(); token.remove(); };
  }, [userId]);
}
