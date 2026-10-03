import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { findDuplicate, similarity } from '../src/dedupe.ts';
import { autoPublish, buildDraft } from '../src/draft.ts';
import { classify, extract, parsePrice, parseWhen } from '../src/heuristics.ts';
import { processPosts, summary } from '../src/pipeline.ts';
import { externalId, finalize, judgePage, ldStart, ogImage, parseGeminiOutput, readResponse, toPost, topicPrompt } from '../src/search.ts';
import { parseSxodimEvent, parseSxodimList } from '../src/sites.ts';
import { htmlToText, parseChannel } from '../src/telegram.ts';
import type { RawPost, Source } from '../src/types.ts';
import { isVague, matchVenue, type VenueRow } from '../src/venues.ts';

const fx = (f: string) => readFileSync(join(__dirname, '../fixtures', f), 'utf8');
const venues = JSON.parse(fx('venues.json')) as VenueRow[];
const source: Source = { id: 's', kind: 'telegram', handle: 'afisha_almaty', title: 'Telegram', trusted: true, auto_publish: true, enabled: true, cursor: null };
const ref = new Date('2026-09-28T12:00:00+05:00');

describe('Telegram-превью', () => {
  it('разбирает посты, картинки и время, от старых к новым', () => {
    const posts = parseChannel(fx('telegram.html'), 's');
    expect(posts).toHaveLength(7);
    expect(posts[0]).toMatchObject({ externalId: '101', url: 'https://t.me/afisha_almaty/101', images: ['https://cdn.example/anime.jpg'] });
    expect(posts[0].text).toContain('3–4 октября, 11:00–21:00');
    expect(posts[0].postedAt).toBe('2026-09-28T09:00:00.000Z');
  });
  it('берёт только новое после курсора', () => {
    expect(parseChannel(fx('telegram.html'), 's', '105').map((p) => p.externalId)).toEqual(['106', '107']);
  });
  it('HTML → текст', () => {
    expect(htmlToText('Концерт&nbsp;<b>в 19:00</b><br/>Вход &laquo;свободный&raquo; &#8212; да')).toBe('Концерт в 19:00\nВход «свободный» — да');
  });
});

describe('разбор без ИИ', () => {
  it('классы: событие, реклама, мем, не Алматы, отмена', () => {
    expect(classify('Лекция 1 октября в 19:00, вход бесплатно')).toBe('event');
    expect(classify('Скидка 30% по промокоду')).toBe('ad');
    expect(classify('Когда вспомнил, что вчера было воскресенье')).toBe('meme');
    expect(classify('Концерт в Астане 5 октября в 19:00')).toBe('not_almaty');
    expect(classify('Джаз во дворе не состоится')).toBe('cancel');
  });
  it('даты и время по Алматы', () => {
    expect(parseWhen('3–4 октября, 11:00–21:00', ref)).toEqual({ starts: '2026-10-03T11:00:00+05:00', ends: '2026-10-04T21:00:00+05:00' });
    expect(parseWhen('в пятницу 03.10 в 19:30', ref).starts).toBe('2026-10-03T19:30:00+05:00');
    expect(parseWhen('завтра в 20:00', ref).starts).toBe('2026-09-29T20:00:00+05:00');
    expect(parseWhen('12 января в 18:00', ref).starts).toBe('2027-01-12T18:00:00+05:00');
    expect(parseWhen('скоро', ref)).toEqual({ starts: null, ends: null });
  });
  it('цена: бесплатно, диапазон, «от» — проверь сумму', () => {
    expect(parsePrice('Вход бесплатно')).toMatchObject({ free: true });
    expect(parsePrice('Билеты 2 500 – 4 000 ₸')).toEqual({ min: 2500, max: 4000, free: false, unsure: false });
    expect(parsePrice('Билеты от 3 000 ₸').unsure).toBe(true);
  });
  it('черновик из поста', () => {
    const x = extract('Лекция «Как искать экзопланеты»\nДля всех.\n📍 Национальная библиотека, Абая 14\n1 октября в 19:00\nВход бесплатно', '2026-09-28T07:00:00Z');
    expect(x).toMatchObject({ class: 'event', title: 'Лекция «Как искать экзопланеты»', category: 'lecture', venue_name: 'Национальная библиотека', address: 'Абая 14', is_free: true });
    expect(x.confidence).toBeLessThan(0.9);
  });
});

describe('дубли и площадки', () => {
  it('одно событие из разных каналов склеивается', () => {
    expect(similarity('Аниме-выставка «Токио в Алматы»', 'Токио в Алматы — аниме-выставка')).toBeGreaterThan(0.5);
    const known = [{ id: 'a', title: 'Аниме-выставка «Токио в Алматы»', starts_at: '2026-10-03T11:00:00+05:00', venue_name: 'ТРЦ Mega' }];
    expect(findDuplicate({ title: 'Токио в Алматы: аниме-выставка', starts_at: '2026-10-03T12:00:00+05:00', venue_name: null }, known)?.id).toBe('a');
    expect(findDuplicate({ title: 'Токио в Алматы: аниме-выставка', starts_at: '2026-10-10T12:00:00+05:00', venue_name: null }, known)).toBeNull();
    expect(findDuplicate({ title: 'Лекция о джазе', starts_at: '2026-10-03T12:00:00+05:00', venue_name: null }, known)).toBeNull();
  });
  it('площадка по алиасу', () => {
    expect(matchVenue('Мега Алма-Ата', null, venues)?.id).toBe('v-mega');
    expect(matchVenue(null, 'Нацбиблиотека, Абая 14', venues)?.id).toBe('v-lib');
    expect(matchVenue('Бар «Барабан»', 'Жибек Жолы 50', venues)).toBeNull();
  });
  it('размытый адрес — модератору', () => {
    expect(isVague('в парке Горького')).toBe(true);
    expect(isVague('адрес в центре')).toBe(true);
    expect(isVague('Жибек Жолы 50')).toBe(false);
  });
});

describe('публикация', () => {
  it('сразу на карту — только доверие + настройка + 95% + без флагов', () => {
    expect(autoPublish(source, 0.96, [])).toBe(true);
    expect(autoPublish(source, 0.94, [])).toBe(false);
    expect(autoPublish(source, 0.99, ['needs_pin'])).toBe(false);
    expect(autoPublish({ ...source, trusted: false }, 0.99, [])).toBe(false);
    expect(autoPublish({ ...source, auto_publish: false }, 0.99, [])).toBe(false);
  });
  it('черновик: известная площадка без геокодера, неизвестная — геокодер', async () => {
    const post: RawPost = { sourceId: 's', externalId: '1', url: 'u', text: '', images: ['img'], postedAt: null };
    const base = extract('Стендап\n📍 Бар «Барабан», Жибек Жолы 50\n4 октября в 20:00\nБилеты 3 000 ₸', '2026-09-28T07:00:00Z');
    const geocode = jest.fn(async () => ({ lat: 43.26, lon: 76.95 }));
    const d = await buildDraft({ ...base, confidence: 0.97 }, post, source, venues, geocode);
    expect(geocode).toHaveBeenCalledWith('Бар «Барабан», Жибек Жолы 50');
    expect(d).toMatchObject({ point: { lat: 43.26, lon: 76.95 }, flags: [], status: 'published', cover_url: 'img', price_min: 3000 });
    const nowhere = await buildDraft({ ...base, confidence: 0.97 }, post, source, venues, async () => null);
    expect(nowhere).toMatchObject({ flags: ['needs_pin'], status: 'draft' });
  });
});

describe('весь проход на примерах', () => {
  it('fixtures: 4 черновика, по одному мусору каждого вида, дубль и отмена', async () => {
    const posts = [...parseChannel(fx('telegram.html'), 's'), ...(JSON.parse(fx('posts.json')) as RawPost[])];
    const understand = async (p: RawPost) => ({ ...extract(p.text, p.postedAt), by: 'heuristics' as const });
    const known = [{ id: 'jazz', title: 'Джаз во дворе', starts_at: '2026-10-03T19:30:00+05:00', venue_name: 'Панфилова 110' }];
    const res = await processPosts(posts, { ...source, trusted: false }, { understand, geocode: async () => null, venues, known });
    expect(summary(res)).toEqual({ posts: 9, events: 4, ad: 1, meme: 1, not_almaty: 1, duplicate: 1, cancel: 1, unclear: 0, published: 0 });
    const cancel = res.find((r) => r.kind === 'cancel');
    expect(cancel).toMatchObject({ of: { id: 'jazz' }, sure: false });
  });
});

describe('Сайт sxodim.com', () => {
  it('страница события → пост с датой, местом и ценой', () => {
    const post = parseSxodimEvent(fx('sxodim-event.html'), 'https://sxodim.com/almaty/event/koncert-dosekesh', 's');
    expect(post).toMatchObject({ externalId: 'koncert-dosekesh', images: [expect.stringContaining('sxodim.com/uploads')] });
    expect(post!.text).toContain('Когда: 2026-10-30T19:00:00+05:00');
    expect(post!.text).toContain('ул. Барибаева, 36');
    expect(post!.text).toContain('Цена: от 30000 ₸');
    expect(parseSxodimList('<a href="https://sxodim.com/almaty/event/a-b">x</a><a href="https://sxodim.com/almaty/event/a-b">y</a>')).toEqual(['https://sxodim.com/almaty/event/a-b']);
    expect(parseSxodimEvent('<html></html>', 'u', 's')).toBeNull();
  });
});

describe('Поиск через Gemini', () => {
  const searchSource: Source = { id: 'g', kind: 'search', handle: 'gemini', title: 'Поиск · Gemini', trusted: false, auto_publish: false, enabled: true, cursor: null };

  it('задание короткое: даты, тема, только JSON', () => {
    const p = topicPrompt('стендап', '2026-10-05', '2026-10-12');
    expect(p).toContain('с 2026-10-05 по 2026-10-12');
    expect(p).toContain('Тема: стендап');
    expect(p).toContain('только JSON');
    expect(p.length).toBeLessThan(800);
  });

  it('ответ Gemini API: текст, ссылки поиска, расход', () => {
    const r = readResponse({
      candidates: [{ content: { parts: [{ text: '[{"title":"Nazareth",' }, { text: '"starts_at":"2026-10-11T19:00:00+05:00","url":"https://a.kz/n"}]' }] }, groundingMetadata: { groundingChunks: [{ web: { uri: 'https://vertexaisearch.cloud.google.com/x' } }], webSearchQueries: ['nazareth almaty', 'концерт'] } }],
      usageMetadata: { promptTokenCount: 120, candidatesTokenCount: 300, thoughtsTokenCount: 50 },
    });
    expect(parseGeminiOutput(r.text).map((f) => f.title)).toEqual(['Nazareth']);
    expect(r.links).toHaveLength(1);
    expect(r.usage).toEqual({ prompt: 120, output: 350, searches: 2, sources: 1 });
    expect(readResponse({}).text).toBe('');
  });

  it('проверка страницы: чужая ссылка — прочь; дата из разметки и картинка — со страницы', () => {
    const f = { title: 'Стендап-шоу «Подкаты»', category: 'standup', starts_at: '2026-10-09T21:00:00+05:00', url: 'https://a.kz/x', confidence: 0.9 };
    expect(judgePage(f, '<html>Распродажа обуви</html>', 'https://a.kz/x')).toBeNull();
    const html = '<meta property="og:image" content="/p.jpg"><script type="application/ld+json">{"@type":"Event","startDate":"2026-10-10T21:00:00+05:00"}</script><h1>Подкаты</h1>';
    const out = judgePage(f, html, 'https://site.kz/event/1');
    expect(out).toMatchObject({ url: 'https://site.kz/event/1', image_url: 'https://site.kz/p.jpg', starts_at: '2026-10-10T21:00:00+05:00', confidence: 0.7 });
    expect(ldStart('<script type="application/ld+json">{"@graph":[{"@type":"MusicEvent","startDate":"2026-10-11"}]}</script>')).toBe('2026-10-11');
  });

  it('окно дат и дубли внутри запуска', () => {
    const base = { category: 'concert', url: 'https://a.kz/1' };
    const list = finalize([
      { ...base, title: 'Nazareth', starts_at: '2026-10-11T19:00:00+05:00' },
      { ...base, url: 'https://b.kz/2', title: 'NAZARETH', starts_at: '2026-10-11T20:00:00+05:00' },
      { ...base, url: 'https://c.kz/3', title: 'Прошлое', starts_at: '2026-09-01T19:00:00+05:00' },
      { ...base, url: 'https://d.kz/4', title: 'Выставка', starts_at: '2026-09-01T10:00:00+05:00', ends_at: '2026-11-08T18:00:00+05:00' },
    ], '2026-10-05', '2026-10-12');
    expect(list.map((f) => f.title)).toEqual(['Nazareth', 'Выставка']);
  });

  it('разбирает ответ (обёртка CLI, массив в ```json) и отбрасывает событие без даты', () => {
    const found = parseGeminiOutput(fx('gemini-search.json'));
    expect(found.map((f) => f.title)).toEqual(['Стендап-шоу «Подкаты»', 'Nazareth', 'TODES — «Превью»', 'Denis Ten Memorial Challenge']);
    expect(parseGeminiOutput('ничего не нашёл')).toEqual([]);
    expect(parseGeminiOutput('[{"title":"Арт-маркет","starts_at":"2026-10-05T19:00:00+05:00","url":"https://a.kz"}]')).toHaveLength(1);
  });

  it('событие → пост и готовый разбор; одинаковое событие — один и тот же id', () => {
    const [f] = parseGeminiOutput(fx('gemini-search.json'));
    const { post, x } = toPost(f, 'g');
    expect(post.externalId).toBe(externalId({ ...f, title: '  СТЕНДАП-шоу «Подкаты» ' }));
    expect(post.url).toBe('https://sxodim.com/almaty/event/stendap-shou-podkaty-9-oktyabrya');
    expect(x).toMatchObject({ class: 'event', category: 'standup', price_min: 3000, price_unsure: false, venue_name: 'Monroe Bar' });
    const free = toPost(parseGeminiOutput(fx('gemini-search.json'))[3], 'g');
    expect(free.x).toMatchObject({ is_free: true, is_long: true, price_unsure: false });
  });

  it('картинка: og:image со страницы, относительный адрес → полный', () => {
    expect(ogImage('<meta property="og:image" content="/img/poster.jpg">', 'https://site.kz/event/1')).toBe('https://site.kz/img/poster.jpg');
    expect(ogImage('<meta content="https://cdn.kz/a.png" property="og:image">', 'https://x.kz')).toBe('https://cdn.kz/a.png');
    expect(ogImage('<title>нет</title>', 'https://x.kz')).toBeNull();
  });

  it('всё найденное идёт только в «Согласование», даже при высокой уверенности', async () => {
    const items = parseGeminiOutput(fx('gemini-search.json')).map((f) => toPost({ ...f, confidence: 0.99 }, 'g'));
    const byId = new Map(items.map((i) => [i.post.externalId, i.x]));
    const results = await processPosts(items.map((i) => i.post), searchSource, {
      understand: async (p: RawPost) => ({ ...byId.get(p.externalId)!, by: 'ai' as const }),
      geocode: async () => null,
      venues,
      known: [],
    });
    const drafts = results.filter((r) => r.kind === 'draft');
    expect(drafts).toHaveLength(4);
    for (const r of drafts) if (r.kind === 'draft') expect(r.draft.status).toBe('draft');
    const naz = drafts.find((r) => r.kind === 'draft' && r.draft.title === 'Nazareth');
    expect(naz?.kind === 'draft' && naz.draft.cover_url).toBe('https://sxodim.com/uploads/nazareth.jpg');
  });
});
