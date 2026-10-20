// Стиль Mapbox из палитр DESIGN.md (paper / night / mono). Хранится в коде — версионируется с приложением.
import { config } from '../lib/config';
import { mapPalettes, type MapTheme } from '../theme';

/** Рельеф Алматы: terrain-RGB из Copernicus DEM GLO-30 (data/terrain, workflow «terrain»), только город и горы. */
export const TERRAIN_TILES = `${config.supabaseUrl}/storage/v1/object/public/terrain/v1/{z}/{x}/{y}.png`;
const TERRAIN_BOUNDS = [76.55, 42.9, 77.4, 43.5];
/** Дома объёмом — только с этого масштаба: на обзорном масштабе слой не нужен и тяжёл для слабых телефонов. */
export const BUILDINGS_MIN_ZOOM = 14.5;

const FONT = ['DIN Pro Medium', 'Arial Unicode MS Regular'];

/** native — свойства Mapbox Maps v11 (свет, мягкие тени, скруглённые рёбра); веб-версия mapbox-gl 2 их не знает. */
export function mapStyle(theme: MapTheme, threeD = true, native = false): Record<string, unknown> {
  const c = mapPalettes[theme];
  const night = theme === 'night';
  const v11 = threeD && native;
  return {
    version: 8,
    name: `ryadom-${theme}`,
    glyphs: 'mapbox://fonts/mapbox/{fontstack}/{range}.pbf',
    sources: {
      streets: { type: 'vector', url: 'mapbox://mapbox.mapbox-streets-v8' },
      terrain: { type: 'vector', url: 'mapbox://mapbox.mapbox-terrain-v2' },
      ...(threeD ? { dem: { type: 'raster-dem', tiles: [TERRAIN_TILES], tileSize: 256, maxzoom: 11, bounds: TERRAIN_BOUNDS, encoding: 'mapbox' } } : {}),
    },
    // В экономном режиме не загружаем DEM и не рисуем объёмную геометрию.
    // Свет для объёмных домов: мягкий общий и «солнце» с юго-запада (без теней — их считать дорого для Poco M6).
    ...(v11 ? { lights: [
      { id: 'ambient', type: 'ambient', properties: { color: night ? '#9AA3C7' : '#FFFFFF', intensity: night ? 0.45 : 0.62 } },
      { id: 'sun', type: 'directional', properties: { color: night ? '#C9D2FF' : '#FFF4E2', intensity: night ? 0.25 : 0.5, direction: [210, 40], 'cast-shadows': false } },
    ] } : {}),
    ...(threeD ? { terrain: { source: 'dem', exaggeration: 1.2 },
      fog: { range: [1.5, 10], color: c.land, 'high-color': c.land, 'space-color': c.land, 'horizon-blend': 0.08 } } : {}),
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
      ...(threeD ? [{
        id: 'hillshade', type: 'hillshade', source: 'dem', maxzoom: 16,
        paint: { 'hillshade-shadow-color': c.label, 'hillshade-highlight-color': c.highway, 'hillshade-accent-color': c.label, 'hillshade-exaggeration': 0.35, 'hillshade-illumination-anchor': 'map' },
      }] : []),
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
      {
        id: 'buildings', type: threeD ? 'fill-extrusion' : 'fill', source: 'streets', 'source-layer': 'building', minzoom: BUILDINGS_MIN_ZOOM,
        ...(v11 ? { layout: { 'fill-extrusion-edge-radius': 0.35 } } : {}),
        paint: threeD ? {
          // Цвет по высоте: малоэтажки — прохладный серый, высотки — светлее и теплее (читаются силуэты города).
          'fill-extrusion-color': ['interpolate', ['linear'], ['coalesce', ['get', 'height'], 6],
            0, night ? '#3F434F' : '#CDD2D8', 30, night ? '#4A4F5E' : '#DCDDDD', 90, night ? '#5A5F72' : '#EBE4D6', 180, night ? '#6B6F86' : '#F3E7D2'],
          ...(v11 ? { 'fill-extrusion-ambient-occlusion-intensity': 0.35, 'fill-extrusion-ambient-occlusion-radius': 4, 'fill-extrusion-vertical-gradient': true } : {}),
          'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], BUILDINGS_MIN_ZOOM, 0, BUILDINGS_MIN_ZOOM + 0.6, ['max', 3, ['coalesce', ['get', 'height'], 6]]],
          'fill-extrusion-base': ['min', ['coalesce', ['get', 'min_height'], 0], ['max', 3, ['coalesce', ['get', 'height'], 6]]],
          // Дома проявляются плавно, пока приближаешься, — без резкого «щелчка» на одном масштабе.
          'fill-extrusion-opacity': ['interpolate', ['linear'], ['zoom'], BUILDINGS_MIN_ZOOM, 0, BUILDINGS_MIN_ZOOM + 0.9, 0.9],
        } : { 'fill-color': theme === 'night' ? '#383C46' : '#D5D9DE', 'fill-opacity': 0.65 },
      },
      {
        id: 'street-labels', type: 'symbol', source: 'streets', 'source-layer': 'road',
        filter: ['match', ['get', 'class'], ['primary', 'secondary', 'trunk'], true, false],
        layout: {
          'symbol-placement': 'line', 'text-field': ['upcase', ['coalesce', ['get', 'name_ru'], ['get', 'name']]],
          'text-font': FONT, 'text-size': 9, 'text-letter-spacing': 0.2, 'text-max-angle': 30,
        },
        paint: { 'text-color': c.label, 'text-halo-color': c.land, 'text-halo-width': 1, 'text-opacity': ['interpolate', ['linear'], ['zoom'], 12, 0, 13, 1] },
      },
      {
        id: 'districts', type: 'symbol', source: 'streets', 'source-layer': 'place_label',
        filter: ['match', ['get', 'type'], ['suburb', 'quarter', 'neighbourhood'], true, false],
        layout: {
          'text-field': ['upcase', ['coalesce', ['get', 'name_ru'], ['get', 'name']]],
          'text-font': FONT, 'text-size': 11, 'text-letter-spacing': 0.5, 'text-max-width': 12,
        },
        paint: { 'text-color': c.district, 'text-opacity': ['interpolate', ['linear'], ['zoom'], 10.5, 0, 11.5, 1, 15, 1, 16, 0] },
      },
    ],
  };
}

/** «Ночь» включается сама после 20:00 (и до 6 утра). */
