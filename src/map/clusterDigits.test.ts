import type { MapSymbol } from './symbols';
import { clusterDigitsGeo } from './clusterDigits';
import { CLUSTER_DIGIT_IMAGES } from './clusterDigitImages';

const cluster = (count: number): MapSymbol => ({ id: 'cluster:a|b', lat: 43.2, lon: 76.9, icon: 'ev-concert', size: 40, sort: 1, dot: '#FFF6EA', count });

it('renders exact totals with ten bundled PNGs, without any font server', () => {
  expect(Object.keys(CLUSTER_DIGIT_IMAGES)).toHaveLength(10);
  for (const count of [2, 19, 100, 1200, 99999]) {
    const features = clusterDigitsGeo([cluster(count)]).features;
    expect(features.map(f => f.properties.icon.replace('cluster-digit-', '')).join('')).toBe(String(count));
    for (const f of features) {
      expect(CLUSTER_DIGIT_IMAGES[f.properties.icon as keyof typeof CLUSTER_DIGIT_IMAGES]).toMatch(/^data:image\/png;base64,iVBOR/);
      expect(f.properties.id).toBe('cluster:a|b'); // tapping any digit opens the same group
      expect(f.geometry.coordinates).toEqual([76.9, 43.2]);
    }
    expect(features.map(f => f.properties.offset[0]).reduce((a, b) => a + b, 0)).toBe(0);
    expect(features.length * 24 * features[0].properties.scale).toBeLessThanOrEqual(32);
  }
});

it('does not duplicate singleton/private icons or invalid coordinates', () => {
  expect(clusterDigitsGeo([cluster(1), cluster(NaN), { ...cluster(9), dot: undefined }, { ...cluster(9), lat: 91 }, { ...cluster(9), lon: NaN }]).features).toEqual([]);
  expect(clusterDigitsGeo([{ ...cluster(12), faded: true }]).features.every(f => f.properties.op === 0.35)).toBe(true);
  expect(clusterDigitsGeo([cluster(Number.MAX_VALUE)]).features.every(f => /^cluster-digit-\d$/.test(f.properties.icon))).toBe(true);
});
