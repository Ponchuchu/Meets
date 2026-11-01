import { buildDraft } from '../src/draft.ts';
import { cleanVenueName, matchVenue, NOT_A_PLACE, selectRegistryMatch, type VenueRow } from '../src/venues.ts';
import type { Extraction, RawPost, Source } from '../src/types.ts';

const source = { id: 's', trusted: false, auto_publish: false } as unknown as Source;
const post = { sourceId: 's', externalId: '1', url: 'u', text: '', images: [], postedAt: null } as unknown as RawPost;
const x = (venue_name: string | null, address: string | null): Extraction => ({
  class: 'event', title: 'Транзитный пассажир', category: 'theatre', tags: [], starts_at: '2026-11-05T14:00:00Z', ends_at: null, is_long: false,
  venue_name, address, price_min: null, price_max: null, is_free: false, about: '', organizer: null, confidence: 0.9,
} as unknown as Extraction);

describe('площадка без адреса прикрепляется к месту сама', () => {
  it('склеенное название и опечатка чинятся', () => {
    expect(cleanVenueName('ТеатрЛермонтава')).toBe('Театр Лермонтова');
    expect(cleanVenueName('«Гостиница Казахстан»')).toBe('Гостиница Казахстан');
  });
  it('«ТеатрЛермонтава» находит площадку из справочника', () => {
    const v: VenueRow[] = [{ id: 'v1', name: 'Театр Лермонтова', aliases: [], address: 'проспект Абая, 43', lat: 43.243, lon: 76.944 }];
    expect(matchVenue('ТеатрЛермонтава', null, v)?.id).toBe('v1');
  });
  it('нет в справочнике, адреса нет — ищем по названию, флага needs_pin нет, адрес берём у геокодера', async () => {
    const asked: string[] = [];
    const d = await buildDraft(x('Театр Лермонтова', null), post, source, [], async (q) => { asked.push(q); return { lat: 43.243, lon: 76.944, address: 'проспект Абая, 43' }; });
    expect(asked).toEqual(['Театр Лермонтова']);
    expect(d?.flags).toEqual([]);
    expect(d?.point).toEqual({ lat: 43.243, lon: 76.944, address: 'проспект Абая, 43' });
    expect(d?.address).toBe('проспект Абая, 43');
  });
  it('«в центре» или «онлайн» по названию не ищем', async () => {
    expect(NOT_A_PLACE.test('Онлайн')).toBe(true);
    const asked: string[] = [];
    const d = await buildDraft(x('Онлайн', 'в центре'), post, source, [], async (q) => { asked.push(q); return null; });
    expect(asked).toEqual([]);
    expect(d?.flags).toContain('needs_pin');
  });
  it('площадка без точки сохраняет найденные координаты', async () => {
    const venue: VenueRow[] = [{ id: 'v1', name: 'Театр Лермонтова', aliases: [], address: 'проспект Абая, 43', lat: null, lon: null }];
    const d = await buildDraft(x('Театр Лермонтова', 'проспект Абая, 43'), post, source, venue, async () => ({ lat: 43.243, lon: 76.944 }));
    expect(d?.venue_id).toBeNull();
    expect(d?.point).toMatchObject({ lat: 43.243, lon: 76.944 });
    expect(d?.flags).not.toContain('needs_pin');
  });
  it('не нашли нигде — остаётся для модератора', async () => {
    const d = await buildDraft(x('Неведомый зал', null), post, source, [], async () => null);
    expect(d?.flags).toContain('needs_pin');
  });
});

it('справочник требует точный номер дома и отклоняет удалённые неоднозначные точки', () => {
  const rows = [{ lat: 43.23, lon: 76.94, house: '5', score: 0.9 }, { lat: 43.2292, lon: 76.94712, house: '5/2', score: 0.8 }];
  expect(selectRegistryMatch(rows, '5/2')).toEqual({ lat: 43.2292, lon: 76.94712 });
  expect(selectRegistryMatch(rows, '5/3')).toBeNull();
  expect(selectRegistryMatch([...rows, { lat: 43.26, lon: 76.95, house: '5/2', score: 0.7 }], '5/2')).toBeNull();
});
