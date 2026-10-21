// Часы работы мест: открыто, перерыв, закрыто, ночные часы, неделя строками и слоты для плана.
import { openStatus, slotsFor, weekLines } from '../data/hours';
import type { Hours } from '../data/attractions';

const week: Hours = { 1: [['10:00', '13:00'], ['14:00', '22:00']], 2: [['10:00', '13:00'], ['14:00', '22:00']], 3: [['10:00', '13:00'], ['14:00', '22:00']], 4: [['10:00', '13:00'], ['14:00', '22:00']], 5: [['10:00', '13:00'], ['14:00', '22:00']], 6: [['11:00', '02:00']], 7: [] };
// 2026-10-21 — среда. Время в UTC+5.
const at = (hm: string, date = '2026-10-21') => new Date(`${date}T${hm}:00+05:00`);

it('открыто и предупреждает о перерыве', () => {
  expect(openStatus(week, at('11:00'))).toEqual({ state: 'open', text: 'Открыто до 13:00', breakText: 'перерыв 13:00–14:00' });
});
it('в перерыв — «Перерыв до 14:00»', () => {
  expect(openStatus(week, at('13:20'))).toMatchObject({ state: 'break', text: 'Перерыв до 14:00' });
});
it('утром до открытия и вечером после закрытия', () => {
  expect(openStatus(week, at('08:00')).text).toBe('Откроется в 10:00');
  expect(openStatus(week, at('23:00')).text).toBe('Закрыто · откроется завтра в 10:00');
});
it('ночные часы субботы действуют в воскресенье до 02:00, а в выходной — следующий рабочий день', () => {
  expect(openStatus(week, at('01:00', '2026-10-25')).text).toBe('Открыто до 02:00');
  expect(openStatus(week, at('12:00', '2026-10-25')).text).toBe('Закрыто · откроется завтра в 10:00');
});
it('нет часов — «уточняются», не выдумываем', () => {
  expect(openStatus(null).state).toBe('unknown');
});
it('неделя склеивает одинаковые дни', () => {
  expect(weekLines(week)).toEqual([
    { days: 'Пн–Пт', time: '10:00–13:00, 14:00–22:00' }, { days: 'Сб', time: '11:00–02:00' }, { days: 'Вс', time: 'выходной' },
  ]);
});
it('слоты: не в перерыв и не позже чем за час до закрытия', () => {
  const s = slotsFor(week, 3, 11 * 60 + 10);
  expect(s[0]).toBe('11:30');
  expect(s).toContain('12:00');
  expect(s).not.toContain('12:30');
  expect(s).toContain('14:00');
  expect(s.at(-1)).toBe('21:00');
});
