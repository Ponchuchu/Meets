import * as Location from 'expo-location';
jest.mock('expo-location', () => ({ getForegroundPermissionsAsync: jest.fn(), getLastKnownPositionAsync: jest.fn() }));
it('карта, открытая спустя несколько секунд после запуска, получает последнюю точку', async () => {
  jest.useFakeTimers();
  try {
    (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
    (Location.getLastKnownPositionAsync as jest.Mock).mockResolvedValue({ coords: { latitude: 43.25, longitude: 76.94 } });
    let module!: typeof import('../live/startPoint');
    jest.isolateModules(() => { module = jest.requireActual('../live/startPoint'); });
    jest.advanceTimersByTime(10000);
    await expect(module.startCamera()).resolves.toEqual({ lat: 43.25, lon: 76.94, zoom: module.START_ZOOM });
  } finally { jest.useRealTimers(); }
});
