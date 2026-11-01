import { cameraNeedsRecovery, rememberHealthyCamera } from '../map/cameraHealth';

const almaty = { lat: 43.2389, lon: 76.9458, zoom: 14.9 };

it('восстанавливает частично обнулённый центр даже после первого жеста', () => {
  expect(cameraNeedsRecovery({ lat: 2.54e-13, lon: almaty.lon }, almaty, true)).toBe(true);
  expect(cameraNeedsRecovery({ lat: almaty.lat, lon: 0 }, almaty, true)).toBe(true);
  expect(cameraNeedsRecovery({ lat: 0, lon: 0 }, almaty, true)).toBe(true);
});

it('потерянная ось и невалидный зум не отравляют сохранённую камеру для следующего открытия', () => {
  expect(rememberHealthyCamera(almaty, { ...almaty, lat: 0 }, almaty, true)).toBe(almaty);
  expect(rememberHealthyCamera(null, { ...almaty, lat: 0 }, almaty, true)).toBeNull();
  expect(rememberHealthyCamera(almaty, { ...almaty, zoom: Infinity }, almaty, true)).toBe(almaty);
  expect(rememberHealthyCamera(almaty, { ...almaty, lat: NaN }, almaty, true)).toBe(almaty);
});

it('сохраняет реальное перемещение пользователя и не считает нулевую координату GPS всегда ошибкой', () => {
  const moved = { lat: 44, lon: 77.5, zoom: 12 };
  expect(cameraNeedsRecovery(moved, almaty, true)).toBe(false);
  expect(rememberHealthyCamera(almaty, moved, almaty, true)).toBe(moved);
  expect(cameraNeedsRecovery({ lat: 0, lon: 0 }, { lat: 0, lon: 0 }, false)).toBe(false);
  expect(cameraNeedsRecovery({ lat: 0, lon: 77 }, { lat: 0, lon: 77 }, true)).toBe(false);
});

it('учитывает перенос долготы и восстанавливает большой скачок до ручного движения', () => {
  expect(cameraNeedsRecovery({ lat: 43, lon: -179.9999 }, { lat: 43, lon: 179.9999 }, false)).toBe(false);
  expect(cameraNeedsRecovery({ lat: 44, lon: 77.5 }, almaty, false)).toBe(true);
  expect(cameraNeedsRecovery({ lat: 43, lon: NaN }, almaty, true)).toBe(true);
});
