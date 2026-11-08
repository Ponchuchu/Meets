import { eventSprite, mallSprite, spotSprite } from '../map/symbols';
import { SPRITES } from '../map/sprites';
import { symbolsGeo } from '../map/symbolsGeo';

test('значок события: место важнее категории', () => {
  expect(eventSprite({ category: 'standup', title: 'Стендап в Алматы', venueName: null })).toBe('ev-standup');
  expect(eventSprite({ category: 'sport', title: 'Массовое катание', venueName: 'Медеу' })).toBe('pl-medeu');
  expect(mallSprite('Dostyk Plaza')).toBe('mall-dome');
  expect(mallSprite('MEGA Park')).toBe('mall-stripes');
  expect(mallSprite('ТРЦ Неизвестный')).toBe('pl-shopping');
});

test('значки в GeoJSON: размер в долях картинки, точки без координат отбрасываются', () => {
  const fc = symbolsGeo([
    { id: 'a', lat: 43.2, lon: 76.9, icon: 'ev-concert', size: 45, sort: 10 },
    { id: 'b', lat: NaN, lon: 76.9, icon: 'ev-concert', size: 45, sort: 10 },
  ], 64);
  expect(fc.features).toHaveLength(1);
  expect(fc.features[0].properties).toMatchObject({ id: 'a', sz: 45 / 64, dot: '', op: 1, text: '' });
});

test('значки владельца: Терренкур, бильярд, ТРЦ — свои картинки; для каждого раздела и вида места значок есть', () => {
  expect(eventSprite({ category: 'hike', title: 'Прогулка по Терренкуру', venueName: null })).toBe('pl-terrenkur');
  expect(eventSprite({ category: 'games', title: 'Турнир по бильярду', venueName: null })).toBe('pl-billiard');
  expect(eventSprite({ category: 'music', title: 'Вечер органной музыки', venueName: 'Филармония' })).toBe('ev-orchestra');
  expect(spotSprite({ kind: 'park', name: 'Терренкур' })).toBe('pl-terrenkur');
  expect(mallSprite('Esentai Mall')).toBe('mall-tower');
  for (const c of ['music', 'standup', 'art', 'hike', 'games', 'food', 'sport', 'talks', 'movie', 'theatre', 'lecture', 'meetup', 'party', 'bike', 'concert'] as const)
    expect(SPRITES[eventSprite({ category: c, title: 'x', venueName: null })]).toBeDefined();
  for (const k of ['ski', 'skate', 'cable', 'wheel', 'bowling', 'trampoline', 'climb', 'quest', 'vr', 'golf', 'paintball', 'aqua', 'photo', 'zipline', 'park', 'museum', 'zoo', 'garden', 'view', 'fun', 'billiards', 'gallery'] as const)
    expect(SPRITES[spotSprite({ kind: k, name: 'x' })]).toBeDefined();
});

test('значок события: название важнее бара', () => {
  expect(eventSprite({ category: 'standup', title: 'Стендап: открытый микрофон', venueName: 'Бар «Гараж»' })).toBe('ev-standup');
});

test('счётчик в слое карты точный, одиночные места без цифры и невалидные точки не рисуются', () => {
  const base = { lat: 43.2, lon: 76.9, icon: 'ev-concert' as const, size: 40, sort: 10, dot: '#F0521F' };
  const fc = symbolsGeo([
    { ...base, id: 'group', count: 1234 },
    { ...base, id: 'one' },
    { ...base, id: 'invalid-count', count: NaN },
    { ...base, id: 'invalid-coordinates', lon: 181, count: 100 },
  ], 64);
  expect(fc.features.map(f => f.properties.id)).toEqual(['group', 'one', 'invalid-count']);
  expect(fc.features[0].properties).toMatchObject({ count: 1234, countText: '1234' });
  expect(fc.features[1].properties).toMatchObject({ count: 1, countText: '' });
  expect(fc.features[2].properties).toMatchObject({ count: 1, countText: '' });
});
