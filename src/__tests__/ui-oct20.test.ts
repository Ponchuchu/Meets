import { framePath, LEGACY_FRAMES } from '../profile/frames';
import { badgeIcon, BADGES } from '../profile/badges';
import { toneOf } from '../ui/BadgeMedal';

describe('значок друга на карте', () => {
  it('у каждой рамки своя замкнутая форма в пределах 64×72', () => {
    const shapes = new Set(LEGACY_FRAMES.map((f) => f.shape));
    expect(shapes.size).toBe(LEGACY_FRAMES.length);
    for (const f of LEGACY_FRAMES) {
      const d = framePath(f.shape!);
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
