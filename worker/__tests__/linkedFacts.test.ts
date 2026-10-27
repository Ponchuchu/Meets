import { linkedFacts, sameShow, ticketUrl } from '../src/linkedFacts.ts';
import { extract } from '../src/heuristics.ts';

describe('linked ticket facts', () => {
  const event = () => ({ ...extract('', '2026-10-27T12:00:00+05:00'), title: 'Руслан Тай. Импровизационный концерт', starts_at: '2026-11-01T21:30:00+05:00', price_min: null, is_free: false });
  const html = (title = 'Руслан Тай. Импровизационный концерт') => `<script type="application/ld+json">${JSON.stringify({ '@type': 'Event', name: title, startDate: '2026-11-01T21:30:00+05:00', location: { name: 'Central', address: { addressLocality: 'Алматы' } }, offers: { priceCurrency: 'KZT', price: '5000' } })}</script>`;
  it('fills only matched event facts, not a different event on a ticket page', async () => {
    const x = event();
    await linkedFacts(x, 'Билеты https://ticketon.kz/event/tay', async () => new Response(html(), { headers: { 'content-type': 'text/html' } }));
    expect(x.price_min).toBe(5000);
    const other = event();
    await linkedFacts(other, 'https://ticketon.kz/event/other', async () => new Response(html('Совсем другой концерт'), { headers: { 'content-type': 'text/html' } }));
    expect(other.price_min).toBeNull();
  });
  it('rejects private URLs, credentials, ports and redirects outside known ticket sites', async () => {
    for (const u of ['http://ticketon.kz/a', 'https://127.0.0.1/a', 'https://ticketon.kz.evil.com/a', 'https://user@ticketon.kz/a', 'https://ticketon.kz:8080/a']) expect(ticketUrl(u)).toBeNull();
    const fetcher = jest.fn(async () => new Response(null, { status: 302, headers: { location: 'http://127.0.0.1/private' } }));
    const x = event(); await linkedFacts(x, 'https://ticketon.kz/event/tay', fetcher);
    expect(fetcher).toHaveBeenCalledTimes(1); expect(x.price_min).toBeNull();
  });
  it('does not confuse another show date or override the original price', async () => {
    expect(sameShow(event(), { title: event().title, starts_at: '2026-11-02T21:30:00+05:00' })).toBe(false);
    const x = { ...event(), price_min: 7000 };
    await linkedFacts(x, 'https://ticketon.kz/event/tay', async () => new Response(html(), { headers: { 'content-type': 'text/html' } }));
    expect(x.price_min).toBe(7000);
  });
});
