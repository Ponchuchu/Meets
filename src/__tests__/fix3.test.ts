// FIX3: награды за шаги, неделя, ночёвки по хозяевам, статус «Спит», линии карты, понятные ошибки поиска.
import { bestStreak, bestWindow, lastWeek, stepAwards } from '../profile/stepAwards';
import { statusOf } from '../live/geo';
import { linesGeo } from '../map/linesGeo';
import { groupSleepovers } from '../profile/sleepovers';


describe('шаги', () => {
  const days = [
    { day: '2026-10-10', steps: 6500 }, { day: '2026-10-11', steps: 7000 }, { day: '2026-10-12', steps: 12000 },
    { day: '2026-10-14', steps: 9000 }, { day: '2026-10-15', steps: 6100 },
  ];
  it('серия считает только дни подряд', () => {
    expect(bestStreak(days, 6000)).toBe(3);
    expect(bestStreak(days, 10000)).toBe(1);
    expect(bestStreak([], 6000)).toBe(0);
  });
  it('окно из 7 дней складывает шаги, пропуски — нули', () => {
    expect(bestWindow(days, 7)).toBe(6500 + 7000 + 12000 + 9000 + 6100);
    expect(bestWindow(days, 1)).toBe(12000);
  });
  it('сегодняшние шаги с телефона свежее сервера', () => {
    const a = stepAwards([{ day: '2026-10-20', steps: 3000 }], { day: '2026-10-20', steps: 10400 });
    expect(a.find(x => x.id === 'steps-first')?.got).toBe(true);
    expect(a.find(x => x.id === 'steps-marathon')?.got).toBe(false);
  });
  it('неделя — 7 дней, последний сегодня', () => {
    const w = lastWeek(days, '2026-10-15', 7000);
    expect(w).toHaveLength(7);
    expect(w[6]).toEqual({ day: '2026-10-15', steps: 7000 });
    expect(w[0].day).toBe('2026-10-09');
    expect(w.find(d => d.day === '2026-10-13')?.steps).toBe(0);
  });
});

describe('статус для друзей', () => {
  const home = [{ kind: 'home' as const, lat: 43.24, lon: 76.9 }];
  it('ночью дома и без движения — «Спит»', () => {
    expect(statusOf({ lat: 43.24, lon: 76.9, speed: 0 }, home, 2)).toBe('sleep');
    expect(statusOf({ lat: 43.24, lon: 76.9, speed: 0 }, home, 14)).toBe('home');
    expect(statusOf({ lat: 43.24, lon: 76.9, speed: 0 }, home)).toBe('home');
    expect(statusOf({ lat: 43.3, lon: 76.9, speed: 0 }, home, 2)).toBeNull();
  });
});

describe('ночёвки', () => {
  it('группируются по хозяину, чаще — выше', () => {
    const g = groupSleepovers([
      { night: '2026-10-01', host_id: 'a', host_name: 'Игорь', host_photo: null, area: 'Самал' },
      { night: '2026-10-03', host_id: null, host_name: null, host_photo: null, area: 'Медеу' },
      { night: '2026-10-05', host_id: 'a', host_name: 'Игорь', host_photo: null, area: 'Самал' },
    ]);
    expect(g[0].name).toBe('Игорь');
    expect(g[0].nights).toHaveLength(2);
    expect(g[1].area).toBe('Медеу');
  });
});

describe('линии карты', () => {
  it('отбрасывают линии из одной точки и неправильные координаты', () => {
    const fc = linesGeo([
      { id: 'ok', coords: [[76.9, 43.2], [76.91, 43.21]], color: '#000' },
      { id: 'one', coords: [[76.9, 43.2]], color: '#000' },
      { id: 'nan', coords: [[Number.NaN, 43.2], [76.9, 43.2]], color: '#000' },
    ]);
    expect(fc.features.map(f => f.id)).toEqual(['ok']);
    expect(linesGeo([]).features).toEqual([]);
  });
});
