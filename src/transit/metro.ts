// Метро Алматы, линия 1 (11 станций). Координаты входов — примерные (±100 м), для оценки пешего пути.
// Интервал днём ~7 мин, вечером ~12; скорость с остановками ~36 км/ч. Метро работает 6:00–24:00.
import type { BusStop } from './bus';

export const METRO_LINE: BusStop[] = [
  { id: 'm-raiymbek', name: 'Райымбек батыра', lat: 43.2711, lon: 76.9446 },
  { id: 'm-zhibek', name: 'Жибек Жолы', lat: 43.2603, lon: 76.9462 },
  { id: 'm-almaly', name: 'Алмалы', lat: 43.2513, lon: 76.9454 },
  { id: 'm-abai', name: 'Абай', lat: 43.2425, lon: 76.9493 },
  { id: 'm-baikonur', name: 'Байконур', lat: 43.2405, lon: 76.9277 },
  { id: 'm-auezov', name: 'Театр им. Ауэзова', lat: 43.2402, lon: 76.9178 },
  { id: 'm-alatau', name: 'Алатау', lat: 43.2391, lon: 76.8973 },
  { id: 'm-sairan', name: 'Сайран', lat: 43.2363, lon: 76.8763 },
  { id: 'm-moskva', name: 'Москва', lat: 43.2297, lon: 76.8655 },
  { id: 'm-saryarka', name: 'Сарыарка', lat: 43.2229, lon: 76.8434 },
  { id: 'm-momyshuly', name: 'Бауыржан Момышулы', lat: 43.2213, lon: 76.8274 },
];
