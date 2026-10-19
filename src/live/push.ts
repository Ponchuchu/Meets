// Токен устройства сохраняется после входа и обновляется при возвращении из настроек.
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import { supabase, withTimeout } from '../data/client';
import { config } from '../lib/config';
import { useAuth } from './auth';

let registeredToken: string | null = null;
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
    if (!userId || config.dataMode === 'demo' || Platform.OS === 'web' || !Device.isDevice) return;
    let cancelled = false;
    let busy = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const save = async () => {
      if (busy || cancelled) return;
      busy = true;
      try {
        clearTimeout(retry);
        await preparePushChannel();
        if (!(await Notifications.getPermissionsAsync()).granted) return;
        const projectId = Constants.easConfig?.projectId ?? Constants.expoConfig?.extra?.eas?.projectId;
        if (!projectId) { console.warn('[push] Не указан projectId EAS'); return; }
        const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
        if (cancelled) return;
        const { error } = await supabase().from('push_tokens').upsert({ token, user_id: userId, platform: Platform.OS, updated_at: new Date().toISOString() }, { onConflict: 'token' });
        if (error) throw error;
        registeredToken = token;
      } catch {
        console.warn('[push] Не удалось зарегистрировать уведомления; повтор при возвращении в приложение');
        if (!cancelled) retry = setTimeout(() => void save(), 60000);
      }
      finally { busy = false; }
    };
    void save();
    const app = AppState.addEventListener('change', s => { if (s === 'active') void save(); });
    const token = Notifications.addPushTokenListener(() => void save());
    return () => { cancelled = true; clearTimeout(retry); app.remove(); token.remove(); };
  }, [userId]);
}
