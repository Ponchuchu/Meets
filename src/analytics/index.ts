// Аналитика: события без текста и координат. Копия — на устройстве (для админки в демо), в базу — после входа.
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { requireUser, supabase } from '../data/client';
import { uid } from '../lib/uid';
import { deviceStorage } from '../state/storage';
import type { AnalyticsEvent, AnalyticsName } from './metrics';

const KEEP = 3000;

interface AnalyticsState {
  deviceId: string;
  events: AnalyticsEvent[];
}

export const useAnalytics = create<AnalyticsState>()(
  persist(() => ({ deviceId: uid('dev'), events: [] as AnalyticsEvent[] }), { name: 'ryadom-analytics', storage: deviceStorage() }),
);

export function track(name: AnalyticsName, eventId?: string) {
  const at = new Date().toISOString();
  useAnalytics.setState((s) => ({ events: [...s.events, { name, at, eventId }].slice(-KEEP) }));
  const deviceId = useAnalytics.getState().deviceId;
  void requireUser()
    .then((me) => supabase().from('analytics_events').insert({ user_id: me, device_id: deviceId, name, event_id: eventId ?? null, at }))
    .catch(() => undefined);
}

/** События всех людей — для команды (RLS: staff). */
export async function loadAnalytics(days = 30): Promise<AnalyticsEvent[]> {
  const since = new Date(Date.now() - days * 86400e3).toISOString();
  const { data, error } = await supabase().from('analytics_events').select('name,event_id,at,user_id').gte('at', since).limit(50000);
  if (error) throw error;
  return (data as { name: AnalyticsName; event_id: string | null; at: string; user_id: string }[]).map((r) => ({ name: r.name, at: r.at, eventId: r.event_id ?? undefined, who: r.user_id }));
}
