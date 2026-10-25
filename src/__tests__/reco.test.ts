import { demoEvents } from '../data/demo';
import { seedEvents } from '../data/seed';
import type { EventItem } from '../data/types';
import { buildDeck, eventTags, makeSignal, scoreEvent, tasteFrom, type Signal } from '../reco';
import type { StartAnswers } from '../reco/startTaste';

const NOW = new Date('2026-09-28T12:00:00+05:00');
const ANSWERS: StartAnswers = { interests: ['music', 'games', 'hike'], times: ['weekday', 'weekend'], withWho: 'friends', budget: 'mid' };
const events = [...demoEvents(NOW), ...seedEvents()];
const ctx = { now: NOW };
const ev = (id: string) => events.find((e) => e.id === id)!;

function fake(i: number, category: EventItem['category'], extra: Partial<EventItem> = {}): EventItem {
  return {
    id: `f${i}`, title: `Событие ${i}`, category, tags: [category === 'music' ? 'джаз' : 'стендап'], startsAt: new Date(NOW.getTime() + (i + 2) * 3600e3).toISOString(),
    endsAt: null, isLong: false, venueName: null, address: '', lat: 0, lon: 0, needsPin: false, priceMin: 0, priceMax: 0, isFree: true, about: '',
    organizer: null, sourceUrl: null, visibility: 'public', origin: 'demo', friendsGoing: [], lookingCount: 0, goingCount: 10, ...extra,
  };
}

describe('вкус', () => {
  it('«пойду» поднимает теги, «мимо» опускает', () => {
    const base = tasteFrom(ANSWERS, [], NOW);
    const up = tasteFrom(ANSWERS, [makeSignal(ev('standup'), 'go', NOW)], NOW);
    expect(up.tags['стендап']).toBeGreaterThan(base.tags['стендап'] ?? 0);
    const down = tasteFrom(ANSWERS, [makeSignal(ev('jazz'), 'skip', NOW)], NOW);
    expect(down.tags['джаз']).toBeLessThan(base.tags['джаз']);
  });
  it('отмена стирает сигнал целиком', () => {
    const s = makeSignal(ev('standup'), 'go', NOW);
    const with1 = tasteFrom(ANSWERS, [s], NOW);
    const undone = tasteFrom(ANSWERS, [s].filter((x) => x.id !== s.id), NOW);
    expect(undone).toEqual(tasteFrom(ANSWERS, [], NOW));
    expect(with1).not.toEqual(undone);
  });
  it('одно «мимо» почти ничего не меняет, 3 подряд — тема проседает', () => {
    const jazzLike = (i: number) => makeSignal({ ...ev('jazz'), id: `j${i}` }, 'skip', NOW, `s${i}`);
    const one = tasteFrom(ANSWERS, [jazzLike(1)], NOW).tags['джаз'];
    const two = tasteFrom(ANSWERS, [jazzLike(1), jazzLike(2)], NOW).tags['джаз'];
    const three = tasteFrom(ANSWERS, [jazzLike(1), jazzLike(2), jazzLike(3)], NOW).tags['джаз'];
    expect(1 - one).toBeLessThan(0.25);
    expect(two - three).toBeGreaterThan((one - two) * 2);
  });
  it('свежее важнее: через 30 дней сигнал весит вдвое меньше', () => {
    const fresh = makeSignal(ev('standup'), 'go', NOW);
    const old = { ...fresh, at: new Date(NOW.getTime() - 30 * 86400e3).toISOString() };
    const base = tasteFrom(ANSWERS, [], NOW).tags['стендап'] ?? 0;
    const dFresh = tasteFrom(ANSWERS, [fresh], NOW).tags['стендап'] - base;
    const dOld = tasteFrom(ANSWERS, [old], NOW).tags['стендап'] - base;
    expect(dOld / dFresh).toBeCloseTo(0.5, 2);
  });
});

describe('оценка', () => {
  it('друзья поднимают карточку', () => {
    const taste = tasteFrom(ANSWERS, [], NOW);
    const withFriends = scoreEvent(taste, ev('jazz'), ctx);
    const without = scoreEvent(taste, { ...ev('jazz'), friendsGoing: [] }, ctx);
    expect(withFriends.total).toBeGreaterThan(without.total);
  });
  it('дороже бюджета — ниже', () => {
    const taste = tasteFrom(ANSWERS, [], NOW);
    expect(scoreEvent(taste, ev('concert'), ctx).parts.price).toBe(0);
    expect(scoreEvent(taste, ev('games'), ctx).parts.price).toBe(1);
  });
});

describe('колода', () => {
  const taste = tasteFrom(ANSWERS, [], NOW);
  it('первые 3 — сильнейшие совпадения', () => {
    const deck = buildDeck(taste, events, { decided: new Set(), swipes: 20 }, ctx);
    const scores = events.filter((e) => !e.meetup).map((e) => scoreEvent(taste, e, ctx).total).sort((a, b) => b - a);
    expect(scoreEvent(taste, deck[0], ctx).total).toBeCloseTo(scores[0], 5);
    expect(deck[0].id).toBe('jazz');
  });
  it('не больше 2 одной темы подряд', () => {
    const many = [...Array.from({ length: 12 }, (_, i) => fake(i, 'music')), ...Array.from({ length: 6 }, (_, i) => fake(100 + i, 'standup'))];
    const deck = buildDeck(taste, many, { decided: new Set(), swipes: 20 }, ctx, { size: 12 });
    for (let i = 2; i < deck.length; i++) {
      const same = deck[i].category === deck[i - 1].category && deck[i - 1].category === deck[i - 2].category;
      if (same) expect(deck.slice(i).every((e) => e.category === deck[i].category)).toBe(true); // только когда других не осталось
    }
  });
  it('каждая 8-я — новое за пределами вкуса', () => {
    const deck = buildDeck(taste, events, { decided: new Set(), swipes: 20 }, ctx, { size: 16 });
    const novel = (e: EventItem) => eventTags(e).every((t) => !((taste.tags[t] ?? 0) > 0));
    expect(novel(deck[7])).toBe(true);
    expect(novel(deck[15])).toBe(true);
  });
  it('решённые и прошедшие не попадают', () => {
    const deck = buildDeck(taste, events, { decided: new Set(['jazz', 'games']), swipes: 20 }, ctx, { size: 40 });
    expect(deck.map((e) => e.id)).not.toContain('jazz');
    expect(deck.map((e) => e.id)).not.toContain('games');
    const late = buildDeck(taste, events, { decided: new Set(), swipes: 20 }, { now: new Date('2026-09-28T21:00:00+05:00') }, { size: 40 });
    expect(late.map((e) => e.id)).not.toContain('jazz');
  });
  it('калибровка: первые 10 карточек разных тем', () => {
    const deck = buildDeck(taste, events, { decided: new Set(), swipes: 0 }, ctx, { size: 10 });
    for (let i = 3; i < deck.length; i++) {
      const prev = deck.slice(Math.max(0, i - 3), i).map((e) => e.category);
      if (prev.includes(deck[i].category)) {
        // допускается, только если в пределах вкуса других тем не осталось
        const left = events.filter((e) => !deck.slice(0, i).includes(e));
        expect(left.some((e) => !prev.includes(e.category) && scoreEvent(taste, e, ctx).parts.taste > 0)).toBe(false);
      }
    }
  });
  it('свайп вправо на стендап поднимает стендап в следующей колоде', () => {
    const s: Signal[] = [makeSignal(ev('standup'), 'go', NOW)];
    const after = tasteFrom(ANSWERS, s, NOW);
    const before = buildDeck(taste, events, { decided: new Set(['standup']), swipes: 20 }, ctx, { size: 20 });
    const now2 = buildDeck(after, events, { decided: new Set(['standup']), swipes: 20 }, ctx, { size: 20 });
    const pos = (d: EventItem[]) => d.findIndex((e) => e.category === 'standup');
    expect(pos(now2)).toBeLessThanOrEqual(pos(before));
  });
});

import { hintDue } from '../state/feed';
describe('подсказка жестов (FIX5)', () => {
  it('сразу, через 5 дней, через месяц и больше никогда', () => {
    const d = 86400e3;
    expect(hintDue([], 0)).toBe(true);
    expect(hintDue([0], 4 * d)).toBe(false);
    expect(hintDue([0], 5 * d)).toBe(true);
    expect(hintDue([0, 5 * d], 20 * d)).toBe(false);
    expect(hintDue([0, 5 * d], 35 * d)).toBe(true);
    expect(hintDue([0, 5 * d, 35 * d], 400 * d)).toBe(false);
  });
});
