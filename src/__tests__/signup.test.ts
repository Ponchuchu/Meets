import { ageOn, checkBirthDate, formatPhone, isPhoneComplete, maskBirthDate, onlyCode, parseBirthDate } from '../auth/rules';
import { buildStartTaste, buildTimeGrid } from '../reco/startTaste';

const NOW = new Date('2026-09-28T09:00:00Z');

describe('телефон и код', () => {
  it('форматирует номер как в макете', () => {
    expect(formatPhone('7071234567')).toBe('707 123 45 67');
    expect(formatPhone('+7 (707) 123-45-67')).toBe('707 123 45 67');
    expect(formatPhone('8 707 123 45 67')).toBe('707 123 45 67');
    expect(formatPhone('70712')).toBe('707 12');
  });
  it('номер полный только с 10 цифрами', () => {
    expect(isPhoneComplete('707 123 45 67')).toBe(true);
    expect(isPhoneComplete('707 123 45')).toBe(false);
  });
  it('код — только 4 цифры', () => {
    expect(onlyCode('48-21-99')).toBe('4821');
    expect(onlyCode('ab')).toBe('');
  });
});

describe('дата рождения и 18+', () => {
  it('маска ДД.ММ.ГГГГ', () => {
    expect(maskBirthDate('1403')).toBe('14.03');
    expect(maskBirthDate('14032001')).toBe('14.03.2001');
    expect(maskBirthDate('14.03.200199')).toBe('14.03.2001');
  });
  it('несуществующая дата отклоняется', () => {
    expect(parseBirthDate('31.02.2000')).toBeNull();
    expect(parseBirthDate('14.13.2000')).toBeNull();
    expect(parseBirthDate('14.03.2001')).not.toBeNull();
  });
  it('возраст считается по дню рождения', () => {
    expect(ageOn(parseBirthDate('28.09.2008')!, NOW)).toBe(18);
    expect(ageOn(parseBirthDate('29.09.2008')!, NOW)).toBe(17);
  });
  it('младше 18 не пускаем', () => {
    expect(checkBirthDate('29.09.2008', NOW)).toEqual({ ok: false, reason: 'young' });
    expect(checkBirthDate('28.09.2008', NOW)).toEqual({ ok: true, age: 18 });
    expect(checkBirthDate('', NOW)).toEqual({ ok: false, reason: 'empty' });
    expect(checkBirthDate('01.01.2030', NOW)).toEqual({ ok: false, reason: 'future' });
  });
});

describe('стартовый вкус', () => {
  it('интересы превращаются в теги', () => {
    const t = buildStartTaste({ interests: ['music', 'games', 'hike'], times: ['weekday'], withWho: 'friends', budget: 'mid' });
    expect(t.tags['джаз']).toBe(1);
    expect(t.tags['квиз']).toBe(1);
    expect(t.tags['поход']).toBe(1);
    expect(t.tags['стендап']).toBeUndefined();
    expect(t.priceCeiling).toBe(5000);
    expect(t.friendsMultiplier).toBe(2.4);
  });
  it('сетка времени: будни вечером и выходные днём', () => {
    const g = buildTimeGrid(['weekday', 'weekend']);
    expect(g[0].evening).toBe(1); // пн вечер
    expect(g[0].morning).toBeLessThan(0.5);
    expect(g[5].day).toBe(1); // сб день
    expect(g[5].evening).toBeLessThan(0.5);
  });
  it('один и бесплатно — поднимаем «можно одному» и «бесплатно»', () => {
    const t = buildStartTaste({ interests: ['music', 'art', 'food'], times: ['now'], withWho: 'alone', budget: 'free' });
    expect(t.tags['можно одному']).toBeGreaterThan(0);
    expect(t.tags['бесплатно']).toBeGreaterThan(0);
    expect(t.priceCeiling).toBe(0);
    expect(t.timeGrid.every((d) => d.morning >= 0.5)).toBe(true);
  });
});
