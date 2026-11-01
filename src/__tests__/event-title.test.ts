import { displayEventTitle } from '../event/title';
import { eventFacts } from '../event/facts';

test('removes a repeated date in Russian or English without changing other titles', () => {
  expect(displayEventTitle('Best Jokes & Wildest Crowdwork (5 November)')).toBe('Best Jokes & Wildest Crowdwork');
  expect(displayEventTitle('Чёрный стендап (6 ноября)')).toBe('Чёрный стендап');
  expect(displayEventTitle('May (2026)')).toBe('May (2026)');
  expect(displayEventTitle('Concert (5 November) live')).toBe('Concert (5 November) live');
});

test('does not display an imported event title as a venue', () => {
  const title = 'Best Jokes & Wildest Crowdwork (5 November)';
  expect(eventFacts({ title, venueName: `English Standup: ${title}`, address: 'Толе би, 71' }).place).toBe('Толе би, 71');
  expect(eventFacts({ title: 'Театр имени Абая', venueName: 'Театр имени Абая' }).place).toBe('Театр имени Абая');
});
