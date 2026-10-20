// Маршрут с пересадками: прямой автобус, пересадка автобус → метро, ночью — ничего.
import { buildLines, chooseOptions, planTransit } from '../transit/router';
import { METRO_LINE } from '../transit/metro';

const at = new Date('2026-10-20T08:00:00Z'); // 13:00 по Алматы
const s = (id: string, lat: number, lon: number) => ({ id, name: id, lat, lon });
// Автобус 1 идёт с востока на запад по 43.250, до станции «Абай» (43.2425, 76.9493) не доходит —
// автобус 2 идёт с севера к «Абаю».
const bus1 = { ref: '1', stops: [s('a1', 43.250, 76.990), s('a2', 43.250, 76.975), s('a3', 43.250, 76.960), s('a4', 43.250, 76.950)] };
const bus2 = { ref: '2', stops: [s('b1', 43.2505, 76.9502), s('b2', 43.2465, 76.9498), s('b3', 43.2430, 76.9496)] };

describe('маршрут с пересадками', () => {
  it('прямой автобус без пересадок', () => {
    const lines = buildLines([bus1], []);
    const o = planTransit(lines, { lat: 43.2505, lon: 76.9905 }, { lat: 43.2505, lon: 76.9505 }, at);
    expect(o[0].transfers).toBe(0);
    expect(o[0].legs.filter(l => l.kind === 'ride').map(l => l.ref)).toEqual(['1']);
  });
  it('автобус → автобус → метро до запада города', () => {
    const lines = buildLines([bus1, bus2], METRO_LINE);
    const o = planTransit(lines, { lat: 43.2505, lon: 76.9905 }, { lat: 43.2300, lon: 76.8650 }, at);
    expect(o.length).toBeGreaterThan(0);
    const rides = o[0].legs.filter(l => l.kind === 'ride');
    expect(rides.at(-1)?.mode).toBe('metro');
    expect(rides.at(-1)?.to?.name).toBe('Москва');
    expect(o[0].total).toBeGreaterThan(10);
    expect(o[0].legs[0].kind).toBe('walk');
    expect(o[0].legs.at(-1)?.kind).toBe('walk');
  });
  it('ночью автобусы и метро не ходят', () => {
    const lines = buildLines([bus1], METRO_LINE);
    expect(planTransit(lines, { lat: 43.2505, lon: 76.9905 }, { lat: 43.2505, lon: 76.9505 }, new Date('2026-10-20T20:00:00Z'))).toEqual([]);
  });
  it('варианты без повторов, медленные отброшены', () => {
    const leg = (ref: string) => ({ kind: 'ride' as const, ref, minutes: 10, path: [] as [number, number][] });
    const list = chooseOptions([
      { legs: [leg('1')], total: 30, transfers: 0, walkMin: 12 },
      { legs: [leg('2'), leg('М')], total: 24, transfers: 1, walkMin: 6 },
      { legs: [leg('9')], total: 90, transfers: 0, walkMin: 1 },
    ]);
    expect(list.map(o => o.tag)).toEqual(['fast', 'simple']);
  });
});
