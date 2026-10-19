import { mapStyle } from '../map/style';

// Валидация движком Mapbox проверяет выражения высоты, типы и совместимость слоя.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { validate } = require('mapbox-gl/dist/style-spec/index.cjs') as { validate: (style: unknown) => { message: string }[] };

it.each(['paper', 'night', 'mono'] as const)('2D и 3D стиль %s проходит схему Mapbox', theme => {
  for (const threeD of [false, true]) expect(validate(mapStyle(theme, threeD)).map(e => e.message)).toEqual([]);
});

it('экономный режим не запрашивает DEM, 3D рисует один слой зданий', () => {
  const flat = mapStyle('paper', false) as { sources: Record<string, unknown>; terrain?: unknown; layers: { type: string; source?: string }[] };
  expect(flat.sources.dem).toBeUndefined();
  expect(flat.terrain).toBeUndefined();
  expect(flat.layers.some(l => l.source === 'dem' || l.type === 'fill-extrusion')).toBe(false);
  const volumetric = mapStyle('paper', true) as typeof flat;
  expect(volumetric.sources.dem).toBeDefined();
  expect(volumetric.layers.filter(l => l.type === 'fill-extrusion')).toHaveLength(1);
});
