// Постоянные места: сезон, подписи и ссылки без выдуманных часов работы.
import { ATTRACTIONS, gisUrl, inSeason, seasonText } from '../data/attractions';

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
it('часы и цены — карточка 2ГИС по названию и точке', () => {
  expect(gisUrl(get('medeu'))).toBe('https://2gis.kz/almaty/search/%D0%9C%D0%B5%D0%B4%D0%B5%D1%83/geo/77.05856,43.15755');
});
