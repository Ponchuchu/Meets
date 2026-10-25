import { applyFacts } from '../src/polish.ts';
import { confirmed, needsLineup, pageText } from '../src/lineup.ts';
import type { Found } from '../src/search.ts';

const f = (patch: Partial<Found> = {}): Found => ({ title: 'Концерт', category: 'concert', starts_at: '2026-11-01T19:00:00+05:00', url: 'https://x', ...patch });

test('редактор: бесплатно и цена — только если со страницы ничего не пришло', () => {
  const a = f(); applyFacts(a, { free: true }); expect(a.is_free).toBe(true);
  const b = f({ price_min: 5000 }); applyFacts(b, { free: true, price: 3000 }); expect(b).toMatchObject({ price_min: 5000 }); expect(b.is_free).toBeUndefined();
  const c = f(); applyFacts(c, { free: false, price: 4000 }); expect(c.price_min).toBe(4000);
  const d = f(); applyFacts(d, { price: -5 }); expect(d.price_min).toBeUndefined();
});

test('редактор: адрес берём только вместо размытого и только в едином виде', () => {
  const a = f({ address: 'в центре' }); applyFacts(a, { address: 'проспект Достык, 109' }); expect(a.address).toBe('проспект Достык, 109');
  const b = f({ address: 'ул. Жандосова, 1/1' }); applyFacts(b, { address: 'проспект Достык, 109' }); expect(b.address).toBe('ул. Жандосова, 1/1');
  const c = f(); applyFacts(c, { address: 'где-то у Абая' }); expect(c.address).toBeUndefined();
});

test('исполнители: чистим список; состав из интернета — только подтверждённый страницей', () => {
  const a = f(); applyFacts(a, { performers: ['Thomas Anders', '', 42, 'Thomas Anders'] }); expect(a.performers).toEqual(['Thomas Anders']);
  expect(needsLineup(a)).toBe(false);
  expect(needsLineup(f())).toBe(true);
  expect(needsLineup(f({ category: 'food' }))).toBe(false);
  const text = pageText('<html><script>var x="Иван Петров"</script><h1>Вечер барокко</h1><p>Играет ансамбль Musica Aeterna, солист Алексей Ковальчук</p></html>');
  expect(confirmed(['Musica Aeterna', 'Иван Петров', 'Алексей Ковальчук'], text)).toEqual(['Musica Aeterna', 'Алексей Ковальчук']);
});
