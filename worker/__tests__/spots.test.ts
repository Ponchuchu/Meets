// Часы мест из 2ГИС и разметки сайтов: перерывы, выходные, круглосуточно, цена только в тенге.
import { hoursFrom2gis, hoursFromLd, hoursFromText, infoLinks, pageText, priceFrom, priceFromText } from '../src/spots.ts';

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


it('текст: «ежедневно с 10:00 до 22:00, перерыв 13:00–14:00»', () => {
  const h = hoursFromText(pageText('<p>Режим работы: ежедневно с 10:00 до 22:00, перерыв 13:00–14:00</p>'))!;
  expect(h['1']).toEqual([['10:00', '13:00'], ['14:00', '22:00']]);
  expect(h['7']).toEqual([['10:00', '13:00'], ['14:00', '22:00']]);
});
it('текст: дни недели диапазонами и выходной', () => {
  const h = hoursFromText('Часы работы: Вт–Пт 9:00–18:00, Сб–Вс 10.00–20.00. Выходной: понедельник')!;
  expect(h['1']).toEqual([]);
  expect(h['3']).toEqual([['09:00', '18:00']]);
  expect(h['6']).toEqual([['10:00', '20:00']]);
});
it('время сеансов без слов «режим работы» часами места не считается', () => {
  expect(hoursFromText('Сеансы: 12:00–14:00, 18:00–20:00')).toBeNull();
});
it('цена из текста и ссылки на страницы с часами и ценами', () => {
  expect(priceFromText('Стоимость скипасса от 9 000 ₸, детский билет 4500 тг')).toBe(4500);
  const html = '<a href="/ru/prices">Цены</a><a href="/news/1">Новости</a><a href="https://other.kz/contacts">x</a><a href="/contacts">Контакты</a>';
  expect(infoLinks(html, 'https://shymbulak.com')).toEqual(['https://shymbulak.com/ru/prices', 'https://shymbulak.com/contacts']);
});
