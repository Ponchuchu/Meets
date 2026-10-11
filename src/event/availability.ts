import type { EventItem } from '../data/types';

export function eventStatusLabel(e: Pick<EventItem, 'status'>): string | null {
  if (e.status === 'cancelled') return 'Событие отменено';
  if (e.status === 'archived') return 'Событие удалено из афиши';
  if (e.status === 'draft') return 'Событие снято с карты';
  return null;
}
