import type { EventItem } from '../data/types';

export function occurrenceTitle(title: string): string {
  return title.toLowerCase().replace(/ё/g, 'е')
    .replace(/\([^)]*(?:\d{1,2}:\d{2}|\d{1,2}\s+(?:январ|феврал|март|апрел|мая|июн|июл|август|сентябр|октябр|ноябр|декабр))[^)]*\)/g, '')
    .replace(/(?:^|\s)(?:турнир|теннис)(?=\s|$)/gu, '')
    .replace(/[«»“”"':;,–—-]/g, ' ').replace(/\s+/g, ' ').replace(/atp\s+(\d)/g, 'atp$1').trim();
}

export function occurrenceKey(e: EventItem): string {
  return `${e.category}|${occurrenceTitle(e.title)}|${e.category === 'movie' ? '' : e.venueId ?? (e.venueName ?? e.address).toLowerCase().trim()}`;
}

export function occurrencesOf(e: EventItem, events: EventItem[], now: Date): EventItem[] {
  const title = occurrenceTitle(e.title);
  const belongs = (x: EventItem) => {
    if (e.visibility !== 'public' || x.visibility !== 'public' || e.meetup || x.meetup || e.category !== x.category || occurrenceTitle(x.title) !== title) return false;
    const close = !e.noPoint && !x.noPoint && !e.needsPin && !x.needsPin && Number.isFinite(e.lat) && Number.isFinite(e.lon) && Number.isFinite(x.lat) && Number.isFinite(x.lon) && Math.hypot((x.lat - e.lat) * 111320, (x.lon - e.lon) * 81500) < 80;
    return e.category === 'movie' || occurrenceKey(x) === occurrenceKey(e) || close;
  };
  const unique = new Map<string, EventItem>();
  [e, ...events].forEach(x => {
    if (x.id === e.id || belongs(x) && !x.isLong && (!x.status || x.status === 'published') && Date.parse(x.startsAt) > now.getTime()) unique.set(x.id, x);
  });
  return [...unique.values()].sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
}
