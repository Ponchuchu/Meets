import { computeMetrics, type AnalyticsEvent } from '../analytics/metrics';

const at = (d: number, h = 12) => new Date(Date.UTC(2026, 8, d, h - 5)).toISOString();
const NOW = new Date(at(28, 20));

describe('метрики рекомендаций', () => {
  const shown = (n: number, who = 'a'): AnalyticsEvent[] => Array.from({ length: n }, (_, i) => ({ name: 'card_shown', at: at(27), eventId: `e${i}`, who }));
  it('доля «пойду» и дошли из нажавших', () => {
    const ev: AnalyticsEvent[] = [
      ...shown(20),
      ...['e1', 'e2', 'e3', 'e4'].map((id) => ({ name: 'go' as const, at: at(27), eventId: id, who: 'a' })),
      { name: 'arrived', at: at(28), eventId: 'e1', who: 'a' },
      { name: 'arrived', at: at(28), eventId: 'e9', who: 'a' }, // «Я на месте» без «пойду» не считается
    ];
    const m = computeMetrics(ev, NOW);
    expect(m.goRate).toBe(0.2);
    expect(m.arrivedRate).toBe(0.25);
    expect(m.verdicts).toEqual([]);
  });
  it('выводы: мало «пойду», много отмен', () => {
    const ev: AnalyticsEvent[] = [
      ...shown(40),
      { name: 'go', at: at(27), eventId: 'e1', who: 'a' },
      ...Array.from({ length: 19 }, (_, i) => ({ name: 'skip' as const, at: at(27), eventId: `s${i}`, who: 'a' })),
      { name: 'undo', at: at(27), eventId: 's1', who: 'a' },
    ];
    const m = computeMetrics(ev, NOW);
    expect(m.verdicts).toContain('Меньше 20% «пойду» — промахиваемся со вкусом');
    expect(m.verdicts).toContain('Много отмен и «вернуть» — проблема в жестах, а не во вкусе');
  });
  it('D1 / D7 по первому дню каждого человека', () => {
    const open = (d: number, who: string): AnalyticsEvent => ({ name: 'feed_open', at: at(d), who });
    const ev = [open(10, 'a'), open(11, 'a'), open(17, 'a'), open(10, 'b'), open(27, 'c'), open(28, 'c')];
    const m = computeMetrics(ev, NOW);
    // D1: a вернулся, b нет, c вернулся (27 → 28) → 2/3. D7: a да, b нет, c ещё рано → 1/2.
    expect(m.d1).toBeCloseTo(2 / 3);
    expect(m.d7).toBe(0.5);
  });
  it('пусто — без чисел', () => {
    expect(computeMetrics([], NOW)).toMatchObject({ goRate: null, arrivedRate: null, d1: null, undoRate: null });
  });
});
