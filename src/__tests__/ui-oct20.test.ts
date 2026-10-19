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
