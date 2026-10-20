import { shapeOf, shapePath, SHAPES, type ShapeId } from '../profile/shapes';
import { badgeIcon, BADGES } from '../profile/badges';
import { toneOf } from '../ui/BadgeMedal';

describe('форма аватарки', () => {
  it('каждая форма — замкнутый контур в пределах 64×64', () => {
    for (const sh of SHAPES.filter(x => x.id !== 'auto')) {
      const d = shapePath(sh.id as Exclude<ShapeId, 'auto'>, 27);
      expect(d.startsWith('M') && d.endsWith('Z')).toBe(true);
      if (sh.id === 'circle') continue;
      const nums = d.replace(/[MLZ]/g, ' ').trim().split(/\s+/).map(Number);
      expect(Math.min(...nums)).toBeGreaterThan(0);
      expect(Math.max(...nums)).toBeLessThan(64);
    }
    expect(shapeOf('nope')).toBe('auto');
    expect(shapeOf('heart')).toBe('heart');
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
