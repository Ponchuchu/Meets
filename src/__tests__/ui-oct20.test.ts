import { shapeOf, shapePath, SHAPES, type ShapeId } from '../profile/shapes';
import { badgeIcon, BADGES , BADGES as ALL_BADGES } from '../profile/badges';
import { BADGE_ART } from '../ui/badgeArt';

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
  it('у каждой награды своя картинка из Figma (и у наград за шаги)', () => {
    for (const b of ALL_BADGES) expect(BADGE_ART[b.id]).toBeDefined();
    for (const id of ['steps-first', 'steps-streak', 'steps-week', 'steps-marathon', 'steps-month', 'locked']) expect(BADGE_ART[id]).toBeDefined();
  });
});
