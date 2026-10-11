import type { Outcome } from '../src/pipeline.ts';
import { keyLines } from '../src/robot.ts';
import { queueStats, runStats, telegramLine, telegramStat } from '../src/runstats.ts';
import type { Draft, RawPost } from '../src/types.ts';

const post = { sourceId: 's', externalId: '1', url: 'u', text: '', images: [], postedAt: null } as RawPost;
const draft = (over: Partial<Draft> = {}): Draft => ({
  title: 'Концерт', category: 'concert', tags: [], starts_at: '2026-10-15T20:00:00+05:00', ends_at: null, is_long: false, venue_id: null, venue_name: null, address: null,
  address_note: null, point: null, price_min: null, price_max: null, is_free: false, about: '', organizer: null, source_url: 'u', cover_url: null, ai_confidence: 0.9, flags: [], status: 'draft', ...over,
});
const d = (over: Partial<Draft> = {}): Outcome => ({ post, kind: 'draft', draft: draft(over), by: 'ai' });

describe('итоги запуска для панели', () => {
  it('считает, что реально легло в очередь: фото, точка, цена, ручные точки', () => {
    const q = queueStats([
      d({ cover_url: 'https://x/p.jpg', venue_id: 'v1', price_min: 3000 }),
      d({ cover_url: 'https://x/q.jpg', point: { lat: 43.2, lon: 76.9 }, is_free: true }),
      d({ flags: ['needs_pin'] }),
      d({ status: 'published', cover_url: 'https://x/r.jpg', venue_id: 'v2', price_min: 100 }),
      { post, kind: 'duplicate', of: { id: 'e1', title: 'Т', starts_at: '2026-10-15T20:00:00+05:00', venue_name: null } },
      { post, kind: 'unclear', reason: 'уже прошло' },
      { post, kind: 'unclear', reason: 'нет даты' },
    ]);
    expect(q).toEqual({ added: 4, published: 1, duplicates: 1, unclear: 1, past: 1, withPhoto: 3, withPoint: 3, withPrice: 3, needPin: 1 });
  });

  it('склеивает отчёт поиска с итогами базы; без отчёта (поиск упал) тоже работает', () => {
    const report = { window: { from: '2026-10-12', to: '2026-10-19' }, sources: [{ name: 'Sxodim', found: 5, ok: true }], outside: 2, merged: 1, kept: 4, photo: 4, noPhoto: 0, siteGeo: 0, price: 3 };
    const s = runStats([d()], report, 14);
    expect(s).toMatchObject({ purged: 14, kept: 4, merged: 1, queue: { added: 1 } });
    expect(runStats([], null, 0)).toMatchObject({ purged: 0, queue: { added: 0 } });
  });
});

describe('Telegram в журнале', () => {
  const ad: Outcome = { post, kind: 'junk', cls: 'ad' };
  const meme: Outcome = { post, kind: 'junk', cls: 'meme' };
  it('сводка по каналу и строка, которую панель разбирает по « · »', () => {
    const t = telegramStat('afisha_almaty', [d(), d(), d(), ad, ad, meme, { post, kind: 'junk', cls: 'not_almaty' }]);
    expect(t).toMatchObject({ name: 'Telegram @afisha_almaty', posts: 7, events: 3, ad: 2, meme: 1, notAlmaty: 1 });
    const line = telegramLine(t);
    expect(line).toBe('Источник · Telegram @afisha_almaty · 3 события, реклама 2, мемы 1, не Алматы 1');
    // та же регулярка, что в панели (src/admin/rules.ts)
    expect(/^Источник · (.+?) · (.+)$/.exec(line)?.slice(1)).toEqual(['Telegram @afisha_almaty', '3 события, реклама 2, мемы 1, не Алматы 1']);
  });
  it('новых постов нет — так и пишем', () => {
    expect(telegramLine(telegramStat('x', []))).toBe('Источник · Telegram @x · новых постов нет');
  });
});

describe('проверка ключей в начале запуска', () => {
  const ok = (data: unknown) => (async () => ({ status: 200, ok: true, json: async () => data })) as unknown as typeof fetch;
  it('нет ключей — предупреждение; ключ Kimi принят — с балансом', async () => {
    const none = await keyLines({}, ok({}));
    expect(none.map((l) => l.text)).toEqual(['Ключ · Gemini · нет', 'Ключ · Anthropic (Claude) · нет', 'Ключ · Kimi · нет']);
    expect(none.every((l) => l.level === 'warn')).toBe(true);
    const some = await keyLines({ HAS_GEMINI: 'true', KIMI_API_KEY: 'k' }, ok({ data: { available_balance: 12.5 } }));
    expect(some.map((l) => l.text)).toContain('Ключ · Kimi · есть, баланс 12.50');
    expect(some.find((l) => l.text.startsWith('Ключ · Gemini'))?.level).toBe('info');
  });
  it('маленький баланс помечается, плохой ключ — «не принят», сбой сети не ломает запуск', async () => {
    const low = await keyLines({ KIMI_API_KEY: 'k' }, ok({ data: { available_balance: 0.3 } }));
    expect(low.find((l) => l.text.includes('Kimi'))?.text).toBe('Ключ · Kimi · есть, баланс 0.30 — мало');
    const bad = await keyLines({ KIMI_API_KEY: 'k' }, (async () => ({ status: 401, ok: false })) as unknown as typeof fetch);
    expect(bad.find((l) => l.text.includes('Kimi'))?.text).toBe('Ключ · Kimi · не принят');
    const down = await keyLines({ KIMI_API_KEY: 'k' }, (async () => { throw new Error('net'); }) as unknown as typeof fetch);
    expect(down.find((l) => l.text.includes('Kimi'))?.text).toBe('Ключ · Kimi · есть');
  });
});
