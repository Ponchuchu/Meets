import { repairPrices } from '../src/repair-prices.ts';
describe('missing price retry', () => {
  it('recovers caption price for an existing event and guards concurrent edits', async () => {
    const fetcher = jest.fn().mockResolvedValueOnce(new Response(JSON.stringify([{ id: 'a', title: 'Концерт', starts_at: '2026-11-01T21:30:00+05:00', about: 'Концерт', source_url: '', flags: ['check_price', 'needs_pin'] }]))).mockResolvedValueOnce(new Response(JSON.stringify([{ text: 'Билеты от 5000 тенге' }]))).mockResolvedValueOnce(new Response(null, { status: 204 }));
    expect(await repairPrices('https://db.example', 'key', fetcher)).toBe(1);
    const [url, init] = fetcher.mock.calls[2];
    expect(url).toContain('price_min=is.null&is_free=eq.false');
    expect(JSON.parse(init.body)).toMatchObject({ price_min: 5000, is_free: false, flags: ['needs_pin'] });
  });
  it('rotates unresolved cards without inventing a price', async () => {
    const fetcher = jest.fn().mockResolvedValueOnce(new Response(JSON.stringify([{ id: 'a', title: 'Концерт', starts_at: '2026-11-01T21:30:00+05:00', about: 'Будет весело', source_url: '', flags: [] }]))).mockResolvedValueOnce(new Response('[]')).mockResolvedValueOnce(new Response(null, { status: 204 }));
    expect(await repairPrices('https://db.example', 'key', fetcher)).toBe(0);
    expect(Object.keys(JSON.parse(fetcher.mock.calls[2][1].body))).toEqual(['price_checked_at']);
  });
});
