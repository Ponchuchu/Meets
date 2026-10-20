// Ночёвки по хозяевам (FIX3 Ф10). Без интерфейса — покрыто тестами.
import type { Sleepover } from '../live/profileExtras';

/** По хозяевам: «у Игоря — 3 ночи», остальные — «не дома». */
export function groupSleepovers(list: Sleepover[]) {
  const map = new Map<string, { key: string; name: string | null; photo: string | null; nights: string[]; area: string | null }>();
  for (const s of list) {
    const key = s.host_id ?? `area:${s.area ?? '—'}`;
    const g = map.get(key) ?? { key, name: s.host_name, photo: s.host_photo, nights: [], area: s.area };
    g.nights.push(s.night);
    map.set(key, g);
  }
  return [...map.values()].sort((a, b) => b.nights.length - a.nights.length || b.nights[0].localeCompare(a.nights[0]));
}
