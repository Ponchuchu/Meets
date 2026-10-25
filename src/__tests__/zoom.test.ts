import { detailOf, focusZoom, groupByPoint, pinScale, showPinLabel , placeLabels , pinTime } from '../map/zoom';



describe('физика карты', () => {
  it('точки мельче вдали и крупнее вблизи', () => {
    expect(pinScale(9)).toBe(0.55);
    expect(pinScale(13.4)).toBeCloseTo(1.006, 2);
    expect(pinScale(18)).toBe(1.15);
    expect(pinScale(12)).toBeLessThan(pinScale(14));
  });
  it('подписи: вдали нет, в городе — важные, вблизи — все', () => {
    expect(showPinLabel(detailOf(11), true)).toBe(false);
    expect(showPinLabel(detailOf(13.4), true)).toBe(true);
    expect(showPinLabel(detailOf(13.4), false)).toBe(false);
    expect(showPinLabel(detailOf(15), false)).toBe(true);
  });
  it('тап приближает, но не отдаляет', () => {
    expect(focusZoom(13)).toBe(15);
    expect(focusZoom(16.5)).toBe(16.5);
  });
  it('события в одной точке — одна группа, по времени', () => {
    const e = (id: string, lat: number, t: string) => ({ id, lat, lon: 76.9, startsAt: t });
    const groups = groupByPoint([e('b', 43.20001, '2026-10-02T15:00:00Z'), e('a', 43.20002, '2026-10-01T15:00:00Z'), e('c', 43.3, '2026-10-01T15:00:00Z')]);
    expect(groups).toHaveLength(2);
    expect(groups[0].map((x) => x.id)).toEqual(['a', 'b']);
  });
});
describe('подписи без наложений (FIX5)', () => {
  it('подпись прячется, если справа друг или другая подпись', () => {
    const z = 16;
    const a = { id: 'a', lat: 43.25, lon: 76.94, w: 100 };
    const b = { id: 'b', lat: 43.25, lon: 76.9406, w: 100 }; // ~45 px правее — в подписи «a»
    const far = { id: 'far', lat: 43.24, lon: 76.95, w: 100 };
    const pins = [a, b, far].map((x) => ({ lat: x.lat, lon: x.lon, r: 18 }));
    const shown = placeLabels([a, b, far], pins, z);
    expect(shown.has('a')).toBe(false); // значок «b» стоит в подписи «a»
    expect(shown.has('b')).toBe(true);
    expect(shown.has('far')).toBe(true);
    const friend = { lat: 43.24, lon: 76.9502, r: 30 };
    expect(placeLabels([far], [...pins, friend], z).has('far')).toBe(false);
  });
});
it('плашка времени на мини-афише (FIX5)', () => {
  const now = new Date('2026-10-25T13:00:00Z'); // 18:00 в Алматы
  expect(pinTime({ startsAt: '2026-10-25T14:30:00Z', endsAt: null, isLong: false }, now)).toEqual({ text: '19:30', live: false });
  expect(pinTime({ startsAt: '2026-10-25T12:30:00Z', endsAt: '2026-10-25T15:00:00Z', isLong: false }, now)).toEqual({ text: 'идёт', live: true });
  expect(pinTime({ startsAt: '2026-10-26T05:00:00Z', endsAt: null, isLong: false }, now)?.text).toBe('завтра 10:00');
  expect(pinTime({ startsAt: '2026-10-20T05:00:00Z', endsAt: '2026-10-30T15:00:00Z', isLong: true }, now)).toBeNull();
});
