import { bestDirectBus, estimateParts, intervalMin, type BusDirection } from '../transit/bus';

// Время по Алматы (UTC+5).
const at = (hhmm: string) => new Date(`2026-10-05T${hhmm}:00+05:00`);

describe('время на автобусе', () => {
  it('интервал по времени суток', () => {
    expect(intervalMin(at('08:30'))).toBe(10);
    expect(intervalMin(at('13:00'))).toBe(12);
    expect(intervalMin(at('21:00'))).toBe(20);
    expect(intervalMin(at('23:30'))).toBeNull();
  });

  it('пример из ТЗ: 300 м + ждать + 3,2 км + 6 остановок + 200 м ≈ 26 мин днём', () => {
    const p = estimateParts({ walkToM: 300, walkFromM: 200, rideM: 3200, stopsCount: 6, at: at('13:00') });
    expect(p).not.toBeNull();
    expect(p!.wait).toBe(6);
    expect(p!.total).toBeGreaterThanOrEqual(22);
    expect(p!.total).toBeLessThanOrEqual(28);
  });

  it('пробки и настоящее ожидание учитываются', () => {
    const base = estimateParts({ walkToM: 300, walkFromM: 200, rideM: 5000, stopsCount: 8, at: at('13:00') })!;
    const jam = estimateParts({ walkToM: 300, walkFromM: 200, rideM: 5000, stopsCount: 8, at: at('13:00'), traffic: 1.5 })!;
    const live = estimateParts({ walkToM: 300, walkFromM: 200, rideM: 5000, stopsCount: 8, at: at('13:00'), waitMin: 2 })!;
    expect(jam.ride).toBeGreaterThan(base.ride);
    expect(live.wait).toBe(2);
  });

  it('выбирает автобус, который едет в нужную сторону', () => {
    const stops = [0, 1, 2, 3, 4, 5].map((k) => ({ id: `s${k}`, name: `Остановка ${k}`, lat: 43.24, lon: 76.90 + k * 0.01 }));
    const dirs: BusDirection[] = [
      { ref: '63', stops },
      { ref: '63', stops: [...stops].reverse() },
    ];
    const r = bestDirectBus(dirs, { lat: 43.2405, lon: 76.901 }, { lat: 43.2405, lon: 76.949 }, at('13:00'));
    expect(r?.ref).toBe('63');
    expect(r?.board.id).toBe('s0');
    expect(r?.alight.id).toBe('s5');
    expect(r?.stopsCount).toBe(5);
    expect(bestDirectBus(dirs, { lat: 43.30, lon: 76.90 }, { lat: 43.24, lon: 76.95 }, at('13:00'))).toBeNull();
  });
});
