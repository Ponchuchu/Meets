// Планы человека с сервера (FIX1 И2 п.10): «Иду» — только мои строки attendance (user_id = я).
// Локально остаются только свои встречи; при смене аккаунта на телефоне всё чужое стирается.
export interface ServerPlan { event_id: string; status: string; at: string }
export interface LocalPlans { owner: string | null; going: Record<string, string>; saved: Record<string, true>; meetupIds: string[] }

export function mergeServerPlans(local: LocalPlans, rows: ServerPlan[], me: string): { owner: string; going: Record<string, string>; saved: Record<string, true> } {
  const same = local.owner === me;
  const going: Record<string, string> = {};
  if (same) for (const id of local.meetupIds) if (local.going[id]) going[id] = local.going[id];
  const saved: Record<string, true> = {};
  for (const r of rows) {
    if (r.status === 'going' || r.status === 'arrived') going[r.event_id] = r.at;
    if (r.status === 'saved') saved[r.event_id] = true;
  }
  return { owner: me, going, saved };
}
