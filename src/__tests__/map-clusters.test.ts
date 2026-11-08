import { CLUSTER_PALETTE, clusterMapSymbols, sameMapSymbols } from '../map/clusters';
import type { MapSymbol } from '../map/symbols';

const symbol = (id: string, lon = 76.9, lat = 43.2): MapSymbol => ({ id, lon, lat, icon: 'ev-concert', size: 40, sort: 10 });
const represented = (result: ReturnType<typeof clusterMapSymbols>) => result.symbols.flatMap(s => result.members.get(s.id)?.map(m => m.id) ?? [s.id]).sort();

it('считает раскрывающиеся значки событий, мест и ТРЦ, а не число сеансов за одним значком', () => {
  const input = [{ ...symbol('e-cinema'), count: 999, eventCount: 999 }, symbol('a-park'), symbol('v-mall')];
  const result = clusterMapSymbols(input, 12);
  expect(result.symbols).toHaveLength(1);
  expect(result.symbols[0]).toMatchObject({ count: 3, eventCount: 999 });
  expect(result.members.get(result.symbols[0].id)).toHaveLength(3);
  expect(clusterMapSymbols([input[0]], 18).symbols[0].count).toBe(1);
});

it('не теряет и не удваивает значки при смене масштаба и перестановке входных данных', () => {
  const input = Array.from({ length: 1200 }, (_, i) => symbol(String(i), 76.9 + (i % 40) * 0.00035, 43.2 + Math.floor(i / 40) * 0.00035));
  for (const zoom of [0, 10, 12.49, 12.5, 14, 16, 18]) {
    const result = clusterMapSymbols(input, zoom);
    expect(represented(result)).toEqual(input.map(s => s.id).sort());
    expect(result.symbols.reduce((sum, s) => sum + (s.count ?? 1), 0)).toBe(input.length);
  }
  expect(clusterMapSymbols(input, 13.5).symbols).toEqual(clusterMapSymbols([...input].reverse(), 13.5).symbols);
});

it('приближение раскрывает группу, цепочка соседей не поглощает всю улицу', () => {
  const world = 512 * 2 ** 12;
  const lon = (x: number) => x / world * 360;
  const input = [symbol('a', lon(0), 0), symbol('b', lon(40), 0), symbol('c', lon(80), 0)];
  const far = clusterMapSymbols(input, 12);
  expect(far.symbols).toHaveLength(2);
  expect(far.symbols[0].count).toBe(2);
  expect(clusterMapSymbols(input, 14).symbols).toHaveLength(3);
});

it('нормализует меридиан ±180, не создаёт центр кластера в океане и отбрасывает невалидные точки', () => {
  const result = clusterMapSymbols([symbol('west', -179.9999, 0), symbol('east', 179.9999, 0), symbol('bad', NaN), symbol('bad-lat', 76, 91)], 12);
  expect(result.symbols).toHaveLength(1);
  expect(result.symbols[0].count).toBe(2);
  expect(Math.abs(result.symbols[0].lon)).toBeGreaterThan(179.9);
  expect(represented(result)).toEqual(['east', 'west']);
});

it('равенство геометрии сохраняет кэш между кадрами друзей, но учитывает новые подписи и координаты', () => {
  const input = [symbol('a')];
  expect(sameMapSymbols(input, [{ ...input[0] }])).toBe(true);
  expect(sameMapSymbols(input, [{ ...input[0], lon: 77 }])).toBe(false);
  expect(sameMapSymbols(input, [{ ...input[0], label: 'Новое имя' }])).toBe(false);
  expect(sameMapSymbols(input, [{ ...input[0], eventCount: 10 }])).toBe(false);
});

it('светлые счётчики имеют контрастный текст и заметную обводку на native и web', () => {
  const luminance = (hex: string) => {
    const rgb = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
  };
  const fill = luminance(CLUSTER_PALETTE.fill);
  expect(fill).toBeGreaterThan(0.85);
  expect((fill + 0.05) / (luminance(CLUSTER_PALETTE.text) + 0.05)).toBeGreaterThan(7);
  expect((fill + 0.05) / (luminance(CLUSTER_PALETTE.stroke) + 0.05)).toBeGreaterThan(3);
  expect(clusterMapSymbols([symbol('a'), symbol('b')], 12).symbols[0].dot).toBe(CLUSTER_PALETTE.fill);
});
