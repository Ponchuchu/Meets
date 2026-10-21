// Новые сайты-афиши: берём только размеченные события Алматы с датой и временем, ничего не придумываем.
import { eventLinks, ldEventFound, ldNodes } from '../src/eventSites.ts';

const ev = (patch: Record<string, unknown> = {}) => ({ '@type': 'MusicEvent', name: 'Концерт группы', startDate: '2026-10-25T19:00', url: '/event/koncert-123',
  location: { '@type': 'Place', name: 'Дворец Республики', address: { addressLocality: 'Алматы', streetAddress: 'пр. Достык, 56' } },
  offers: [{ price: '15000', priceCurrency: 'KZT' }, { price: '30000', priceCurrency: 'KZT' }], image: 'https://topbilet.kz/a.jpg', ...patch });
const page = (items: unknown[]) => `<script type="application/ld+json">${JSON.stringify({ '@graph': items })}</script>`;
const all = (html: string, url: string, almaty = true) => ldNodes(html).map(n => ldEventFound(n, url, 'Topbilet', almaty)).filter(Boolean);

it('из разметки берёт событие, время Алматы, площадку, цену и фото', () => {
  const [f] = all(page([ev()]), 'https://topbilet.kz/');
  expect(f).toMatchObject({ title: 'Концерт группы', starts_at: '2026-10-25T19:00+05:00', venue_name: 'Дворец Республики', price_min: 15000, price_max: 30000, url: 'https://topbilet.kz/event/koncert-123', source_name: 'Topbilet' });
});
it('не берёт другой город, событие без времени, отменённое и цену не в тенге', () => {
  expect(all(page([ev({ location: { name: 'Барыс Арена', address: { addressLocality: 'Астана' } } }), ev({ startDate: '2026-10-25' }), ev({ eventStatus: 'https://schema.org/EventCancelled' })]), 'https://topbilet.kz/')).toEqual([]);
  expect((all(page([ev({ offers: { price: 50, priceCurrency: 'USD' } })]), 'https://topbilet.kz/')[0] as { price_min: number | null }).price_min).toBeNull();
});
it('без города в разметке — только на алматинской странице', () => {
  const noCity = ev({ location: { name: 'Клуб', address: { streetAddress: 'Абая, 1' } } });
  expect(all(page([noCity]), 'https://topbilet.kz/', false)).toEqual([]);
  expect(all(page([noCity]), 'https://onvibe.me/almaty', true)).toHaveLength(1);
});
it('ссылки — только страницы событий этого сайта', () => {
  const html = '<a href="/event/standup-55">a</a><a href="/about">b</a><a href="https://other.kz/event/1">c</a><a href="/almaty/concerts/rock-night">d</a><a href="/">e</a>';
  expect(eventLinks(html, 'https://onvibe.me/almaty')).toEqual(['https://onvibe.me/event/standup-55', 'https://onvibe.me/almaty/concerts/rock-night']);
});
