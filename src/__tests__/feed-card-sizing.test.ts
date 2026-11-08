import { fitFeedCard, sameFeedMeasurement } from '../feed/cardLayout';

it('горизонтальная афиша и натуральное тело дают компактную карточку без остатка', () => {
  expect(fitFeedCard(360, 540, 200, 2)).toEqual({ mediaHeight: 180, height: 380 });
  expect(fitFeedCard(360, 540, 140, 3)).toEqual({ mediaHeight: 120, height: 260 });
});

it('портрет, большой шрифт и небольшой экран ограничивают медиа, не высоту фактов', () => {
  const portrait = fitFeedCard(360, 540, 210, 0.55);
  expect(portrait).toEqual({ mediaHeight: 330, height: 540 });
  const small = fitFeedCard(296, 240, 155, 1.78);
  expect(small).toEqual({ mediaHeight: 85, height: 240 });
  expect(small.height - small.mediaHeight).toBe(155);
  for (const aspect of [0.3, 0.6, 1, 1.78, 3.5, NaN, 0, null]) {
    const result = fitFeedCard(296, 240, 155, aspect);
    expect(Number.isFinite(result.height)).toBe(true);
    expect(result.height).toBeLessThanOrEqual(240);
    expect(result.height - result.mediaHeight).toBe(155);
  }
});

it('изменение ширины, доступной высоты или масштаба шрифта инвалидирует измерение', () => {
  const m = { height: 380, mediaHeight: 180, width: 360, maxHeight: 540, fontScale: 1 };
  expect(sameFeedMeasurement({ ...m }, m)).toBe(true);
  expect(sameFeedMeasurement(undefined, m)).toBe(false);
  expect(sameFeedMeasurement(m, { ...m, width: 320 })).toBe(false);
  expect(sameFeedMeasurement(m, { ...m, fontScale: 1.3 })).toBe(false);
});
