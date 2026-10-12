import type { EventItem } from '../data/types';
/** Одна карточка для дат на одной странице источника; без источника ничего не склеиваем. */
export function groupEventDates(events: EventItem[]): EventItem[] {
  const groups = new Map<string, EventItem[]>();
  for (const e of events) {
    let source = '';
    try { const u = new URL(e.sourceUrl ?? ''); for (const key of [...u.searchParams.keys()]) if (/^utm_|^(ref|fbclid|gclid)$/i.test(key)) u.searchParams.delete(key); if (/^https?:$/.test(u.protocol) && u.pathname !== '/') source = `${u.host}${u.pathname}${u.search}`; } catch { /* нет надёжного источника */ }
    const key = source && !e.meetup ? [source, e.title.trim().toLowerCase(), e.venueName?.trim().toLowerCase() ?? e.address.trim().toLowerCase(), e.category, e.priceMin, e.priceMax].join('|') : e.id;
    const group = groups.get(key) ?? [];
    if (!group.some(x => x.id === e.id)) group.push(e);
    groups.set(key, group);
  }
  return [...groups.values()].flatMap(group => {
    group.sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
    // Не объединяем сезоны и разные месяцы на одной странице.
    if (group.length < 2 || Date.parse(group.at(-1)!.startsAt) - Date.parse(group[0].startsAt) > 7 * 86400000) return group;
    const first = group[0], last = group.at(-1)!;
    return [{ ...first, isLong: true, endsAt: last.endsAt ?? last.startsAt, sessions: group.map(e => ({ id: e.id, startsAt: e.startsAt, endsAt: e.endsAt })) }];
  });
}
