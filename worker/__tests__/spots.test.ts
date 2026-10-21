// Часы мест из 2ГИС и разметки сайтов: перерывы, выходные, круглосуточно, цена только в тенге.
import { hoursFrom2gis, hoursFromLd, priceFrom } from '../src/spots.ts';

it('2ГИС: два интервала — перерыв, нет дня — выходной', () => {
  const h = hoursFrom2gis({ Mon: { working_hours: [{ from: '10:00', to: '13:00' }, { from: '14:00', to: '22:00' }] }, Sat: { working_hours: [{ from: '11:00', to: '23:00' }] } });
  expect(h!['1']).toEqual([['10:00', '13:00'], ['14:00', '22:00']]);
  expect(h!['6']).toEqual([['11:00', '23:00']]);
  expect(h!['7']).toEqual([]);
  expect(hoursFrom2gis({ is_24x7: true })!['3']).toEqual([['00:00', '24:00']]);
  expect(hoursFrom2gis({})).toBeNull();
});
it('сайт: openingHoursSpecification и строка openingHours', () => {
  const a = hoursFromLd({ openingHoursSpecification: [{ dayOfWeek: ['https://schema.org/Monday', 'Tuesday'], opens: '9:00', closes: '18:00' }] });
  expect(a!['1']).toEqual([['09:00', '18:00']]);
  expect(a!['2']).toEqual([['09:00', '18:00']]);
  expect(a!['3']).toEqual([]);
  const b = hoursFromLd({ openingHours: ['Mo-Fr 10:00-22:00', 'Sa 11:00-20:00'] });
  expect(b!['5']).toEqual([['10:00', '22:00']]);
  expect(b!['6']).toEqual([['11:00', '20:00']]);
  expect(b!['7']).toEqual([]);
});
it('цена: тенге — да, доллары и «$$» — нет', () => {
  expect(priceFrom('от 3 000 ₸')).toBe(3000);
  expect(priceFrom('2500-5000 KZT')).toBe(2500);
  expect(priceFrom('$$')).toBeNull();
  expect(priceFrom('20 USD')).toBeNull();
});
