// Пуш-токен устройства → таблица push_tokens. Сами пуши шлёт сервер (Edge Function notify) по правилам из rules.ts.
// Нужны dev build (EAS), projectId и ключи FCM/APNs — см. docs/KEYS.md. В web и демо ничего не делает.
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { requireUser, supabase } from '../data/client';

export async function registerPush(): Promise<string | null> {
  if (Platform.OS === 'web' || !Device.isDevice) return null;
  const projectId = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId;
  if (!projectId) return null;
  try {
    const me = await requireUser();
    const current = await Notifications.getPermissionsAsync();
    const granted = current.granted || (await Notifications.requestPermissionsAsync()).granted;
    if (!granted) return null;
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', { name: 'Рядом', importance: Notifications.AndroidImportance.DEFAULT });
    }
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await supabase().from('push_tokens').upsert({ token, user_id: me, platform: Platform.OS, updated_at: new Date().toISOString() });
    return token;
  } catch {
    return null;
  }
}

/** Настройки уведомлений из «Настроек» → notification_prefs (сервер читает их перед отправкой). */
export async function savePushPrefs(p: { friendNear: boolean; interestNear: boolean; remind2h: boolean; messages: boolean; weekend: boolean }): Promise<void> {
  const me = await requireUser().catch(() => null);
  if (!me) return;
  await supabase().from('notification_prefs').upsert({
    user_id: me, friend_near: p.friendNear, interest_near: p.interestNear, remind_2h: p.remind2h, messages: p.messages, weekend: p.weekend,
  });
}
