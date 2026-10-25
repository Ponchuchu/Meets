// Пуш «за час до события» (ALPHA А3): локальные напоминания на телефоне по планам «Иду».
// Пересобираются при каждом изменении планов: отменили «Иду» — напоминание пропадает.
import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import type { EventItem } from '../data/types';
import { eventReminder } from '../event/reminder';
import { almaty } from '../lib/clock';
import { queryClient } from './query';

const KIND = 'event-hour';
const hm = (iso: string) => { const d = almaty(iso); return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`; };

let queue: Promise<void> = Promise.resolve();
let revision = 0;
let asked = false;
export function syncReminders(events: EventItem[]): Promise<void> {
  const ticket = ++revision;
  queue = queue.catch(() => undefined).then(() => ticket === revision ? sync(events) : undefined);
  return queue;
}
async function sync(events: EventItem[]): Promise<void> {
  if (Platform.OS === 'web') return;
  if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('plans', { name: 'Планы и билеты', importance: Notifications.AndroidImportance.DEFAULT });
  let perm = await Notifications.getPermissionsAsync();
  if (!perm.granted && perm.canAskAgain && !asked && events.some(e => eventReminder(e, Date.now()))) { asked = true; perm = await Notifications.requestPermissionsAsync(); }
  if (!perm.granted) return;
  const all = await Notifications.getAllScheduledNotificationsAsync();
  // Не больше 40 ближайших: Android держит ограниченное число будильников на приложение (около 500 у Samsung и Xiaomi),
  // а при сотне планов пересборка всех напоминаний разом подвешивала и роняла приложение (FIX5).
  const want = new Map(events.filter(e => eventReminder(e, Date.now())).sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt)).slice(0, 40).map((e) => [e.id, e]));
  // Убираем лишние и устаревшие.
  for (const n of all) {
    const d = n.content.data as { kind?: string; eventId?: string; at?: string; lead?: number } | undefined;
    if (d?.kind !== KIND) continue;
    const e = d.eventId ? want.get(d.eventId) : undefined;
    if (!e || e.startsAt !== d.at || (d.lead ?? 3600e3) !== eventReminder(e, Date.now())?.lead) await Notifications.cancelScheduledNotificationAsync(n.identifier);
    else want.delete(e.id);
  }
  for (const e of want.values()) {
    const reminder = eventReminder(e, Date.now());
    if (!reminder) continue;
    const at = reminder.at;
    if (at < Date.now() + 60e3) continue;
    await Notifications.scheduleNotificationAsync({
      content: { title: reminder.title, body: `${reminder.ticket ? 'Не забудь купить билеты · ' : ''}${e.venueName ?? e.address.split(',')[0]} · ${hm(e.startsAt)}`, data: { kind: KIND, eventId: e.id, at: e.startsAt, lead: reminder.lead, url: `/event/${e.id}` } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(at), channelId: 'plans' },
    });
  }
}

export function useReminders(events: EventItem[]) {
  const key = events.map((e) => `${e.id}@${e.startsAt}@${e.category}@${e.status}`).sort().join('|');
  useEffect(() => { void syncReminders(events).catch(() => undefined); }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
}

/** Какой чат сейчас на экране — чтобы не показывать пуш о нём поверх самого чата. */
let openChatId: string | null = null;
export const setOpenChat = (id: string | null) => { openChatId = id; };

// Показывать уведомления и когда приложение открыто; тап по пушу — открыть нужный экран (data.url).
if (Platform.OS !== 'web') {
  // Пуш о сообщении — это ещё и сигнал «в чате новое»: сразу перечитываем чат и список, даже если сокет
  // Realtime ещё не переподключился после фона. Если этот чат уже открыт — баннер не показываем.
  Notifications.setNotificationHandler({
    handleNotification: async (n) => {
      const url = (n.request.content.data as { url?: string } | undefined)?.url;
      const chatId = url?.startsWith('/chat/') ? url.slice(6) : null;
      if (chatId) {
        void queryClient.invalidateQueries({ queryKey: ['messages', chatId] });
        void queryClient.invalidateQueries({ queryKey: ['chats'] });
      }
      const here = !!chatId && openChatId === chatId;
      return { shouldShowBanner: !here, shouldShowList: !here, shouldPlaySound: !here, shouldSetBadge: false };
    },
  });
}

/** Уже открытые нажатия: одно уведомление открывается ровно один раз, даже если экран с хуком смонтировался заново.
 *  Раньше пуш «Модерация» вёл на несуществующий /admin → переход домой → хук снова открывал тот же пуш — по кругу,
 *  пока приложение не падало («Maximum update depth»). */
const handled = new Set<string>();
/** Старые адреса из уведомлений → настоящие экраны. */
export function pushPath(url: string): string {
  if (url === '/admin' || url.startsWith('/admin?') || url.startsWith('/admin/')) return '/dev?tab=events';
  return url;
}

function useTapsNative(open: (url: string) => void) {
  const last = Notifications.useLastNotificationResponse();
  useEffect(() => {
    if (!last) return;
    const id = `${last.notification.request.identifier}:${last.notification.date}:${last.actionIdentifier}`;
    if (handled.has(id)) return;
    handled.add(id);
    const url = (last.notification.request.content.data as { url?: string } | undefined)?.url;
    if (url) open(pushPath(url));
  }, [last]); // eslint-disable-line react-hooks/exhaustive-deps
}
/** На web пушей нет — хук ничего не делает (выбор при загрузке модуля, а не в рендере). */
export const useNotificationTaps: (open: (url: string) => void) => void = Platform.OS === 'web' ? () => undefined : useTapsNative;
