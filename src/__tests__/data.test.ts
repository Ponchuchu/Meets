import { createDemoSource, demoEvents, mergeEvents } from '../data/demo';
import { isLongEvent, mapSeedEvent, seedEvents, ALMATY_CENTER } from '../data/seed';
import { mapFeedRow } from '../data/supabase';
import { formatPrice, formatWhen } from '../lib/format';


describe('демо-данные', () => {
  it('содержат все события макета', () => {
    const ids = demoEvents().map((e) => e.id);
    expect(ids).toEqual(expect.arrayContaining(['jazz', 'standup', 'anime', 'hike', 'games', 'concert', 'food', 'bike']));
  });

  it('джаз всегда сегодня в 19:30, и Игорь с Денисом идут', () => {
    const base = new Date('2026-09-28T07:00:00Z'); // 12:00 в Алматы
    const jazz = demoEvents(base).find((e) => e.id === 'jazz')!;
    expect(jazz.startsAt).toBe('2026-09-28T14:30:00.000Z'); // 19:30 в Алматы
    expect(jazz.friendsGoing).toEqual(['igor', 'denis']);
  });

  it('друзья и не друзья разделены как в макете', async () => {
    const people = await createDemoSource().getPeople();
    const friends = people.filter((p) => p.isFriend).map((p) => p.name);
    expect(friends).toEqual(['Игорь', 'Денис', 'Антон', 'Тимур']);
    expect(people.filter((p) => !p.isFriend).map((p) => p.name)).toEqual(['Айнура', 'Ерлан', 'Мира', 'Саша', 'Нурлан']);
  });

  it('события объединяются без дублей и по времени', () => {
    const a = demoEvents();
    const merged = mergeEvents(a, [...seedEvents(), a[0]]);
    expect(new Set(merged.map((e) => e.id)).size).toBe(merged.length);
    const times = merged.map((e) => e.startsAt);
    expect([...times].sort()).toEqual(times);
  });
});

describe('seed-события', () => {
  it('33 настоящих события, у всех есть координаты', () => {
    const list = seedEvents();
    expect(list).toHaveLength(33);
    for (const e of list) {
      expect(e.origin).toBe('real');
      expect(e.lat).toBeGreaterThan(42.9);
      expect(e.lat).toBeLessThan(43.5);
      expect(e.lon).toBeGreaterThan(76.6);
      expect(e.lon).toBeLessThan(77.3);
    }
  });

  it('без координат — точка в центре и needsPin', () => {
    const e = mapSeedEvent({
      id: 'x', title: 't', category: 'music', tags: [], starts_at: '2026-10-01T19:00:00+05:00', ends_at: null,
      venue_name: null, address: '', lat: null, lon: null, needs_pin: false, price_min: null, price_max: null,
      is_free: true, about: '', organizer: null, source_url: null,
    });
    expect([e.lat, e.lon]).toEqual([ALMATY_CENTER.lat, ALMATY_CENTER.lon]);
    expect(e.needsPin).toBe(true);
  });

  it('длинное событие — больше 6 часов', () => {
    expect(isLongEvent('2026-10-02T10:00:00+05:00', '2026-10-04T19:00:00+05:00')).toBe(true);
    expect(isLongEvent('2026-10-07T19:30:00+05:00', '2026-10-07T21:30:00+05:00')).toBe(false);
    expect(isLongEvent('2026-10-07T19:30:00+05:00', null)).toBe(false);
  });

  it('строка из Supabase превращается в событие', () => {
    const e = mapFeedRow({
      id: 'uuid', external_id: 'seed-001', title: 'Стендап', category: 'standup', tags: null, starts_at: '2026-09-29T16:00:00Z',
      ends_at: null, is_long: false, venue_name: 'Бар', address: 'Гагарина, 93', address_note: null, lat: 43.24, lon: 76.89,
      needs_pin: false, price_min: 3500, price_max: 3500, is_free: false, about: '', organizer: null, cover_url: null,
      source_url: null, visibility: 'public',
    });
    expect(e.id).toBe('seed-001');
    expect(e.tags).toEqual([]);
    expect(e.origin).toBe('real');
  });
});

describe('форматирование', () => {
  it('цена', () => {
    expect(formatPrice(0, 0, true)).toBe('0 ₸');
    expect(formatPrice(3000, 3000, false)).toBe('3 000 ₸');
    expect(formatPrice(15000, null, false)).toBe('ОТ 15 000 ₸');
  });
  it('когда — по времени Алматы', () => {
    const now = new Date('2026-09-28T07:00:00Z'); // 12:00 в Алматы
    expect(formatWhen('2026-09-28T14:30:00Z', now)).toBe('СЕГОДНЯ · 19:30');
    expect(formatWhen('2026-09-29T16:00:00Z', now)).toBe('ЗАВТРА · 21:00');
    expect(formatWhen('2026-10-03T03:00:00Z', now)).toBe('СБ 3.10 · 08:00');
  });
});
