// Места в ленте: не чаще раза в неделю, «мимо» — на 4 недели, вне сезона — нет, вставка в колоду.
import { ATTRACTIONS } from '../data/attractions';
import { pickSpots, spotCard, weekOf, withSpots } from '../reco/spots';
jest.mock('lucide-react-native', () => new Proxy({}, { get: (_t, name) => ({ icon: String(name) }) }));

const taste = { tags: { прогулка: 1, 'можно одному': 0.5 }, timeGrid: [], friendsMultiplier: 1, priceCeiling: null } as never;
const now = new Date('2026-10-21T12:00:00+05:00');

it('выбирает до двух мест в сезоне и по вкусу', () => {
  const list = pickSpots(ATTRACTIONS, taste, { seen: {}, skipped: {} }, now);
  expect(list).toHaveLength(2);
  expect(list.every((a) => !a.parent)).toBe(true);
  expect(list.some((a) => a.id === 'shymbulak')).toBe(false); // октябрь — горнолыжка ещё закрыта
});
it('показанное на этой неделе и пропущенное — не повторяет', () => {
  const first = pickSpots(ATTRACTIONS, taste, { seen: {}, skipped: {} }, now);
  const again = pickSpots(ATTRACTIONS, taste, { seen: Object.fromEntries(first.map((a) => [a.id, weekOf(now)])), skipped: {} }, now);
  expect(again.some((a) => first.includes(a))).toBe(false);
  const skipped = pickSpots(ATTRACTIONS, taste, { seen: {}, skipped: { [first[0].id]: weekOf(now) - 2 } }, now);
  expect(skipped.includes(first[0])).toBe(false);
});
it('карточка места и вставка в колоду', () => {
  const c = spotCard(ATTRACTIONS.find((a) => a.id === 'koktobe')!, now);
  expect(c).toMatchObject({ id: 'spot:koktobe', spotId: 'koktobe', title: 'Кок-Тобе' });
  const deck = Array.from({ length: 10 }, (_, i) => ({ id: `e${i}` })) as never[];
  const out = withSpots(deck, [c, { ...c, id: 'spot:x' }]);
  expect(out[3].id).toBe('spot:koktobe');
  expect(out[8].id).toBe('spot:x');
  expect(withSpots(deck.slice(0, 2), [c]).at(-1)!.id).toBe('spot:koktobe');
});
