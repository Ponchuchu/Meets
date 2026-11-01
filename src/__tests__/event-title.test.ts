import { displayEventTitle } from '../event/title';

test('removes a repeated date in Russian or English without changing other titles', () => {
  expect(displayEventTitle('Best Jokes & Wildest Crowdwork (5 November)')).toBe('Best Jokes & Wildest Crowdwork');
  expect(displayEventTitle('Чёрный стендап (6 ноября)')).toBe('Чёрный стендап');
  expect(displayEventTitle('May (2026)')).toBe('May (2026)');
  expect(displayEventTitle('Concert (5 November) live')).toBe('Concert (5 November) live');
});
