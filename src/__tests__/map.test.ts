import { demoEvents } from '../data/demo';
import type { EventItem } from '../data/types';
import { calendarCells, monthsTitle, rangeLabel, weekend } from '../map/calendar';
import { activeCount, DEFAULT_FILTERS as BASE, matchesPrice, showLabel, visibleEvents } from '../map/filters';
import { phaseOf, whenLabel } from '../map/lifecycle';

// Тесты по датам — с выключенным «Ближайшим временем».
const DEFAULT_FILTERS = { ...BASE, soon: false };

// Понедельник 28.09.2026, время — по Алматы (UTC+5).
const at = (hhmm: string, day = 28) => new Date(`2026-09-${String(day).padStart(2, '0')}T${hhmm}:00+05:00`);
const concert = { startsAt: '2026-09-28T19:30:00+05:00', endsAt: '2026-09-28T21:30:00+05:00', isLong: false };
const expo = { startsAt: '2026-09-28T10:00:00+05:00', endsAt: '2026-10-04T21:00:00+05:00', isLong: true };

describe('жизнь точки', () => {
  it('концерт в 19:30 длиной 2 часа', () => {
    expect(phaseOf(concert, at('12:00', 21))).toBe('announce'); // за неделю
    expect(phaseOf(concert, at('12:00'))).toBe('today');
    expect(phaseOf(concert, at('18:45'))).toBe('soon'); // за час
    expect(phaseOf(concert, at('19:40'))).toBe('live');
    expect(phaseOf(concert, at('20:15'))).toBe('hidden'); // через 40 минут опоздавшим поздно
  });
  it('тем, кто идёт, видно до конца', () => {
    expect(phaseOf(concert, at('20:15'), true)).toBe('live');
    expect(phaseOf(concert, at('21:31'), true)).toBe('hidden');
  });
  it('подписи', () => {
    expect(whenLabel(concert, at('12:00'))).toBe('СЕГОДНЯ 19:30');
    expect(whenLabel(concert, at('19:40'))).toBe('ИДЁТ · ЕЩЁ 1 Ч 50 МИН');
    expect(whenLabel(concert, at('12:00', 27))).toBe('ЗАВТРА 19:30');
  });
  it('длинное событие видно до закрытия, за 30 минут — «скоро закроется»', () => {
    expect(phaseOf(expo, at('18:00', 30))).toBe('live');
    expect(whenLabel(expo, at('18:00', 30))).toBe('ИДЁТ ДО 21:00');
    expect(phaseOf(expo, at('20:40', 30))).toBe('closing');
    expect(phaseOf(expo, at('22:00', 30))).toBe('hidden'); // закрыто на ночь, завтра снова
    expect(phaseOf(expo, at('09:00', 30))).toBe('today');
    expect(whenLabel(expo, at('09:00', 30))).toBe('СЕГОДНЯ С 10:00');
  });
  it('закрытая на ночь выставка видна в фильтре «7 дней», но не «сегодня»', () => {
    const e = demoEvents(at('12:00')).find((x) => x.id === 'anime')!;
    expect(visibleEvents([e], DEFAULT_FILTERS, at('21:30'))).toHaveLength(0);
    expect(visibleEvents([e], { ...DEFAULT_FILTERS, to: 6 }, at('21:30'))).toHaveLength(1);
  });
});

describe('фильтры карты', () => {
  const base = at('12:00');
  const events = demoEvents(base);
  it('сегодня: джаз, настолки, концерт, аниме, фуд-маркет', () => {
    const ids = visibleEvents(events, DEFAULT_FILTERS, base).map((e) => e.id).sort();
    expect(ids).toEqual(['anime', 'concert', 'food', 'games', 'jazz']);
  });
  it('выходные: поход и велопрогулка', () => {
    const [sat, sun] = weekend(base);
    const ids = visibleEvents(events, { ...DEFAULT_FILTERS, from: sat, to: sun }, base).map((e) => e.id);
    expect(ids).toEqual(expect.arrayContaining(['hike', 'bike', 'anime']));
    expect(ids).not.toContain('jazz');
  });
  it('только бесплатные', () => {
    const ids = visibleEvents(events, { ...DEFAULT_FILTERS, free: true }, base).map((e) => e.id);
    expect(ids.sort()).toEqual(['food', 'jazz']);
  });
  it('бюджет и категории', () => {
    expect(matchesPrice({ isFree: false, priceMin: 15000 }, { free: false, max: 5000 })).toBe(false);
    expect(matchesPrice({ isFree: false, priceMin: 15000 }, { free: false, max: 20000 })).toBe(true);
    const ids = visibleEvents(events, { ...DEFAULT_FILTERS, cats: ['games'] }, base).map((e) => e.id);
    expect(ids).toEqual(['games']);
  });
  it('вечером прошедший джаз уже скрыт, а у идущих — нет', () => {
    const late = at('20:30');
    const f = { ...DEFAULT_FILTERS };
    expect(visibleEvents(events, f, late).map((e) => e.id)).not.toContain('jazz');
    expect(visibleEvents(events, f, late, new Set(['jazz'])).map((e) => e.id)).toContain('jazz');
  });
  it('счётчик активных фильтров и подпись кнопки', () => {
    expect(activeCount(BASE)).toBe(0);
    expect(activeCount(DEFAULT_FILTERS)).toBe(1);
    expect(activeCount({ ...BASE, free: true, company: true })).toBe(2);
    expect(showLabel(5)).toBe('Показать 5 событий');
    expect(showLabel(1)).toBe('Показать 1 событие');
    expect(showLabel(3)).toBe('Показать 3 события');
  });
});

describe('календарь', () => {
  const base = at('12:00');
  it('5 недель с понедельника, сегодня первым', () => {
    const cells = calendarCells(base, [] as EventItem[]);
    expect(cells).toHaveLength(35);
    expect(cells[0]).toMatchObject({ offset: 0, day: 28, weekday: 0 });
    expect(cells[3].day).toBe(1);
    expect(monthsTitle(cells)).toBe('Сентябрь — октябрь');
  });
  it('подписи диапазонов', () => {
    expect(rangeLabel(0, 0, base)).toBe('Сегодня');
    expect(rangeLabel(1, 1, base)).toBe('Завтра');
    expect(rangeLabel(5, 6, base)).toBe('Выходные');
    expect(rangeLabel(3, 3, base)).toBe('1 окт');
    expect(rangeLabel(0, 6, base)).toBe('28 сен – 4 окт');
  });
});

describe('ближайшее время (v6)', () => {
  it('сейчас и следующие 24 часа, прошедшее — нет', () => {
    const now = new Date('2026-09-28T18:00:00+05:00');
    const ev = (id: string, start: string, end: string) => ({ ...demoEvents()[0], id, startsAt: start, endsAt: end, isLong: false, isFree: true, priceMin: 0 });
    const list = [
      ev('tonight', '2026-09-28T19:30:00+05:00', '2026-09-28T21:30:00+05:00'),
      ev('tomorrow-am', '2026-09-29T10:00:00+05:00', '2026-09-29T12:00:00+05:00'),
      ev('later', '2026-09-30T19:00:00+05:00', '2026-09-30T21:00:00+05:00'),
      ev('past', '2026-09-28T10:00:00+05:00', '2026-09-28T12:00:00+05:00'),
    ];
    expect(visibleEvents(list, BASE, now).map((e) => e.id).sort()).toEqual(['tomorrow-am', 'tonight']);
  });
});
