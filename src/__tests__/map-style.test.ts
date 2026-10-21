import { mapStyle } from '../map/style';

// Валидация движком Mapbox проверяет выражения высоты, типы и совместимость слоя.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { validate } = require('mapbox-gl/dist/style-spec/index.cjs') as { validate: (style: unknown) => { message: string }[] };

it.each(['paper', 'night', 'mono'] as const)('2D и 3D стиль %s проходит схему Mapbox', theme => {
  for (const threeD of [false, true]) expect(validate(mapStyle(theme, threeD)).map(e => e.message)).toEqual([]);
});

it('экономный режим не запрашивает DEM и деревья, 3D — дома и высотки издалека', () => {
  const flat = mapStyle('paper', false) as { sources: Record<string, unknown>; terrain?: unknown; layers: { type: string; source?: string }[] };
  expect(flat.sources.dem).toBeUndefined();
  expect(flat.terrain).toBeUndefined();
  expect(flat.layers.some(l => l.source === 'dem' || l.type === 'fill-extrusion' || l.type === 'symbol' && String((l as { id?: string }).id).startsWith('trees'))).toBe(false);
  const volumetric = mapStyle('paper', true) as { sources: Record<string, unknown>; layers: { id: string; type: string; minzoom?: number; maxzoom?: number }[] };
  expect(volumetric.sources.dem).toBeDefined();
  const ext = volumetric.layers.filter(l => l.type === 'fill-extrusion');
  expect(ext.map(l => l.id)).toEqual(['buildings', 'buildings-tall']);
  // Высотки — только пока не появились все дома (плюс короткий переход), чтобы не рисовать их дважды.
  expect(ext[1].minzoom!).toBeLessThan(13.4);
  expect(ext[1].maxzoom!).toBeLessThanOrEqual(ext[0].minzoom! + 1);
  expect(volumetric.layers.some(l => l.id === 'trees-park')).toBe(true);
});
