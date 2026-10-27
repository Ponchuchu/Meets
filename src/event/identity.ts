import type { EventItem } from '../data/types';
const norm = (s: string) => s.toLowerCase().replace(/ё/g, 'е').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
/** Only exact event + venue + instant matches. A shared poster never identifies an event. */
export function eventIdentity(e: EventItem): string {
  const venue = e.venueId || norm(e.venueName || e.address);
  const at = Date.parse(e.startsAt);
  return !e.meetup && venue && Number.isFinite(at) ? `${norm(e.title)}|${venue}|${at}` : e.id;
}
export function distinctEvents(events: EventItem[]): EventItem[] {
  const seen = new Set<string>();
  return events.filter(e => { const key = eventIdentity(e); if (seen.has(key)) return false; seen.add(key); return true; });
}
