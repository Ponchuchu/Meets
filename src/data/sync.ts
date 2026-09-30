// Запись действий человека в базу: сигналы вкуса (для колоды на сервере) и планы (attendance).
// Только для событий из базы и только после входа; иначе — тихо ничего. Локальное состояние остаётся главным.
import { SIGNAL_WEIGHT, type Signal, type SignalKind } from '../reco';
import { requireUser, supabase } from './client';

/** Внешний id события (как в приложении: «seed-001») → uuid строки в базе. Заполняет fetchRealEvents. */
const dbIds = new Map<string, string>();
export function rememberDbIds(rows: { id: string; external_id: string | null }[]) {
  rows.forEach((r) => dbIds.set(r.external_id ?? r.id, r.id));
}

async function target(eventId: string): Promise<{ me: string; ev: string } | null> {
  const ev = dbIds.get(eventId);
  if (!ev) return null;
  const me = await requireUser().catch(() => null);
  return me ? { me, ev } : null;
}

export function pushSignal(s: Signal) {
  void target(s.eventId).then((t) => t && supabase().from('signals').insert({ user_id: t.me, event_id: t.ev, kind: s.kind, weight: SIGNAL_WEIGHT[s.kind] }));
}

/** «Вернуть» — сигнал удаляется целиком. */
export function dropSignal(eventId: string, kind: SignalKind) {
  void target(eventId).then((t) => t && supabase().from('signals').delete().eq('user_id', t.me).eq('event_id', t.ev).eq('kind', kind));
}

export type AttendanceStatus = 'going' | 'saved' | 'skipped' | 'arrived' | 'cancelled';

export function pushAttendance(eventId: string, status: AttendanceStatus | null) {
  void target(eventId).then((t) => {
    if (!t) return;
    const q = supabase().from('attendance');
    return status ? q.upsert({ user_id: t.me, event_id: t.ev, status, at: new Date().toISOString() }) : q.delete().eq('user_id', t.me).eq('event_id', t.ev);
  });
}
