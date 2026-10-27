// Стиль Mapbox из палитр DESIGN.md (paper / night / mono). Хранится в коде — версионируется с приложением.
import { config } from '../lib/config';
import { mapPalettes, type MapTheme } from '../theme';
import { landmarksGeoJSON } from './landmarks';

/** Рельеф Алматы: terrain-RGB из Copernicus DEM GLO-30 (data/terrain, workflow «terrain»), только город и горы. */
export const TERRAIN_TILES = `${config.supabaseUrl}/storage/v1/object/public/terrain/v1/{z}/{x}/{y}.png`;
const TERRAIN_BOUNDS = [76.55, 42.9, 77.4, 43.5];
/** Дома объёмом — только с этого масштаба: на обзорном масштабе слой не нужен и тяжёл для слабых телефонов. */
export const BUILDINGS_MIN_ZOOM = 14.5;
/** Высотки (от 28 м) — объёмом с этого масштаба: город сразу выглядит объёмным при открытии приложения. */
export const TALL_MIN_ZOOM = 12.6;
/** Деревья — картинки tree / pine (и осенние tree-gold / tree-amber), их регистрирует MapCanvas. */
export const TREES_MIN_ZOOM = 15;

const FONT = ['DIN Pro Medium', 'Arial Unicode MS Regular'];

/** native — свойства Mapbox Maps v11 (свет, мягкие тени, скруглённые рёбра); веб-версия mapbox-gl 2 их не знает. */
export function mapStyle(theme: MapTheme, threeD = true, native = false): Record<string, unknown> {
  const c = mapPalettes[theme];
  const night = theme === 'night';
  const v11 = threeD && native;
  const trees = threeD;
  // Осень (сентябрь–ноябрь по Алматы): часть деревьев жёлтые и оранжевые — у каждого парка свой цвет.
  const month = new Date(Date.now() + 5 * 3600e3).getUTCMonth();
  const autumn = month >= 8 && month <= 10;
  const treeImage = autumn
    ? ['match', ['%', ['to-number', ['coalesce', ['id'], 0]], 5], 0, 'tree-gold', 1, 'tree-amber', 'tree']
    : 'tree';
  // Mapbox v11: значок, который закрыт домом, не рисуется — деревья больше не «стоят» на крышах и не просвечивают сквозь стены.
  const occlusion = v11 ? { 'icon-occlusion-opacity': 0 } : {};
  return {
    version: 8,
    name: `ryadom-${theme}`,
    glyphs: 'mapbox://fonts/mapbox/{fontstack}/{range}.pbf',
    sources: {
      streets: { type: 'vector', url: 'mapbox://mapbox.mapbox-streets-v8' },
      // Деревья — из тех же данных, но всегда из тайлов 15-го масштаба (дальше они только растягиваются):
      // при приближении форма парка не меняется, и деревья стоят на своих местах, а не «перепрыгивают».
      trees: { type: 'vector', url: 'mapbox://mapbox.mapbox-streets-v8', maxzoom: 15 },
      terrain: { type: 'vector', url: 'mapbox://mapbox.mapbox-terrain-v2' },
      ...(threeD ? { landmarks: { type: 'geojson', data: landmarksGeoJSON() } } : {}),
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
      { id: 'water', type: 'fill', source: 'streets', 'source-layer': 'water', paint: { 'fill-color': c.water, 'fill-outline-color': c.waterEdge } },
      // Реки и арыки: Есентай и Малая Алматинка заметны издалека, вблизи — с тёмной кромкой, как настоящая вода.
      { id: 'waterway-edge', type: 'line', source: 'streets', 'source-layer': 'waterway', minzoom: 13, layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': c.waterEdge, 'line-width': ['interpolate', ['exponential', 1.6], ['zoom'], 13, ['match', ['get', 'class'], 'river', 3.5, 1.6], 17, ['match', ['get', 'class'], 'river', 16, 6]] } },
      { id: 'waterway', type: 'line', source: 'streets', 'source-layer': 'waterway', layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': c.water, 'line-width': ['interpolate', ['exponential', 1.6], ['zoom'], 10, ['match', ['get', 'class'], 'river', 1.2, 0.5], 13, ['match', ['get', 'class'], 'river', 2.5, 1], 17, ['match', ['get', 'class'], 'river', 13, 4.5]] } },
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
      // Высотки видно уже с обзорного масштаба (раньше объём появлялся только при сильном приближении).
      ...(threeD ? [{
        id: 'buildings-tall', type: 'fill-extrusion', source: 'streets', 'source-layer': 'building', minzoom: TALL_MIN_ZOOM, maxzoom: BUILDINGS_MIN_ZOOM + 0.9,
        filter: ['>=', ['coalesce', ['get', 'height'], 0], 28],
        paint: {
          'fill-extrusion-color': night ? '#5A5F72' : '#E6E1D6',
          'fill-extrusion-height': ['get', 'height'], 'fill-extrusion-base': ['coalesce', ['get', 'min_height'], 0],
          'fill-extrusion-opacity': ['interpolate', ['linear'], ['zoom'], TALL_MIN_ZOOM, 0, TALL_MIN_ZOOM + 0.6, 0.85, BUILDINGS_MIN_ZOOM + 0.5, 0.85, BUILDINGS_MIN_ZOOM + 0.9, 0],
        },
      }] : []),
      // Знаменитые здания (src/map/landmarks.ts): телебашню на Кок-Тобе видно со всего города.
      ...(threeD ? [{
        id: 'landmarks', type: 'fill-extrusion', source: 'landmarks', minzoom: 11,
        paint: { 'fill-extrusion-color': ['get', 'color'], 'fill-extrusion-base': ['get', 'base'], 'fill-extrusion-height': ['get', 'top'], 'fill-extrusion-opacity': 0.95,
          ...(v11 ? { 'fill-extrusion-vertical-gradient': true } : {}) },
      }] : []),
      // Деревья: картинки «стоят» (обращены к камере). В парках и скверах (FIX5) — не по кромке (она совпадает со стенами домов,
      // отсюда «дерево на крыше»), а в самой глубине участка: точка, самая далёкая от краёв; большой парк режется на тайлы — там несколько.
      // Ели в лесах и на склонах — по кромке: домов там почти нет.
      ...(trees ? [
        // Деревья не участвуют в «борьбе за место» с подписями (allow-overlap + ignore-placement): иначе при повороте
        // и наклоне карты одно дерево пряталось, другое появлялось (26 окт.).
        { id: 'trees-park', type: 'symbol', source: 'trees', 'source-layer': 'landuse', minzoom: TREES_MIN_ZOOM,
          filter: ['match', ['get', 'class'], ['park', 'cemetery'], true, false], // газоны дворов (grass) дают сотни лишних деревьев — карта тормозила (27 окт.)
          layout: { 'symbol-placement': 'point', 'icon-image': treeImage, 'icon-anchor': 'bottom', 'icon-pitch-alignment': 'viewport', 'icon-rotation-alignment': 'viewport',
            'icon-size': ['interpolate', ['linear'], ['zoom'], TREES_MIN_ZOOM, 0.11, 17, 0.2, 19, 0.34], 'icon-padding': 0, 'icon-allow-overlap': true, 'icon-ignore-placement': true } ,
          paint: { 'icon-opacity': ['interpolate', ['linear'], ['zoom'], TREES_MIN_ZOOM, 0, TREES_MIN_ZOOM + 0.5, 1], ...occlusion } },
        { id: 'trees-wood', type: 'symbol', source: 'trees', 'source-layer': 'landuse', minzoom: TREES_MIN_ZOOM - 0.5,
          filter: ['match', ['get', 'class'], ['wood', 'scrub'], true, false],
          // Шаг между елями — постоянный «на земле» (растёт вдвое с каждым шагом масштаба), а не на экране: при приближении не появляются новые.
          layout: { 'symbol-placement': 'line', 'symbol-spacing': ['interpolate', ['exponential', 2], ['zoom'], 14, 26, 22, 6656], 'icon-image': 'pine', 'icon-anchor': 'bottom', 'icon-pitch-alignment': 'viewport', 'icon-rotation-alignment': 'viewport',
            'icon-size': ['interpolate', ['linear'], ['zoom'], TREES_MIN_ZOOM - 0.5, 0.08, 17, 0.17, 19, 0.3], 'icon-padding': 0, 'icon-allow-overlap': true, 'icon-ignore-placement': true },
          paint: { 'icon-opacity': ['interpolate', ['linear'], ['zoom'], TREES_MIN_ZOOM - 0.5, 0, TREES_MIN_ZOOM, 1], ...occlusion } },
      ] : []),
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
