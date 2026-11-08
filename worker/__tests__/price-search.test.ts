import { findPriceSources } from '../src/price-search.ts';
const event = { title: 'Концерт', starts_at: '2026-11-29T16:00:00Z', source_url: 'https://www.instagram.com/p/post' };
it('uses Kimi only for source discovery and ignores model-proposed prices', async () => {
  const search = jest.fn(async () => ({ text: JSON.stringify({ sources: ['https://ticketon.kz/almaty/event', 'http://169.254.169.254/metadata', 'https://evil.test/price'], price_min: 100 }), usage: { prompt: 0, output: 0, searches: 1, sources: 0 } }));
  expect(await findPriceSources(event, 'key', search)).toEqual(['https://ticketon.kz/almaty/event']);
  expect(search).toHaveBeenCalledWith(expect.stringContaining('Не угадывай цену'), 'key', expect.any(String), 1);
});
it('rejects a plain unverified price with no source', async () => {
  const search = jest.fn(async () => ({ text: '{"price_min":5000}', usage: { prompt: 0, output: 0, searches: 0, sources: 0 } }));
  expect(await findPriceSources(event, 'key', search)).toEqual([]);
});
