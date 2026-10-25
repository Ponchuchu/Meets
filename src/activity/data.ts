// Откуда берётся лента уведомлений: функция my_activity() (миграция 42). Пока её нет на сервере — заявки в друзья
// и приглашения, которые приложение и так читает. В демо — пример на все виды строк.
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase, withTimeout } from '../data/client';
import { config } from '../lib/config';
import { getInvites, me } from '../live/api';
import { deviceStorage } from '../state/storage';
import { toItem, type ActivityItem, type ActivityRow } from './model';

/** Когда последний раз открывали ленту — всё, что новее, считается новым (число на колокольчике). */
export const useActivitySeen = create<{ seenAt: number; seen: (t?: number) => void }>()(persist(
  (set) => ({ seenAt: 0, seen: (t = Date.now()) => set({ seenAt: t }) }),
  { name: 'ryadom-activity-seen', storage: deviceStorage() },
));

const ago = (min: number) => new Date(Date.now() - min * 60000).toISOString();
function demoRows(): ActivityRow[] {
  const p = (id: string, name: string, photo: string) => ({ person_id: id, person_name: name, person_photo: photo });
  const none = { person_id: null, person_name: null, person_photo: null, event_id: null, event_title: null, detail: null };
  return [
    { ...none, ...p('ainura', 'Айнура', 'ainura'), kind: 'friend_request', at: ago(4), detail: 'Были вместе на стендапе' },
    { ...none, ...p('igor', 'Игорь', 'igor'), kind: 'push_sticker', at: ago(18) },
    { ...none, ...p('denis', 'Денис', 'denis'), kind: 'invite', at: ago(65), event_id: 'jazz', event_title: 'Джаз во дворе' },
    { ...none, kind: 'push_reminder', at: ago(150), event_id: 'games', event_title: 'Настолки без своей компании' },
    { ...none, kind: 'login_failed', at: ago(40), detail: 'Mozilla/5.0 (Windows NT 10.0) Chrome/120' },
    { ...none, kind: 'login', at: ago(60 * 20), detail: 'okhttp/4.12.0' },
    { ...none, ...p('anton', 'Антон', 'anton'), kind: 'invite_answer', at: ago(60 * 26), event_id: 'anime', event_title: 'Аниме-выставка «Токио в Алматы»', detail: 'yes' },
    { ...none, kind: 'push_dailyFeed', at: ago(60 * 30) },
    { ...none, ...p('timur', 'Тимур', 'krug'), kind: 'friend_added', at: ago(60 * 24 * 3) },
    { ...none, kind: 'login', at: ago(60 * 24 * 9), detail: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)' },
  ];
}

export async function getActivity(): Promise<ActivityItem[]> {
  if (config.dataMode === 'demo') return demoRows().map(toItem);
  const { data, error } = await withTimeout(supabase().rpc('my_activity'));
  if (!error) return ((data ?? []) as ActivityRow[]).map(toItem);
  if (!/my_activity|function/i.test(error.message)) throw error;
  // Сервер ещё без функции: то, что можно прочитать и так.
  const id = me();
  const [reqs, invites] = await Promise.all([
    withTimeout(supabase().from('friend_requests').select('from_id,note,created_at,profiles!friend_requests_from_id_fkey(name,photo_url)').eq('to_id', id).eq('status', 'pending')),
    getInvites().catch(() => []),
  ]);
  type Req = { from_id: string; note: string | null; created_at: string; profiles: { name: string; photo_url: string | null } | null };
  const rows: ActivityRow[] = [
    ...((reqs.data ?? []) as unknown as Req[]).map((r) => ({ kind: 'friend_request', at: r.created_at, person_id: r.from_id, person_name: r.profiles?.name ?? 'Кто-то', person_photo: r.profiles?.photo_url ?? null, event_id: null, event_title: null, detail: r.note })),
    ...invites.map((i) => ({ kind: i.to_id === id ? 'invite' : 'invite_answer', at: i.created_at, person_id: i.to_id === id ? i.from_id : i.to_id, person_name: null, person_photo: null, event_id: i.event_id, event_title: null, detail: i.answer }))
      .filter((r) => r.kind === 'invite' || r.detail),
  ];
  return rows.map(toItem);
}
