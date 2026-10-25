import { demoProfile } from '../data/demo';
import { BADGES, badgeStates, sortBadges } from '../profile/badges';
import { cellOf, cityPercent, levelOf, levelProgress, nextLevelHint } from '../profile/city';
import { DEFAULT_MARKER, speedLabel } from '../state/profile';

import { rankFor, weekDays } from '../profile/stepsSocial';

describe('открытый город', () => {
  it('сота h3 разрешения 8', () => {
    const c = cellOf(43.2567, 76.9453);
    expect(c).toMatch(/^88/);
    expect(cellOf(43.2568, 76.9454)).toBe(c); // соседние точки — одна сота
  });
  it('демо: 37 мест из 185 — 20%, уровень 4 «Горожанин», до 25% — ещё 10 мест', () => {
    const p = demoProfile();
    const pct = cityPercent(p.visitedCells, p.eventCells);
    expect(p.visitedCells).toHaveLength(37);
    expect(pct).toBe(20);
    expect(levelOf(pct)).toMatchObject({ n: 4, name: 'Горожанин' });
    expect(nextLevelHint(37, 185)).toBe('до 25% — ещё 10 мест');
  });
  it('% считается только от сот, где бывают события', () => {
    expect(cityPercent(['a', 'b', 'x'], ['a', 'b', 'c', 'd'])).toBe(50);
    expect(cityPercent([], [])).toBe(0);
  });
  it('уровни', () => {
    expect(levelOf(0).name).toBe('Турист');
    expect(levelOf(5).name).toBe('Гость');
    expect(levelOf(60).name).toBe('Легенда');
    expect(levelProgress(20)).toBeCloseTo(0.5);
    expect(nextLevelHint(120, 185)).toBeNull();
  });
});

describe('значки', () => {
  it('всего 30, имена из макета на месте', () => {
    expect(BADGES).toHaveLength(30);
    for (const n of ['Открыватель', 'Выше города', 'Хозяин вечера', 'Три страны', 'Пять городов', 'Свой человек', 'Ночная смена', 'Все районы', 'Покоритель', 'Плёночник', 'Смешинка', 'Джазмен', 'Душа компании']) {
      expect(BADGES.map((b) => b.name)).toContain(n);
    }
    expect(new Set(BADGES.map((b) => b.id)).size).toBe(30);
  });
  it('демо: 6 из 30, начатые идут следом', () => {
    const list = sortBadges(badgeStates(demoProfile().badgeProgress));
    expect(list.filter((b) => b.got)).toHaveLength(6);
    expect(list.slice(0, 6).every((b) => b.got)).toBe(true);
    expect(list[6].got).toBe(false);
    expect(list[6].progress).toBeGreaterThan(0);
  });
});

describe('мой значок', () => {
  it('скорость: точно / примерно / просто, невидимка скрывает', () => {
    expect(speedLabel(12, DEFAULT_MARKER)).toBe('12 КМ/Ч');
    expect(speedLabel(12, { ...DEFAULT_MARKER, speedMode: 'approx' })).toBe('НА САМОКАТЕ');
    expect(speedLabel(12, { ...DEFAULT_MARKER, speedMode: 'simple' })).toBe('В ПУТИ');
    expect(speedLabel(2, DEFAULT_MARKER)).toBeNull();
    expect(speedLabel(12, { ...DEFAULT_MARKER, invisible: true })).toBeNull();
    expect(speedLabel(12, { ...DEFAULT_MARKER, showMoving: false })).toBeNull();
  });
});
describe('шаги по дням (FIX5)', () => {
  it('неделя с понедельника и прошлая неделя', () => {
    expect(weekDays('2026-10-25')).toEqual(['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25']);
    expect(weekDays('2026-10-25', -1)[0]).toBe('2026-10-12');
  });
  it('рейтинг за день и за неделю', () => {
    const rows = [
      { user_id: 'a', name: 'А', day: '2026-10-24', steps: 5000 }, { user_id: 'a', name: 'А', day: '2026-10-25', steps: 1000 },
      { user_id: 'b', name: 'Б', day: '2026-10-25', steps: 3000 }, { user_id: 'c', name: 'В', day: null, steps: 0 },
    ];
    expect(rankFor(rows, ['2026-10-25']).map((r) => [r.user_id, r.total])).toEqual([['b', 3000], ['a', 1000], ['c', 0]]);
    expect(rankFor(rows, weekDays('2026-10-25')).map((r) => r.user_id)).toEqual(['a', 'b', 'c']);
  });
});
