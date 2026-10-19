import { createDb } from '../src/db.ts';
import { processPosts } from '../src/pipeline.ts';
import { newReport, runSearch, toPost } from '../src/search.ts';
import { geocode } from '../src/venues.ts';
import type { Source } from '../src/types.ts';

const NOW = new Date('2026-10-12T10:00:00Z');
const response = (body: unknown, status = 200) => ({ ok: status < 400, status, text: async () => JSON.stringify(body), json: async () => body }) as Response;
const source: Source = { id: 'site', kind: 'site', handle: 'sxodim.com/almaty', title: 'Sxodim', trusted: false, auto_publish: false, enabled: true, cursor: null };
const mapboxBefore = process.env.MAPBOX_TOKEN;

beforeEach(() => { process.env.MAPBOX_TOKEN = 'unit-test-token'; });

afterEach(() => {
  jest.restoreAllMocks(); jest.useRealTimers();
  if (mapboxBefore === undefined) delete process.env.MAPBOX_TOKEN; else process.env.MAPBOX_TOKEN = mapboxBefore;
});

it('удалённая долгая выставка не возвращается черновиком с другого сайта', async () => {
  jest.useFakeTimers().setSystemTime(NOW);
  const exhibition = { id: 'old', title: 'Выставка редких растений', orig_title: null, starts_at: '2026-10-01T10:00:00Z', ends_at: '2026-10-30T15:00:00Z', status: 'archived', rejected: true, venues: { name: 'Музей' } };
  jest.spyOn(global, 'fetch').mockImplementation(async (input) => {
    const q = new URL(String(input)).searchParams;
    const lower = q.get('starts_at')?.replace('gte.', '');
    return response(lower && exhibition.starts_at < lower ? [] : [exhibition]);
  });
  const known = await createDb('https://db.test', 'test-key').known();
  const { post, x } = toPost({ title: exhibition.title, starts_at: exhibition.starts_at, ends_at: exhibition.ends_at, venue_name: 'Музей', category: 'art', url: 'https://another.test/exhibition' }, source.id, NOW);
  const results = await processPosts([post], source, { known, venues: [], geocode: async () => null, now: NOW, understand: async () => ({ ...x, by: 'ai' }) });
  expect(results[0].kind).toBe('duplicate');
  if (results[0].kind === 'duplicate') expect(results[0].of.id).toMatch(/^new:/);
});

it('прочитаны и события после первой полной страницы; исходное название защищено', async () => {
  const rows = Array.from({ length: 501 }, (_, i) => ({ id: String(i).padStart(6, '0'), title: `Событие ${i}`, orig_title: i === 500 ? 'Старое название' : null, starts_at: '2026-10-20T10:00:00Z', status: 'published', rejected: false, venues: null }));
  jest.spyOn(global, 'fetch').mockImplementation(async (input) => {
    const q = new URL(String(input)).searchParams;
    const after = q.get('id')?.replace('gt.', '');
    return response(rows.filter((r) => !after || r.id > after).slice(0, Math.min(500, Number(q.get('limit')))));
  });
  const known = await createDb('https://db.test', 'test-key').known();
  expect(known).toHaveLength(502);
  expect(known).toContainEqual(expect.objectContaining({ title: 'Старое название', id: 'new:orig-000500' }));
});

it('чистка сохраняет идущее событие и частную встречу, закончившееся архивирует', async () => {
  jest.useFakeTimers().setSystemTime(NOW);
  const rows = [
    { id: 'active', starts_at: '2026-10-12T09:00:00Z', ends_at: null, visibility: 'public', status: 'draft', rejected: false },
    { id: 'expired', starts_at: '2026-10-12T06:00:00Z', ends_at: null, visibility: 'public', status: 'draft', rejected: false },
    { id: 'long', starts_at: '2026-10-01T09:00:00Z', ends_at: '2026-10-30T09:00:00Z', visibility: 'public', status: 'draft', rejected: false },
    { id: 'private', starts_at: '2026-10-01T09:00:00Z', ends_at: null, visibility: 'friends', status: 'draft', rejected: false },
  ];
  jest.spyOn(global, 'fetch').mockImplementation(async (input, init) => {
    const q = new URL(String(input)).searchParams;
    const condition = q.get('or')!;
    const end = /ends_at.lt.([^,]+)/.exec(condition)![1];
    const start = /starts_at.lt.([^)]*)/.exec(condition)![1];
    const selected = rows.filter((r) => (!q.has('visibility') || r.visibility === 'public') && (r.ends_at ? r.ends_at < end : r.starts_at < start));
    if (init?.method === 'DELETE') selected.forEach((r) => rows.splice(rows.indexOf(r), 1));
    else selected.forEach((r) => Object.assign(r, JSON.parse(String(init?.body))));
    return response(selected.map((r) => ({ id: r.id })));
  });
  expect(await createDb('https://db.test', 'test-key').purgeExpiredDrafts()).toBe(1);
  expect(rows).toHaveLength(4);
  expect(rows.find((r) => r.id === 'active')?.status).toBe('draft');
  expect(rows.find((r) => r.id === 'private')?.status).toBe('draft');
  expect(rows.find((r) => r.id === 'expired')).toMatchObject({ status: 'archived', rejected: true });
});

it('«Оба» сохраняет афишу сайта без ключа ИИ и сообщает причину', async () => {
  const event = `<script type="application/ld+json">${JSON.stringify({ '@type': 'Event', name: 'Джаз во дворе', startDate: '2026-10-15T20:00:00+05:00', location: { name: 'Джаз во дворе', address: { streetAddress: 'Музей, Абая 1' } }, offers: { price: 3000 } })}</script>`;
  jest.spyOn(global, 'fetch').mockImplementation(async (input) => {
    const url = String(input);
    const body = url.includes('/event/') ? event : url.includes('?page=') ? '' : 'https://sxodim.com/almaty/event/jazz';
    return { ...response(null, url.includes('?page=') ? 404 : 200), text: async () => body };
  });
  const report = newReport();
  const result = await runSearch(undefined, 'gemini-2.5-flash', NOW, 7, ['music'], 40, 'all', report, ['sxodim']);
  expect(result.map((r) => r.title)).toEqual(['Джаз во дворе']);
  expect(report.ai?.error).toBe('Нет GEMINI_API_KEY');
  await expect(runSearch(undefined, 'gemini-2.5-flash', NOW, 7, ['music'], 40, 'ai')).rejects.toThrow('Нет GEMINI_API_KEY');
});

it('улица без нужного дома не становится точным адресом', async () => {
  const queries: URL[] = [];
  jest.spyOn(global, 'fetch').mockImplementation(async (input) => {
    const u = new URL(String(input)); queries.push(u);
    if (u.hostname.includes('openstreetmap')) return response([{ lat: '43.2389', lon: '76.8897', address: { road: 'Абая' } }]);
    return response({ features: [{ geometry: { coordinates: [76.8897, 43.2389] }, properties: { feature_type: 'street', match_code: { confidence: 'high', address_number: 'unmatched' } } }] });
  });
  expect(await geocode('ул. Абая, 999, Алматы')).toBeNull();
  expect(queries.filter((u) => u.searchParams.get('street') === 'Абая')).toHaveLength(0);
  expect(queries.some((u) => u.searchParams.get('q')?.includes('999'))).toBe(true);
});

it('второй сервис с подтверждённым номером дома даёт точку', async () => {
  jest.spyOn(global, 'fetch').mockImplementation(async (input) => String(input).includes('openstreetmap') ? response([]) : response({ features: [{ geometry: { coordinates: [76.8897, 43.2389] }, properties: { feature_type: 'address', match_code: { confidence: 'exact', address_number: 'matched' } } }] }));
  expect(await geocode('ул. Абая, 123, Алматы')).toEqual({ lat: 43.2389, lon: 76.8897 });
});
