import { findDuplicate } from '../src/dedupe.ts';
import { externalId, sameEvent, type Found } from '../src/search.ts';

const film = { title: 'Фильм', category: 'movie', starts_at: '2026-10-12T18:00:00+05:00', ends_at: '2026-10-12T20:00:00+05:00', venue_name: 'Chaplin', url: 'https://chaplin.kz/movie/example' } satisfies Found;
it('сеансы одного фильма в разные часы не склеиваются ни в поиске, ни при сохранении', () => {
  const second = { ...film, starts_at: '2026-10-12T18:30:00+05:00' };
  expect(sameEvent(film, second)).toBe(false);
  expect(externalId(film)).not.toBe(externalId(second));
  expect(findDuplicate(second, [{ ...film, id: 'already' }])).toBeNull();
});
it('тот же сеанс с другой записью часового пояса остаётся дублем', () => {
  const same = { ...film, starts_at: '2026-10-12T13:00:00Z' };
  expect(sameEvent(film, same)).toBe(true);
  expect(externalId(film)).toBe(externalId(same));
  expect(findDuplicate(same, [{ ...film, id: 'already' }])?.id).toBe('already');
});
