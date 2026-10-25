import { canonAddress, canonStreet } from '../src/ruAddress.ts';

test('адрес события в одном виде: тип впереди полным словом, без города, этаж — в заметку', () => {
  expect(canonAddress('ул.Тулебаева, 38А, Алматы')).toEqual({ address: 'улица Тулебаева, 38А', note: null });
  expect(canonAddress('пр. Достык, 109 (2 этаж), Алматы')).toEqual({ address: 'проспект Достык, 109', note: '2 этаж' });
  expect(canonAddress('ул. Айманова, 126, офис 405, Алматы')).toEqual({ address: 'улица Айманова, 126', note: 'офис 405' });
  expect(canonAddress('Джаз-клуб EverJazz, ул. Жандосова, 1/1').address).toBe('улица Жандосова, 1/1');
  expect(canonAddress('в центре').address).toBe('в центре');
});

test('казахское название улицы → русское', () => {
  expect(canonAddress('Абай даңғылы 120').address).toBe('проспект Абая, 120');
  expect(canonAddress('Әуезов к. 84А, Алматы').address).toBe('улица Ауэзова, 84А');
  expect(canonStreet('Нұрпейісов көшесі')).toBe('улица Нурпейисова');
  expect(canonStreet('Райымбека проспект')).toBe('проспект Райымбека');
});
