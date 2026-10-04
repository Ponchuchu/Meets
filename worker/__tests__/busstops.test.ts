import { indexStops, normName, placeStops, type NamedPoint } from '../src/busstops.ts';

describe('остановки по названию', () => {
  it('нормализует названия', () => {
    expect(normName('Торайгырова (Аль-Фараби)').base).toBe('торайгырова');
    expect(normName('ЦУМ «Жибек Жолы»').full).toBe('цум жибек жолы');
  });

  it('из двух одноимённых берёт ближнюю к маршруту', () => {
    const pts: NamedPoint[] = [
      { id: 'a1', name: 'Абая', lat: 43.24, lon: 76.90 },
      { id: 'b1', name: 'Гагарина', lat: 43.24, lon: 76.905 },
      { id: 'b2', name: 'Гагарина', lat: 43.30, lon: 76.99 }, // другая «Гагарина» на другом конце города
      { id: 'c1', name: 'Байзакова (Абая)', lat: 43.24, lon: 76.91 },
    ];
    const r = placeStops(['Абая', 'Гагарина', 'Байзакова', 'Нет такой'], indexStops(pts));
    expect(r.stops.map((s) => s.id)).toEqual(['a1', 'b1', 'c1']);
    expect(r.matched).toBe(3);
  });
});
