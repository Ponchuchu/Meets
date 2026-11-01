import { cleanEventTitle } from '../src/title.ts';

it('убирает дату в конце, сохраняя часть названия', () => {
  expect(cleanEventTitle('Чёрный стендап (6 ноября)')).toBe('Чёрный стендап');
  expect(cleanEventTitle('Концерт (версия 2)')).toBe('Концерт (версия 2)');
});
