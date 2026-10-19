// Стиль Mapbox из палитр DESIGN.md (paper / night / mono). Хранится в коде — версионируется с приложением.
import { config } from '../lib/config';
import { mapPalettes, type MapTheme } from '../theme';

/** Рельеф Алматы: terrain-RGB из Copernicus DEM GLO-30 (data/terrain, workflow «terrain»), только город и горы. */
export const TERRAIN_TILES = `${config.supabaseUrl}/storage/v1/object/public/terrain/v1/{z}/{x}/{y}.png`;
const TERRAIN_BOUNDS = [76.55, 42.9, 77.4, 43.5];
/** Дома объёмом — только с этого масштаба: на обзорном масштабе слой не нужен и тяжёл для слабых телефонов. */
export const BUILDINGS_MIN_ZOOM = 14.5;

const FONT = ['DIN Pro Medium', 'Arial Unicode MS Regular'];

export function mapStyle(theme: MapTheme): Record<string, unknown> {
  const c = mapPalettes[theme];
  return {
    version: 8,
    name: `ryadom-${theme}`,
    glyphs: 'mapbox://fonts/mapbox/{fontstack}/{range}.pbf',
    sources: {
      streets: { type: 'vector', url: 'mapbox://mapbox.mapbox-streets-v8' },
      terrain: { type: 'vector', url: 'mapbox://mapbox.mapbox-terrain-v2' },
      dem: { type: 'raster-dem', tiles: [TERRAIN_TILES], tileSize: 256, maxzoom: 11, bounds: TERRAIN_BOUNDS, encoding: 'mapbox' },
    },
    // Карта всегда объёмная: горы из рельефа, дымка у горизонта при наклоне.
    terrain: { source: 'dem', exaggeration: 1.2 },
    fog: { range: [1.5, 10], color: c.land, 'high-color': c.land, 'space-color': c.land, 'horizon-blend': 0.08 },
    layers: [
      { id: 'land', type: 'background', paint: { 'background-color': c.land } },
      // Горы на юге города — ступени высот (контуры рельефа).
      ...[1100, 1500, 2000].map((ele, i) => ({
        id: `mountains-${i}`, type: 'fill', source: 'terrain', 'source-layer': 'contour',
        filter: ['>=', ['get', 'ele'], ele],
        paint: { 'fill-color': c.mountains[i], 'fill-antialias': false },
      })),
      {
        id: 'parks', type: 'fill', source: 'streets', 'source-layer': 'landuse',
        filter: ['match', ['get', 'class'], ['park', 'pitch', 'grass', 'wood', 'scrub', 'cemetery'], true, false],
        paint: { 'fill-color': c.park },
      },
      {
        id: 'hillshade', type: 'hillshade', source: 'dem', maxzoom: 16,
        paint: { 'hillshade-shadow-color': c.label, 'hillshade-highlight-color': c.highway, 'hillshade-accent-color': c.label, 'hillshade-exaggeration': 0.35, 'hillshade-illumination-anchor': 'map' },
      },
      { id: 'water', type: 'fill', source: 'streets', 'source-layer': 'water', paint: { 'fill-color': c.water } },
      { id: 'waterway', type: 'line', source: 'streets', 'source-layer': 'waterway', paint: { 'line-color': c.water, 'line-width': ['interpolate', ['linear'], ['zoom'], 11, 1, 16, 4] } },
      {
        id: 'streets', type: 'line', source: 'streets', 'source-layer': 'road',
        filter: ['match', ['get', 'class'], ['street', 'street_limited', 'tertiary', 'secondary_link', 'tertiary_link'], true, false],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': c.street, 'line-width': ['interpolate', ['exponential', 1.5], ['zoom'], 12, 0.8, 16, 7] },
      },
      {
        id: 'highways', type: 'line', source: 'streets', 'source-layer': 'road',
        filter: ['match', ['get', 'class'], ['motorway', 'trunk', 'primary', 'secondary', 'motorway_link', 'trunk_link', 'primary_link'], true, false],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': c.highway, 'line-width': ['interpolate', ['exponential', 1.5], ['zoom'], 10, 1.5, 16, 14] },
      },
      // Дома объёмом с 14,5 масштаба (подрастают из земли), на обзорном масштабе слоя нет — дёшево.
      {
        id: 'buildings-3d', type: 'fill-extrusion', source: 'streets', 'source-layer': 'building', minzoom: BUILDINGS_MIN_ZOOM,
        filter: ['all', ['==', ['get', 'extrude'], 'true'], ['!=', ['get', 'underground'], 'true']],
        paint: {
          'fill-extrusion-color': c.extrude,
          'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], BUILDINGS_MIN_ZOOM, 0, BUILDINGS_MIN_ZOOM + 0.6, ['get', 'height']],
          'fill-extrusion-base': ['get', 'min_height'], 'fill-extrusion-opacity': 0.92, 'fill-extrusion-vertical-gradient': true,
        },
      },
      {
        id: 'street-labels', type: 'symbol', source: 'streets', 'source-layer': 'road',
        filter: ['match', ['get', 'class'], ['primary', 'secondary', 'trunk'], true, false],
        layout: {
          'symbol-placement': 'line', 'text-field': ['upcase', ['coalesce', ['get', 'name_ru'], ['get', 'name']]],
          'text-font': FONT, 'text-size': 9, 'text-letter-spacing': 0.2, 'text-max-angle': 30,
        },
        paint: { 'text-color': c.label, 'text-halo-color': c.land, 'text-halo-width': 1 },
      },
      {
        id: 'districts', type: 'symbol', source: 'streets', 'source-layer': 'place_label',
        filter: ['match', ['get', 'type'], ['suburb', 'quarter', 'neighbourhood'], true, false],
        layout: {
          'text-field': ['upcase', ['coalesce', ['get', 'name_ru'], ['get', 'name']]],
          'text-font': FONT, 'text-size': 11, 'text-letter-spacing': 0.5, 'text-max-width': 12,
        },
        paint: { 'text-color': c.district },
      },
    ],
  };
}

/** «Ночь» включается сама после 20:00 (и до 6 утра). */
