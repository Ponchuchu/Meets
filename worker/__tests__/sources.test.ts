import { obviousAd } from '../src/ai.ts';
import { pickKimiModel } from '../src/kimi.ts';
import { processPosts } from '../src/pipeline.ts';
import { balanced, finalize, mergeInto, startsInWindow, type Found } from '../src/search.ts';
import { guessCategory, sxodimFound } from '../src/sites.ts';
import type { Extraction, RawPost, Source } from '../src/types.ts';
import { localTime, parseYandexList, sessions, ticketPrices, yandexFound } from '../src/yandex.ts';
import { splitQuery } from '../src/venues.ts';

const f = (over: Partial<Found>): Found => ({ title: 'Концерт', category: 'concert', starts_at: '2026-10-15T20:00:00+05:00', url: 'https://a.kz/1', ...over });

describe('склейка событий с разных сайтов', () => {
  it('то же событие на двух сайтах — одна карточка, пустые поля берутся со второго сайта', () => {
    const yandex = f({ title: 'Миша Лузин', url: 'https://y/1', venue_name: 'Motor Club', lat: 43.26, lon: 76.94, source_name: 'Яндекс Афиша', confidence: 0.85 });
    const sxodim = f({ title: 'Концерт Миши Лузина', url: 'https://s/1', venue_name: 'Motor Club', price_min: 7000, image_url: 'https://s/p.jpg', source_name: 'Sxodim', confidence: 0.85 });
    const out = finalize([yandex, sxodim], '2026-10-12', '2026-10-19');
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ lat: 43.26, price_min: 7000, image_url: 'https://s/p.jpg', source_name: 'Яндекс Афиша + Sxodim' });
    expect(out[0].confidence).toBeCloseTo(0.9);
  });

  it('разные сеансы с одной ссылкой — разные карточки; разные площадки в один день — тоже', () => {
    const a = f({ title: 'Стендап', url: 'https://y/show', starts_at: '2026-10-15T21:00:00+05:00' });
    const b = f({ title: 'Стендап', url: 'https://y/show', starts_at: '2026-10-16T21:00:00+05:00' });
    expect(finalize([a, b], '2026-10-12', '2026-10-19')).toHaveLength(2);
    const c = f({ title: 'Джаз', venue_name: 'EverJazz', url: 'https://x/1' });
    const d = f({ title: 'Джаз', venue_name: 'Almaty Arena', url: 'https://x/2' });
    expect(finalize([c, d], '2026-10-12', '2026-10-19')).toHaveLength(2);
  });

  it('события вне окна дат отбрасываются', () => {
    expect(finalize([f({ starts_at: '2026-11-20T20:00:00+05:00' })], '2026-10-12', '2026-10-19')).toHaveLength(0);
  });

  it('mergeInto не затирает уже заполненное', () => {
    const a = f({ price_min: 5000, image_url: 'https://a/img.jpg' });
    mergeInto(a, f({ price_min: 9000, image_url: 'https://b/img.jpg' }));
    expect(a).toMatchObject({ price_min: 5000, image_url: 'https://a/img.jpg' });
  });
});

describe('окно дат и баланс', () => {
  it('тур, начавшийся давно, не проходит; выставка, которая идёт и скоро закончится, проходит', () => {
    expect(startsInWindow(f({ starts_at: '2025-06-28T10:00:00+05:00', ends_at: '2026-12-30T10:00:00+05:00', category: 'hike' }), '2026-10-12')).toBe(false);
    expect(startsInWindow(f({ starts_at: '2026-10-01T10:00:00+05:00', ends_at: '2026-11-15T10:00:00+05:00', category: 'art' }), '2026-10-12')).toBe(true);
    expect(startsInWindow(f({ starts_at: '2026-10-13T10:00:00+05:00' }), '2026-10-12')).toBe(true);
  });

  it('стендап не вытесняет остальные категории', () => {
    const list = [
      ...Array.from({ length: 10 }, (_, i) => f({ category: 'standup', title: `Стендап ${i}`, starts_at: `2026-10-${12 + (i % 5)}T21:00:00+05:00` })),
      f({ category: 'concert', title: 'Концерт' }),
      f({ category: 'theatre', title: 'Спектакль' }),
    ];
    const picked = balanced(list, 4);
    expect(picked).toHaveLength(4);
    expect(picked.map((x) => x.category)).toEqual(expect.arrayContaining(['concert', 'theatre']));
  });
});

describe('Sxodim', () => {
  const ld = (name: string, address: string, extra = '') => `<script type="application/ld+json">${JSON.stringify({ '@type': 'Event', name, startDate: '2026-10-15T20:00:00+05:00', image: ['https://s/p.jpg'], location: { name, address: { streetAddress: address } }, offers: { price: 3000 }, ...JSON.parse(extra || '{}') })}</script>`;

  it('площадка отделяется от адреса: у Sxodim «место» = название события', () => {
    const r = sxodimFound(ld('Концерт Миши', 'Дворец Республики, пр. Достык, 56'), 'https://s/e');
    expect(r).toMatchObject({ venue_name: 'Дворец Республики', address: 'пр. Достык, 56, Алматы', price_min: 3000, image_url: 'https://s/p.jpg', category: 'concert' });
  });

  it('если адрес начинается с улицы, площадки нет, но адрес остаётся', () => {
    const r = sxodimFound(ld('Йога', 'ул. Жандосова, 1/1'), 'https://s/e');
    expect(r).toMatchObject({ venue_name: null, address: 'ул. Жандосова, 1/1, Алматы' });
  });

  it('отменённое событие пропускается; категории по ключевым словам', () => {
    expect(sxodimFound(ld('Шоу', 'ул. Абая, 1', '{"eventStatus":"https://schema.org/EventCancelled"}'), 'https://s/e')).toBeNull();
    expect(guessCategory('Стендап-шоу «Новые шутки»')).toBe('standup');
    expect(guessCategory('Вечеринка VIHOD Halloween')).toBe('party');
    expect(guessCategory('Экскурсия на Большое озеро')).toBe('hike');
    expect(guessCategory('Что-то непонятное')).toBe('meetup');
  });
});

describe('Яндекс Афиша', () => {
  const page = `<script type="application/ld+json">${JSON.stringify({
    '@type': 'MusicEvent', name: 'Kreator', image: 'https://img/k.jpg', startDate: '2026-11-18T19:00:00.000Z',
    location: { name: 'Бакшасарай', address: { streetAddress: 'ул. Тимирязева, 42' }, geo: { latitude: 43.224, longitude: 76.909 } },
  })}</script>
  "Ticket:1":{"__typename":"Ticket","id":"1","price":{"__typename":"TicketPriceRange","currency":"kzt","min":3000000,"max":3000000}}
  {"__typename":"ScheduleSession","date":"2026-11-18","datetime":"2026-11-18T19:00:00","ticket":{"__ref":"Ticket:1"}}
  {"__typename":"ScheduleSession","date":"2026-11-19","datetime":"2026-11-19T19:00:00","ticket":{"__ref":"Ticket:1"}}`;

  it('время с Z — местное, цена в тиынах переводится в тенге', () => {
    expect(localTime('2026-11-06T21:00:00.000Z')).toBe('2026-11-06T21:00:00+05:00');
    expect(localTime('2026-10-12')).toBe('2026-10-12');
    expect(ticketPrices(page).byId.get('1')).toBe(30000);
  });

  it('сеансы, цена, координаты и фото берутся со страницы', () => {
    expect(sessions(page).map((x) => x.at)).toEqual(['2026-11-18T19:00:00+05:00', '2026-11-19T19:00:00+05:00']);
    const r = yandexFound(page, 'https://afisha.yandex.kz/almaty/concert/kreator', '2026-11-01');
    expect(r).toHaveLength(2);
    expect(r[0]).toMatchObject({ title: 'Kreator', venue_name: 'Бакшасарай', price_min: 30000, lat: 43.224, lon: 76.909, image_url: 'https://img/k.jpg', category: 'concert' });
  });

  it('событие в другой стране отбрасывается', () => {
    const far = page.replace('43.224', '24.481').replace('76.909', '54.606');
    expect(yandexFound(far, 'https://afisha.yandex.kz/almaty/festival/x')).toHaveLength(0);
  });

  it('ссылки на события берутся и с хвостом #schedule', () => {
    const html = '<a href="/almaty/concert/kreator-2026-11-18#schedule"></a><a href="/almaty/concert/places/x"></a><a href="/almaty/cinema/film"></a>';
    expect(parseYandexList(html)).toEqual(['https://afisha.yandex.kz/almaty/concert/kreator-2026-11-18']);
  });
});

describe('адреса для геокодера', () => {
  it.each([
    ['Джаз-клуб EverJazz, ул. Жандосова, 1/1, Алматы', { venue: 'Джаз-клуб EverJazz', street: 'Жандосова', house: '1/1' }],
    ['Hoper’s bar, ул. Гагарина. 93а, Алматы', { venue: 'Hoper’s bar', street: 'Гагарина', house: '93а' }],
    ['Пинта, Әуезов к. 84А, Алматы', { venue: 'Пинта', street: 'Ауэзова', house: '84А' }],
    ['Open Cinema Almaty, ул. Жандосова 58/1, 3 этаж (вход со стороны Айманова), Алматы', { venue: 'Open Cinema Almaty', street: 'Жандосова', house: '58/1' }],
    ['Бар «Барабан», Жибек Жолы 50', { venue: 'Бар «Барабан»', street: 'Жибек Жолы', house: '50' }],
  ])('%s', (q, want) => {
    expect(splitQuery(q)).toEqual(want);
  });
});

describe('Kimi', () => {
  it('для поиска берётся k2.6 без «thinking» и без кодовых моделей', () => {
    expect(pickKimiModel(['kimi-k2.7-code', 'kimi-k3', 'kimi-k2.6', 'kimi-k2-thinking'])).toBe('kimi-k2.6');
    expect(pickKimiModel(['kimi-k2.7-code-highspeed', 'kimi-k3'])).toBe('kimi-k3');
    expect(pickKimiModel(['moonshot-v1-8k', 'moonshot-v1-32k'])).toBe('moonshot-v1-32k');
    expect(pickKimiModel([])).toBeNull();
  });
});

describe('Telegram: что не отправляем в ИИ и что не принимаем', () => {
  it('явная реклама без даты отсеивается без ИИ, событие с датой — нет', () => {
    expect(obviousAd('Скидка 30% по промокоду RYADOM на доставку суши!')).toBe(true);
    expect(obviousAd('Розыгрыш билетов, подпишись на канал')).toBe(true);
    expect(obviousAd('Скидка на билеты! Концерт 15 октября, 19:00, вход свободный')).toBe(false);
    expect(obviousAd('Джем-сейшн в субботу в EverJazz, скидка студентам')).toBe(false);
    expect(obviousAd('Рынок выходного дня на Казахфильме')).toBe(false);
  });

  const src: Source = { id: 's', kind: 'telegram', handle: 'afisha_almaty', title: 'Telegram', trusted: false, auto_publish: false, enabled: true, cursor: null };
  const post = (id: string): RawPost => ({ sourceId: 's', externalId: id, url: `https://t.me/x/${id}`, text: 'Концерт', images: [], postedAt: null });
  const ex = (over: Partial<Extraction>): Extraction => ({
    class: 'event', title: 'Концерт', category: 'concert', tags: [], starts_at: '2026-10-05T20:00:00+05:00', ends_at: null, is_long: false, venue_name: null, address: null,
    address_note: null, price_min: null, price_max: null, is_free: false, price_unsure: false, about: '', organizer: null, confidence: 0.9, cancel_of: null, ...over,
  });

  it('событие, которое уже закончилось, не принимается (если задано «сейчас»)', async () => {
    const deps = { understand: async () => ({ ...ex({}), by: 'ai' as const }), geocode: async () => null, venues: [], known: [] };
    const past = await processPosts([post('1')], src, { ...deps, now: new Date('2026-10-11T12:00:00+05:00') });
    expect(past[0]).toMatchObject({ kind: 'unclear', reason: 'уже прошло' });
    const future = await processPosts([post('2')], src, { ...deps, now: new Date('2026-10-01T12:00:00+05:00') });
    expect(future[0].kind).toBe('draft');
  });

  it('идущая сейчас выставка (конец в будущем) принимается', async () => {
    const deps = { understand: async () => ({ ...ex({ starts_at: '2026-09-20T10:00:00+05:00', ends_at: '2026-10-30T20:00:00+05:00', is_long: true }), by: 'ai' as const }), geocode: async () => null, venues: [], known: [] };
    const r = await processPosts([post('3')], src, { ...deps, now: new Date('2026-10-11T12:00:00+05:00') });
    expect(r[0].kind).toBe('draft');
  });
});
