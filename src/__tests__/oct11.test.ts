import { friendActivity, previewText } from '../chat/activity';
import { bestMode, maneuverKind } from '../event/navigation';
import { eventFacts } from '../event/facts';
import { cityFix, mapboxLabel, mergeHits, osmLabel } from '../live/addresses';
import { activeCount, DEFAULT_FILTERS, visibleEvents } from '../map/filters';
import { coneRing, metersPerPixel } from '../map/meLayers';
import { explainFailure } from '../../worker/src/robot';

describe('цена, время, место в карточке всегда', () => {
  it('нет данных — честные подписи', () => {
    const f = eventFacts({ startsAt: null, venueName: null, address: '', priceMin: null, priceMax: null, isFree: false });
    expect(f).toMatchObject({ when: 'дата не указана', place: 'место не указано', price: 'цена не указана', missing: 3 });
  });
  it('всё есть', () => {
    const f = eventFacts({ startsAt: '2026-10-17T14:00:00Z', venueName: 'Филармония', address: 'Абая 1', priceMin: 3000, priceMax: null, isFree: false });
    expect(f.when).toBe('сб, 17 окт · 19:00');
    expect(f.place).toBe('Филармония, Абая 1');
    expect(f.price).toBe('3 000 ₸');
    expect(f.missing).toBe(0);
  });
  it('полночь — время не указано; бесплатно', () => {
    const f = eventFacts({ startsAt: '2026-10-17T19:00:00Z', venueName: 'ТРЦ', isFree: true });
    expect(f.when).toContain('время не указано');
    expect(f.price).toBe('бесплатно');
  });
});

describe('фильтры: ближайшая неделя по умолчанию', () => {
  it('по умолчанию включена «Ближайшая неделя», фильтров «включено» нет', () => {
    expect(DEFAULT_FILTERS).toMatchObject({ soon: true, from: 0, to: 6 });
    expect(activeCount(DEFAULT_FILTERS)).toBe(0);
    expect(activeCount({ ...DEFAULT_FILTERS, soon: false })).toBe(1);
    expect(visibleEvents([], DEFAULT_FILTERS, new Date())).toEqual([]);
  });
});

describe('адреса', () => {
  it('Алма-Ата → Алматы, без страны', () => {
    expect(cityFix('улица Есенова 160, Алма-Ата, 050000, Казахстан')).toBe('улица Есенова 160, Алматы, 050000');
    expect(cityFix('Алма Ата')).toBe('Алматы');
  });
  it('подписи Mapbox и OSM коротко', () => {
    expect(mapboxLabel({ id: 'a', text: 'Есенова улица', address: '160', place_name: 'x', center: [76.9, 43.2], place_type: ['address'] })).toBe('Есенова улица 160');
    expect(osmLabel({ place_id: 1, lat: '43.2', lon: '76.9', display_name: 'a, b', name: 'Кофейня', address: { road: 'Абая', house_number: '44' } })).toBe('Кофейня, Абая 44');
  });
  it('дубли в двух источниках склеиваются', () => {
    const a = { id: '1', label: 'Абая 44', lat: 43.2, lon: 76.9 };
    const b = { id: '2', label: 'абая 44', lat: 43.2, lon: 76.9 };
    const c = { id: '3', label: 'Другое', lat: 43.2, lon: 76.9001 };
    expect(mergeHits([a], [b, c]).map((h) => h.id)).toEqual(['1']);
    expect(mergeHits([a], [{ ...c, lat: 43.21 }]).length).toBe(2);
  });
});

describe('навигация', () => {
  it('стрелки манёвров', () => {
    expect(maneuverKind('Поверните направо на улицу Абая')).toBe('right');
    expect(maneuverKind('Слегка поверните налево')).toBe('soft-left');
    expect(maneuverKind('Сделайте разворот')).toBe('uturn');
    expect(maneuverKind('Вы прибыли в пункт назначения')).toBe('flag');
    expect(maneuverKind('Двигайтесь прямо')).toBe('straight');
  });
  it('что лучше: близко — пешком, далеко — быстрее с поправкой на парковку', () => {
    expect(bestMode(10, 4, 20)).toBe('walk');
    expect(bestMode(60, 15, 40)).toBe('car');
    expect(bestMode(60, 40, 35)).toBe('bus');
    expect(bestMode(null, null, null)).toBeNull();
  });
});

describe('моя точка слоями карты', () => {
  it('метры на пиксель падают вдвое с каждым масштабом', () => {
    expect(metersPerPixel(43, 15) / metersPerPixel(43, 16)).toBeCloseTo(2, 5);
  });
  it('конус — замкнутое кольцо от центра', () => {
    const r = coneRing(43.2, 76.9, 90, 15, 50);
    expect(r[0]).toEqual([76.9, 43.2]);
    expect(r[r.length - 1]).toEqual([76.9, 43.2]);
    expect(r[1][0]).toBeGreaterThan(76.9); // направление на восток
  });
});

describe('диалоги: превью и последнее действие', () => {
  it('вложения называются', () => {
    expect(previewText('voice', '')).toBe('Голосовое');
    expect(previewText('text', 'привет')).toBe('привет');
    expect(previewText('sticker', 'Ого')).toBe('Стикер · Ого');
  });
  const events = [
    { id: 'e1', title: 'Джаз во дворе', startsAt: '2026-10-12T14:30:00Z', friendsGoing: ['igor'] },
    { id: 'e2', title: 'Стендап', startsAt: '2026-10-13T14:30:00Z', friendsGoing: ['igor'] },
  ];
  const now = new Date('2026-10-11T10:00:00Z');
  it('приглашение главнее общего плана', () => {
    expect(friendActivity('igor', 'me', events, new Set(['e1']), [{ from_id: 'igor', to_id: 'me', event_id: 'e2', answer: null }], now)).toBe('Зовёт тебя на «Стендап»');
  });
  it('общий план, потом «идёт на», потом ничего', () => {
    expect(friendActivity('igor', 'me', events, new Set(['e1']), [], now)).toBe('Вы оба идёте на «Джаз во дворе»');
    expect(friendActivity('igor', 'me', events, new Set(), [], now)).toBe('Идёт на «Джаз во дворе»');
    expect(friendActivity('anton', 'me', events, new Set(), [], now)).toBeNull();
  });
});

describe('причина ошибки Gemini', () => {
  it('402 — закончились деньги', () => {
    expect(explainFailure('Gemini 402: Your prepayment credits are depleted')).toContain('закончились деньги');
    expect(explainFailure('RESOURCE_EXHAUSTED quota')).toContain('Лимит запросов');
    expect(explainFailure('')).toContain('Журнал');
  });
});

describe('панель разработчика: понятные ошибки', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { explainError, ago } = require('../admin/errors') as typeof import('../admin/errors');
  it('деньги, лимит, ключ, модель, GitHub', () => {
    expect(explainError('Gemini 402: Your prepayment credits are depleted').kind).toBe('money');
    expect(explainError('Kimi 429: rate limit').kind).toBe('limit');
    expect(explainError('Нет KIMI_API_KEY. Добавь ключ').kind).toBe('key');
    expect(explainError('Kimi: модели kimi-x нет').kind).toBe('model');
    expect(explainError('Не удалось запустить workflow на GitHub: 404').kind).toBe('github');
    expect(explainError('Kimi: время вышло').kind).toBe('timeout');
    expect(explainError('что-то странное').kind).toBe('other');
    expect(explainError('что-то странное').title).toBe('Запуск не удался');
  });
  it('«когда»: только что, минуты, сегодня, вчера', () => {
    const now = new Date('2026-10-12T10:00:00Z');
    expect(ago(null, now)).toBe('ещё не запускали');
    expect(ago('2026-10-12T09:59:40Z', now)).toBe('только что');
    expect(ago('2026-10-12T09:30:00Z', now)).toBe('30 мин назад');
    expect(ago('2026-10-12T04:00:00Z', now)).toBe('сегодня 09:00');
    expect(ago('2026-10-11T04:00:00Z', now)).toBe('вчера 09:00');
  });
});
