import { parseSourceLink } from '../admin/api';
import { demoQueue, metaLine, parseRuDate, sourceLabel } from '../admin/model';
import { deckRows, modelConfidence, tasteRows } from '../admin/taste';
import { demoEvents } from '../data/demo';
import { buildStartTaste } from '../reco/startTaste';

const NOW = new Date('2026-09-28T12:00:00+05:00');

describe('админка: очередь', () => {
  it('строка под названием как в макете', () => {
    expect(metaLine({ startsAt: '2026-10-03T11:00:00+05:00', endsAt: '2026-10-04T21:00:00+05:00', place: 'ТРЦ', priceMin: 2500, priceMax: null, isFree: false }))
      .toBe('сб–вс, 11:00–21:00 · ТРЦ · 2 500 ₸');
    expect(metaLine({ startsAt: '2026-10-01T19:00:00+05:00', place: 'библиотека', priceMin: null, priceMax: null, isFree: true })).toBe('чт, 19:00 · библиотека · бесплатно');
  });
  it('источник капсом', () => {
    expect(sourceLabel('threads', 'almaty.weekend', '')).toBe('THREADS · @ALMATY.WEEKEND');
    expect(sourceLabel('user', 'app', '', 'Айнура')).toBe('ПРЕДЛОЖИЛ ПОЛЬЗОВАТЕЛЬ · АЙНУРА');
  });
  it('демо-очередь: 4 карточки, у вечеринки флаг точки', () => {
    const q = demoQueue(NOW);
    expect(q).toHaveLength(4);
    expect(q.find((x) => x.id === 'q-roof')?.flags).toEqual(['needs_pin']);
  });
  it('дата из предложения', () => {
    expect(parseRuDate('Пт, 2 октября', '20:00', NOW)).toBe('2026-10-02T15:00:00.000Z');
    expect(parseRuDate('когда-нибудь', '20:00', NOW)).toBeNull();
  });
  it('ссылка на источник', () => {
    expect(parseSourceLink('https://t.me/s/afisha_almaty')).toEqual({ kind: 'telegram', handle: 'afisha_almaty', title: 'Telegram · @afisha_almaty' });
    expect(parseSourceLink('threads.net/@almaty.weekend')?.kind).toBe('threads');
    expect(parseSourceLink('afisha.yandex.kz/almaty/')?.handle).toBe('afisha.yandex.kz/almaty');
    expect(parseSourceLink('просто текст')).toBeNull();
  });
});

describe('админка: рекомендации', () => {
  const start = buildStartTaste({ interests: ['music', 'hike', 'games'], times: ['weekday', 'weekend'], withWho: 'friends', budget: 'mid' });
  it('уверенность растёт со свайпами, ответы весят не меньше 20%', () => {
    expect(modelConfidence(0)).toEqual({ confidence: 0, answersWeight: 1 });
    expect(Math.round(modelConfidence(412).confidence * 100)).toBe(73);
    expect(modelConfidence(412).answersWeight).toBe(0.2);
  });
  it('вкус со сдвигом от старта', () => {
    const now = { ...start, tags: { ...start.tags, джаз: (start.tags['джаз'] ?? 0) + 0.2 } };
    expect(tasteRows(now, start).find((r) => r.tag === 'джаз')?.delta).toBeCloseTo(0.2);
  });
  it('колода с правилами: первые — сильные совпадения', () => {
    const rows = deckRows(start, demoEvents(NOW), new Set(), 0, NOW, { novelty: true });
    expect(rows.length).toBeGreaterThan(3);
    expect(rows[0].score.total).toBeGreaterThanOrEqual(rows[3].score.total);
  });
});
