// Обновление интерфейса 20.10: уровень → оттенок медальона.
import { medallionTier } from '../ui/Medallion';

describe('медальон профиля', () => {
  it('оттенок растёт с уровнем', () => {
    expect(medallionTier(1)).toBe(0);
    expect(medallionTier(4)).toBe(0);
    expect(medallionTier(5)).toBe(1);
    expect(medallionTier(9)).toBe(1);
    expect(medallionTier(10)).toBe(2);
  });
});

import { framePath, MAP_FRAMES } from '../map/MapAvatar';
import { badgeIcon, BADGES } from '../profile/badges';
import { toneOf } from '../ui/BadgeMedal';

describe('значок друга на карте', () => {
  it('у каждой рамки своя замкнутая форма в пределах 64×72', () => {
    const shapes = new Set(MAP_FRAMES.map((f) => f.shape));
    expect(shapes.size).toBe(MAP_FRAMES.length);
    for (const f of MAP_FRAMES) {
      const d = framePath(f.shape);
      expect(d.startsWith('M') && d.endsWith('Z')).toBe(true);
      const nums = d.replace(/[MLZ]/g, ' ').trim().split(/\s+/).map(Number);
      expect(Math.min(...nums)).toBeGreaterThan(0);
      expect(Math.max(...nums)).toBeLessThan(64);
    }
  });
});

describe('медали значков', () => {
  it('иконка есть и у значков сервера, и у неизвестных', () => {
    expect(badgeIcon('walker')).toBeTruthy();
    expect(badgeIcon('opener')).toBe(BADGES[0].icon);
    expect(badgeIcon('нет-такого')).toBeTruthy();
  });
  it('цвет медали стабилен для одного значка', () => {
    expect(toneOf('jazz')).toEqual(toneOf('jazz'));
  });
});
