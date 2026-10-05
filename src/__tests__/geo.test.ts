import { ALMATY_CELLS, cellOf, distM, exploredPct, friendLine, isJump, sendInterval, statusOf } from '../live/geo';

describe('геолокация альфы', () => {
  const t0 = Date.parse('2026-10-05T10:00:00Z');
  it('расстояние: 0,01° широты ≈ 1,1 км', () => {
    expect(Math.round(distM({ lat: 43.25, lon: 76.9 }, { lat: 43.26, lon: 76.9 }))).toBeGreaterThan(1100);
    expect(Math.round(distM({ lat: 43.25, lon: 76.9 }, { lat: 43.26, lon: 76.9 }))).toBeLessThan(1120);
  });
  it('скачки GPS: плохая точность и невозможная скорость', () => {
    const a = { lat: 43.25, lon: 76.9, at: t0 };
    expect(isJump(null, { ...a, accuracy: 400 })).toBe(true);
    expect(isJump(a, { lat: 43.2505, lon: 76.9, at: t0 + 5000, accuracy: 10 })).toBe(false); // 55 м за 5 с
    expect(isJump(a, { lat: 43.3, lon: 76.9, at: t0 + 5000 })).toBe(true); // 5,5 км за 5 с
  });
  it('статусы: в пути, дома, ничего', () => {
    const home = { kind: 'home' as const, lat: 43.25, lon: 76.9 };
    expect(statusOf({ lat: 43.25, lon: 76.9, speed: 10 }, [home])).toBe('moving');
    expect(statusOf({ lat: 43.2505, lon: 76.9, speed: 0 }, [home])).toBe('home');
    expect(statusOf({ lat: 43.3, lon: 76.9 }, [home])).toBeNull();
  });
  it('подпись под другом', () => {
    expect(friendLine('moving', 38, 0)).toBe('В пути · 38 км/ч');
    expect(friendLine('home', undefined, 3)).toBe('Дома');
    expect(friendLine(null, undefined, 2)).toBe('2 мин');
    expect(friendLine('home', undefined, 90)).toBe('Давно не в сети');
  });
  it('клетки «Где я был» и процент', () => {
    expect(cellOf(43.2501, 76.9001)).toBe(cellOf(43.2502, 76.9002));
    expect(ALMATY_CELLS).toBeGreaterThan(2000);
    expect(exploredPct([])).toBe('0,0 %');
    expect(exploredPct([cellOf(43.25, 76.9), cellOf(0, 0)])).toBe(`${(100 / ALMATY_CELLS).toFixed(1).replace('.', ',')} %`);
  });
  it('частота отправки', () => {
    expect(sendInterval(true, 0.8)).toBe(4000);
    expect(sendInterval(false, 0.8)).toBe(150000);
    expect(sendInterval(false, 0.05)).toBe(300000);
  });
});

describe('FIX1 И2 п.14: «Где я был» плавными пятнами', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { cellOutlines, chaikin, fogPolygon } = require('../live/geo') as typeof import('../live/geo');
  it('соседние клетки — одно пятно без внутренних швов', () => {
    const rings = cellOutlines(['0:0', '0:1', '1:0', '1:1']);
    expect(rings).toHaveLength(1);
    expect(rings[0]).toHaveLength(4); // квадрат 2×2 — 4 угла, швов нет
  });
  it('отдельные места — отдельные пятна, углы сглажены', () => {
    expect(cellOutlines(['0:0', '5:5'])).toHaveLength(2);
    expect(chaikin([[0, 0], [1, 0], [1, 1], [0, 1]], 3)).toHaveLength(32);
    const f = fogPolygon(['8660:15400', '8660:15401']);
    expect(f.geometry.coordinates).toHaveLength(2);
  });
});
