// Постоянные места: сезон, подписи и ссылки без выдуманных часов работы.
import { ATTRACTIONS, commons, inSeason, seasonText } from '../data/attractions';
import { openStatus, weekLines } from '../data/hours';

const get = (id: string) => ATTRACTIONS.find(a => a.id === id)!;
const at = (iso: string) => new Date(iso);

it('горнолыжка: сезон через Новый год (ноябрь — апрель)', () => {
  expect(inSeason(get('shymbulak'), at('2027-01-15T10:00:00+05:00'))).toBe(true);
  expect(inSeason(get('shymbulak'), at('2026-10-21T10:00:00+05:00'))).toBe(false);
  expect(seasonText(get('shymbulak'), at('2026-10-21T10:00:00+05:00'))).toBe('откроется в ноябре');
  expect(seasonText(get('shymbulak'), at('2027-01-15T10:00:00+05:00'))).toBe('сезон до апреля');
});
it('без сезона — круглый год', () => {
  expect(seasonText(get('family-bowling'))).toBe('круглый год');
});
it('у каждого места точка в Алматы и окрестностях, уникальный id, фотозоны бесплатные', () => {
  expect(new Set(ATTRACTIONS.map(a => a.id)).size).toBe(ATTRACTIONS.length);
  for (const a of ATTRACTIONS) {
    expect(a.lat).toBeGreaterThan(43.05); expect(a.lat).toBeLessThan(43.45);
    expect(a.lon).toBeGreaterThan(76.7); expect(a.lon).toBeLessThan(77.25);
    if (a.kind === 'photo') expect(a.free).toBe(true);
    if (a.buy) expect(a.buy.startsWith('https://')).toBe(true);
  }
});
it('фото с Викисклада и Терренкур — всегда открыт', () => {
  expect(commons('Medeu- 4.jpg')).toBe('https://commons.wikimedia.org/wiki/Special:FilePath/Medeu-%204.jpg?width=1200');
  for (const id of ['terrenkur', 'koktobe', 'medeu', 'shymbulak']) expect(get(id).photos?.length).toBeGreaterThan(0);
  const t = get('terrenkur');
  expect(openStatus(t.hours, new Date('2026-10-21T22:00:00Z')).text).toBe('Открыто круглосуточно');
  expect(weekLines(t.hours)).toEqual([{ days: 'Каждый день', time: 'круглосуточно' }]);
  expect(t.free).toBe(true);
});
