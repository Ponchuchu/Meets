import { eventSprite, mallSprite } from '../map/symbols';
import { symbolsGeo } from '../map/symbolsGeo';

test('значок события: место важнее категории', () => {
  expect(eventSprite({ category: 'standup', title: 'Стендап в Алматы', venueName: null })).toBe('ev-standup');
  expect(eventSprite({ category: 'sport', title: 'Массовое катание', venueName: 'Медеу' })).toBe('pl-skate');
  expect(mallSprite('Dostyk Plaza')).toBe('mall-dostyk');
  expect(mallSprite('MEGA Park')).toBe('mall-megapark');
  expect(mallSprite('ТРЦ Неизвестный')).toBe('mall-mall');
});

test('значки в GeoJSON: размер в долях картинки, точки без координат отбрасываются', () => {
  const fc = symbolsGeo([
    { id: 'a', lat: 43.2, lon: 76.9, icon: 'ev-music', size: 45, sort: 10 },
    { id: 'b', lat: NaN, lon: 76.9, icon: 'ev-music', size: 45, sort: 10 },
  ], 180);
  expect(fc.features).toHaveLength(1);
  expect(fc.features[0].properties).toMatchObject({ id: 'a', sz: 0.25, dot: '', op: 1, text: '' });
});
