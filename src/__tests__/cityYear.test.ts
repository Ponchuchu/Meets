// «Год в Алматы»: статус и подпись большого события по дате (ориентир — 2026, даты 2027 ещё не объявлены).
import { CITY_YEAR, cityState, cityYear, leftText } from '../data/cityYear';
jest.mock('lucide-react-native', () => new Proxy({}, { get: (_t, name) => ({ icon: String(name) }) }));

const at = (iso: string) => new Date(iso);
const get = (id: string) => CITY_YEAR.find(e => e.id === id)!;

it('День Республики 21 октября — «скоро», через 4 дня, точный день', () => {
  const s = cityState(get('republic-day'), at('2026-10-21T12:00:00+05:00'));
  expect(s.status).toBe('soon');
  expect(leftText(s)).toBe('через 4 дня');
  expect(s.when).toBe('25 октября');
});
it('в сам день — «идёт сейчас»', () => {
  expect(cityState(get('republic-day'), at('2026-10-25T20:00:00+05:00')).status).toBe('now');
});
it('прошедшее в этом году ждём в следующем и честно пишем, что дат нет', () => {
  const s = cityState(get('winter-run'), at('2026-10-21T12:00:00+05:00'));
  expect(s.status).toBe('next');
  expect(s.when).toBe('февраль 2027 · даты ещё не объявлены');
});
it('без точного дня — только месяц и «точная дата позже»', () => {
  expect(cityState(get('winter-run'), at('2026-01-10T12:00:00+05:00')).when).toBe('февраль · точная дата позже');
});
it('порядок: сейчас и скоро — сверху, прошедшее — внизу', () => {
  const list = cityYear(at('2026-10-21T12:00:00+05:00'));
  expect(list[0].e.id).toBe('republic-day');
  expect(list.at(-1)!.status).toBe('next');
});
it('у каждого события своя иконка и цвет, точка — только где место известно', () => {
  expect(new Set(CITY_YEAR.map(e => e.Icon)).size).toBe(CITY_YEAR.length);
  for (const e of CITY_YEAR) if (e.point) expect(Math.abs(e.point.lat - 43.2)).toBeLessThan(0.2);
});
