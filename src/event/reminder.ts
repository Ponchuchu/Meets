import type { EventItem } from '../data/types';

export function eventReminder(e: EventItem, now: number): { at: number; lead: number; title: string; ticket: boolean } | null {
  if (e.status && e.status !== 'published') return null;
  const ticket = e.category === 'movie';
  const lead = (ticket ? 3 : 1) * 3600e3;
  const at = Date.parse(e.startsAt) - lead;
  if (!Number.isFinite(at) || at < now + 60e3) return null;
  return { at, lead, title: `${ticket ? 'Через 3 часа' : 'Через час'}: ${e.title}`, ticket };
}
