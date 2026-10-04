import { interestsOf, MIN_TASTE, TASTE_CHIPS } from '../auth/taste';
import { INTERESTS } from '../reco/startTaste';

describe('интересы на входе', () => {
  it('12 чипсов, как в макете, у каждого — интерес ленты', () => {
    expect(TASTE_CHIPS.map((c) => c.label)).toEqual(['Джаз', 'Стендап', 'Горы', 'Настолки', 'Кино', 'Музеи', 'Кофе', 'Танцы', 'Спорт', 'Театр', 'Вечеринки', 'Йога']);
    for (const c of TASTE_CHIPS) expect(INTERESTS).toContain(c.interest);
    expect(MIN_TASTE).toBe(3);
  });
  it('без повторов и в порядке чипсов', () => {
    expect(interestsOf(['yoga', 'jazz', 'sport'])).toEqual(['music', 'sport']);
    expect(interestsOf(['theatre', 'museums'])).toEqual(['art']);
    expect(interestsOf([])).toEqual([]);
  });
});
