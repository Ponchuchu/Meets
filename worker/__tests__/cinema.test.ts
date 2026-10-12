import { parseCinemaPage } from '../src/cinema.ts';

const show = (patch: Record<string, unknown> = {}) => ({ '@type': 'ScreeningEvent', startDate: '2026-10-12T18:00:00+05:00', workPerformed: { '@type': 'Movie', name: 'Фильм', image: '/poster.jpg' }, location: { name: 'Chaplin MEGA Alma-Ata', address: { addressLocality: 'Алматы', streetAddress: 'Розыбакиева, 247А' } }, offers: { price: '3000', priceCurrency: 'KZT' }, url: '/movie/example', ...patch });
const page = (items: unknown[]) => `<script type="application/ld+json">${JSON.stringify({ '@graph': items })}</script>`;
it('из официальной разметки берёт отдельные сеансы, адрес, цену и фото', () => {
  const result = parseCinemaPage(page([show(), show({ startDate: '2026-10-12T19:30:00+05:00' })]), 'https://chaplin.kz/', 'Chaplin');
  expect(result).toHaveLength(2);
  expect(result[0]).toMatchObject({ category: 'movie', starts_at: '2026-10-12T18:00:00+05:00', address: 'Розыбакиева, 247А', price_min: 3000, image_url: 'https://chaplin.kz/poster.jpg' });
  expect(result[1].starts_at).not.toBe(result[0].starts_at);
});
it('не создаёт сеанс без времени, по каталогу фильмов или для другого города', () => {
  expect(parseCinemaPage(page([show({ startDate: '2026-10-12' }), show({ location: { name: 'Кинотеатр', address: { addressLocality: 'Астана' } } }), { '@type': 'Movie', name: 'Без расписания' }]), 'https://chaplin.kz/', 'Chaplin')).toEqual([]);
});
it('локальные дата и время приводятся к часовому поясу Алматы', () => {
  expect(parseCinemaPage(page([show({ startDate: '2026-10-12T18:00:00' })]), 'https://chaplin.kz/', 'Chaplin')[0].starts_at).toBe('2026-10-12T18:00:00+05:00');
});
it('цену в другой валюте не выдаёт за тенге', () => {
  expect(parseCinemaPage(page([show({ offers: { price: 20, priceCurrency: 'USD' } })]), 'https://chaplin.kz/', 'Chaplin')[0].price_min).toBeNull();
});
