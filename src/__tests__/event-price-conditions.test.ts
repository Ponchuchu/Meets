import { eventFacts } from '../event/facts';
it('does not turn free admission for membership holders into free public admission', () => {
  const facts = eventFacts({ isFree: true, priceMin: null, about: 'Выставка открыта к посещению по входному билету в музей. Вход для обладателей годового абонемента DOSTAR — беслатный.' });
  expect(facts.priceMissing).toBe(true);
  expect(facts.price).toBe('цена не указана');
});
it('keeps ordinary free events and a known standard ticket price', () => {
  expect(eventFacts({ isFree: true, about: 'Вход свободный для всех' }).price).toBe('бесплатно');
  expect(eventFacts({ isFree: true, priceMin: 5000, about: 'Вход по входному билету в музей. Вход для владельцев абонемента DOSTAR — бесплатный.' }).price).toBe('5 000 ₸');
});
