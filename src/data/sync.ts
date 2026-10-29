// Запись действий человека в базу: сигналы вкуса (для колоды на сервере) и планы (attendance).
// Только для событий из базы и только после входа; иначе — тихо ничего. Локальное состояние остаётся главным.
import { SIGNAL_WEIGHT, type Signal, type SignalKind } from '../reco';
import { requireUser, supabase } from './client';

/** Внешний id события (как в приложении: «seed-001») → uuid строки в базе. Заполняет fetchRealEvents. */
const dbIds = new Map<string, string>();
// A quick undo must reach the server after the write it reverses, even when
// authentication or the first network request is slower than the second.
const pending = new Map<string, Promise<void>>();
function enqueue(key: string, action: () => PromiseLike<unknown>) {
  const previous = pending.get(key) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(async () => { await action(); }).catch(() => undefined);
  pending.set(key, next);
  void next.then(() => { if (pending.get(key) === next) pending.delete(key); });
}
export function rememberDbIds(rows: { id: string; external_id: string | null }[]) {
  rows.forEach((r) => dbIds.set(r.external_id ?? r.id, r.id));
}

async function target(eventId: string): Promise<{ me: string; ev: string } | null> {
  // События из events_live (альфа) уже приходят с uuid — их пишем как есть.
  const ev = dbIds.get(eventId) ?? (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(eventId) ? eventId : undefined);
  if (!ev) return null;
  const me = await requireUser().catch(() => null);
  return me ? { me, ev } : null;
}

export function pushSignal(s: Signal) {
  const resolved = target(s.eventId);
  enqueue(`signal:${s.eventId}:${s.kind}`, async () => {
    const t = await resolved;
    if (t) await supabase().from('signals').insert({ user_id: t.me, event_id: t.ev, kind: s.kind, weight: SIGNAL_WEIGHT[s.kind] });
  });
}

/** «Вернуть» — сигнал удаляется целиком. */
export function dropSignal(eventId: string, kind: SignalKind) {
  const resolved = target(eventId);
  enqueue(`signal:${eventId}:${kind}`, async () => {
    const t = await resolved;
    if (t) await supabase().from('signals').delete().eq('user_id', t.me).eq('event_id', t.ev).eq('kind', kind);
  });
}

export type AttendanceStatus = 'going' | 'saved' | 'skipped' | 'arrived' | 'cancelled';

export function pushAttendance(eventId: string, status: AttendanceStatus | null) {
  const resolved = target(eventId);
  enqueue(`attendance:${eventId}`, async () => {
    const t = await resolved;
    if (!t) return;
    const q = supabase().from('attendance');
    await (status ? q.upsert({ user_id: t.me, event_id: t.ev, status, at: new Date().toISOString() }) : q.delete().eq('user_id', t.me).eq('event_id', t.ev));
  });
}
