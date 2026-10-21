import { parseSourceLink } from '../admin/api';
import { demoQueue, metaLine, parseRuDate, sourceLabel } from '../admin/model';
import { isReady, plural, sourceInfo } from '../admin/rules';
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

describe('админка: «Опубликовать всё»', () => {
  const now = NOW.getTime();
  const base = { flags: [] as ('needs_pin' | 'check_price' | 'cancel_reported')[], startsAt: '2026-09-29T19:00:00+05:00', point: { lat: 43.2, lon: 76.9 } };
  it('готово: есть точка, нет «отменили», не закончилось', () => {
    expect(isReady(base, true, now)).toBe(true);
    expect(isReady({ ...base, flags: ['check_price'] }, true, now)).toBe(true);
    expect(isReady({ ...base, flags: ['needs_pin'] }, true, now)).toBe(false);
    expect(isReady({ ...base, flags: ['cancel_reported'] }, true, now)).toBe(false);
    expect(isReady({ ...base, point: null }, true, now)).toBe(false);
    expect(isReady({ ...base, point: null }, false, now)).toBe(true);
    expect(isReady({ ...base, startsAt: '2026-09-27T19:00:00+05:00' }, true, now)).toBe(false);
  });
  it('демо-очередь: вечеринка без точки остаётся на проверку', () => {
    const ready = demoQueue(NOW).filter((x) => isReady(x, false, now)).map((x) => x.id);
    expect(ready).not.toContain('q-roof');
  });
  it('склонение', () => {
    expect([1, 2, 5, 11, 21, 22].map((n) => plural(n, 'событие', 'события', 'событий'))).toEqual(['событие', 'события', 'событий', 'событий', 'событие', 'события']);
  });
});

describe('админка: источники', () => {
  it('@канал — это Telegram', () => {
    expect(parseSourceLink('@afisha_almaty')).toEqual({ kind: 'telegram', handle: 'afisha_almaty', title: 'Telegram · @afisha_almaty' });
  });
  it('тип и вторая строка', () => {
    expect(sourceInfo({ kind: 'site', title: 'afisha.yandex.kz', handle: 'afisha.yandex.kz/almaty' })).toEqual({ type: 'yandex', label: 'Яндекс Афиша', line: 'afisha.yandex.kz/almaty' });
    expect(sourceInfo({ kind: 'site', title: 'sxodim.com', handle: 'sxodim.com/almaty' }).type).toBe('site');
    expect(sourceInfo({ kind: 'telegram', title: 'Telegram · @afisha_almaty', handle: 'afisha_almaty' }).line).toBe('@afisha_almaty');
    expect(sourceInfo({ kind: 'threads', title: 'Threads · @almaty.weekend' }).line).toBe('@almaty.weekend');
    expect(sourceInfo({ kind: 'manual', title: 'Вручную' }).label).toBe('Вручную');
  });
});
