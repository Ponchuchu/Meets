import { editorialText } from '../event/editorial';
import { distinctEvents } from '../event/identity';
import type { EventItem } from '../data/types';
const e = { id: 'a', title: 'Руслан Тай', venueName: 'Central', address: 'Кабанбай батыра, 71', startsAt: '2026-11-01T21:30:00+05:00', about: 'Руслан Тай\n1 ноября, 21:30\n\nЖивой концерт с импровизацией.\n\n18+\nБилеты от 5000 тенге' } as EventItem;
it('removes standalone duplicated facts but keeps narrative and age restriction', () => {
  expect(editorialText(e)).toBe('Живой концерт с импровизацией.\n\n18+');
});
it('deduplicates same event across sources without collapsing distinct shows with one poster', () => {
  const copy = { ...e, id: 'b', sourceUrl: 'https://other.com/event', cover: 'same' };
  const next = { ...copy, id: 'c', startsAt: '2026-11-02T21:30:00+05:00' };
  expect(distinctEvents([e, copy, next]).map(x => x.id)).toEqual(['a', 'c']);
});
