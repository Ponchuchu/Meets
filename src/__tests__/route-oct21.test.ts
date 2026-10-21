import { snapToLine } from '../event/navigation';
import { thin } from '../live/osrm';
import { agoShort } from '../map/ago';

it('в навигаторе точка прилипает к линии, если рядом, и не трогается, если далеко', () => {
  const line: [number, number][] = [[76.9, 43.25], [76.91, 43.25]];
  const near = snapToLine({ lat: 43.2501, lon: 76.905 }, line);
  expect(near.lat).toBeCloseTo(43.25, 6);
  const far = { lat: 43.26, lon: 76.905 };
  expect(snapToLine(far, line)).toBe(far);
});
it('длинная линия автобуса прореживается до 25 точек, концы на месте', () => {
  const pts = Array.from({ length: 60 }, (_, i) => [76.9 + i / 1000, 43.2] as [number, number]);
  const t = thin(pts);
  expect(t).toHaveLength(25);
  expect(t[0]).toEqual(pts[0]);
  expect(t.at(-1)).toEqual(pts.at(-1));
});
it('давно не обновлялся: «12 ч», «вчера», а не «702 МИН»', () => {
  expect(agoShort(5)).toBe('5 мин');
  expect(agoShort(702)).toBe('12 ч');
  expect(agoShort(26 * 60)).toBe('вчера');
  expect(agoShort(4 * 24 * 60)).toBe('4 дн');
});
