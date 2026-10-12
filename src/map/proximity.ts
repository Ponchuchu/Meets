import type { FriendSpot } from '../data/types';
import { distM } from '../live/geo';
/** Только свежие разрешённые точки; близость — не подтверждённая встреча. */
export function closeGroups(spots: FriendSpot[], radius = 60): FriendSpot[][] {
  const groups: FriendSpot[][] = [];
  for (const spot of spots) {
    const fresh = (spot.minutesAgo ?? 0) <= 5 && spot.state !== 'paused';
    const group = fresh ? groups.find(g => g.every(s => (s.minutesAgo ?? 0) <= 5 && s.state !== 'paused' && distM(s, spot) <= radius)) : undefined;
    if (group) group.push(spot); else groups.push([spot]);
  }
  return groups;
}
