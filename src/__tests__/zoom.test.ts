import { detailOf, focusZoom, groupByPoint, pinScale, showPinLabel } from '../map/zoom';

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
