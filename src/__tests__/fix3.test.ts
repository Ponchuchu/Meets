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

describe('соревнования по шагам', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { challengeState } = require('../profile/stepsSocial') as typeof import('../profile/stepsSocial');
  const base = { id: 'c', title: 't', created_by: 'a', my_status: 'joined' as const, starts_on: '2026-10-18', ends_on: '2026-10-24' };
  const members = [
    { user_id: 'a', name: 'Аня', photo_url: null, status: 'joined', steps: 30000 },
    { user_id: 'b', name: 'Боря', photo_url: null, status: 'joined', steps: 42000 },
    { user_id: 'c', name: 'Вова', photo_url: null, status: 'invited', steps: 90000 },
  ];
  it('«кто больше»: лидер среди принявших, дни до конца', () => {
    const s = challengeState({ ...base, kind: 'most', goal: null, members }, '2026-10-20');
    expect(s.leader?.name).toBe('Боря');
    expect(s.daysLeft).toBe(5);
    expect(s.finished).toBe(false);
    expect(s.share(21000)).toBe(0.5);
  });
  it('после последнего дня — победитель', () => {
    const s = challengeState({ ...base, kind: 'most', goal: null, members }, '2026-10-25');
    expect(s.winner?.name).toBe('Боря');
    expect(s.label).toBe('Победил Боря');
  });
  it('«кто первым до цели» заканчивается, когда цель взята', () => {
    const s = challengeState({ ...base, kind: 'goal', goal: 40000, members }, '2026-10-20');
    expect(s.finished).toBe(true);
    expect(s.winner?.name).toBe('Боря');
    expect(s.share(20000)).toBe(0.5);
  });
});
