// Пуш «за час до события» (ALPHA А3): локальные напоминания на телефоне по планам «Иду».
// Пересобираются при каждом изменении планов: отменили «Иду» — напоминание пропадает.
import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import type { EventItem } from '../data/types';
import { almaty } from '../lib/clock';

const KIND = 'event-hour';
const hm = (iso: string) => { const d = almaty(iso); return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`; };

export async function syncReminders(events: EventItem[]): Promise<void> {
  if (Platform.OS === 'web') return;
  const perm = await Notifications.getPermissionsAsync();
  if (!perm.granted) return;
  const all = await Notifications.getAllScheduledNotificationsAsync();
  const want = new Map(events.map((e) => [e.id, e]));
  // Убираем лишние и устаревшие.
  for (const n of all) {
    const d = n.content.data as { kind?: string; eventId?: string; at?: string } | undefined;
    if (d?.kind !== KIND) continue;
    const e = d.eventId ? want.get(d.eventId) : undefined;
    if (!e || e.startsAt !== d.at) await Notifications.cancelScheduledNotificationAsync(n.identifier);
    else want.delete(e.id);
  }
  for (const e of want.values()) {
    const at = new Date(e.startsAt).getTime() - 3600e3;
    if (at < Date.now() + 60e3) continue;
    await Notifications.scheduleNotificationAsync({
      content: { title: `Через час: ${e.title}`, body: `${e.venueName ?? e.address.split(',')[0]} · ${hm(e.startsAt)}`, data: { kind: KIND, eventId: e.id, at: e.startsAt, url: `/event/${e.id}` } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(at) },
    });
  }
}

export function useReminders(events: EventItem[]) {
  const key = events.map((e) => `${e.id}@${e.startsAt}`).sort().join('|');
  useEffect(() => { void syncReminders(events).catch(() => undefined); }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
}

// Показывать уведомления и когда приложение открыто; тап по пушу — открыть нужный экран (data.url).
if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
}

function useTapsNative(open: (url: string) => void) {
  const last = Notifications.useLastNotificationResponse();
  useEffect(() => {
    const url = (last?.notification.request.content.data as { url?: string } | undefined)?.url;
    if (url) open(url);
  }, [last]); // eslint-disable-line react-hooks/exhaustive-deps
}
/** На web пушей нет — хук ничего не делает (выбор при загрузке модуля, а не в рендере). */
export const useNotificationTaps: (open: (url: string) => void) => void = Platform.OS === 'web' ? () => undefined : useTapsNative;
