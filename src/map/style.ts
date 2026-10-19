// Стиль Mapbox из палитр DESIGN.md (paper / night / mono). Хранится в коде — версионируется с приложением.
import { mapPalettes, type MapTheme } from '../theme';

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
    },
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
      // Контуры домов (2D) с 15-го масштаба: город читается подробнее, на обзорном масштабе слоя нет — дёшево.
      {
        id: 'buildings', type: 'fill', source: 'streets', 'source-layer': 'building', minzoom: 15,
        filter: ['!=', ['get', 'underground'], 'true'],
        paint: { 'fill-color': c.building, 'fill-opacity': ['interpolate', ['linear'], ['zoom'], 15, 0, 15.6, 0.9], 'fill-outline-color': c.buildingEdge },
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
