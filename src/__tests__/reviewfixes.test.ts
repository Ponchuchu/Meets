import * as Location from 'expo-location';
import { watchMapPosition } from '../live/watchMapPosition';
import { startIntroReveal } from '../features/auth/introTiming';
import { eventStatusLabel } from '../event/availability';

jest.mock('expo-location', () => ({ Accuracy: { Balanced: 1 }, getForegroundPermissionsAsync: jest.fn(), hasServicesEnabledAsync: jest.fn(), getLastKnownPositionAsync: jest.fn(), watchPositionAsync: jest.fn() }));
const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe('остановка геолокации карты', () => {
  beforeEach(() => {
    jest.mocked(Location.getForegroundPermissionsAsync).mockResolvedValue({ granted: true } as Location.LocationPermissionResponse);
    jest.mocked(Location.hasServicesEnabledAsync).mockResolvedValue(true);
    jest.mocked(Location.getLastKnownPositionAsync).mockResolvedValue(null);
  });
  afterEach(() => jest.resetAllMocks());

  it('без разрешения не запускает подписку', async () => {
    jest.mocked(Location.getForegroundPermissionsAsync).mockResolvedValue({ granted: false } as Location.LocationPermissionResponse);
    const off = jest.fn();
    watchMapPosition(jest.fn(), off);
    await flush();
    expect(off).toHaveBeenCalledTimes(1);
    expect(Location.watchPositionAsync).not.toHaveBeenCalled();
  });

  it('останавливает подписку, созданную после ухода; новые точки не доставляет', async () => {
    let resolve!: (sub: Location.LocationSubscription) => void;
    jest.mocked(Location.watchPositionAsync).mockReturnValue(new Promise((r) => { resolve = r; }));
    const point = jest.fn(); const remove = jest.fn();
    const stop = watchMapPosition(point, jest.fn());
    await flush();
    stop(); resolve({ remove });
    await flush();
    expect(remove).toHaveBeenCalledTimes(1);
    const callback = jest.mocked(Location.watchPositionAsync).mock.calls[0][1];
    callback({ coords: { latitude: 43, longitude: 76 } } as Location.LocationObject);
    expect(point).not.toHaveBeenCalled();
  });

  it('уход до получения последней точки не создаёт новую подписку', async () => {
    let resolve!: (p: Location.LocationObject | null) => void;
    jest.mocked(Location.getLastKnownPositionAsync).mockReturnValue(new Promise((r) => { resolve = r; }));
    const stop = watchMapPosition(jest.fn(), jest.fn());
    await flush(); stop(); resolve(null); await flush();
    expect(Location.watchPositionAsync).not.toHaveBeenCalled();
  });

  it('обычная остановка отключает готовую подписку один раз', async () => {
    const remove = jest.fn();
    jest.mocked(Location.watchPositionAsync).mockResolvedValue({ remove });
    const stop = watchMapPosition(jest.fn(), jest.fn());
    await flush(); stop(); stop();
    expect(remove).toHaveBeenCalledTimes(1);
  });
});

describe('короткая заставка', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());
  const subscribe = jest.fn(() => jest.fn());
  it('до входа не ждёт карту: завершается через 2,6 секунды', () => {
    const end = jest.fn();
    startIntroReveal({ map: () => ({ mapActive: false, mapReady: false }), subscribe, open: jest.fn(), end });
    jest.advanceTimersByTime(2600);
    expect(end).toHaveBeenCalledTimes(1);
    jest.runAllTimers(); expect(end).toHaveBeenCalledTimes(1);
  });
  it('незагруженная карта не растягивает запуск дольше 3,2 секунды', () => {
    const end = jest.fn(); const open = jest.fn();
    startIntroReveal({ map: () => ({ mapActive: true, mapReady: false }), subscribe, open, end });
    jest.advanceTimersByTime(2500); expect(open).not.toHaveBeenCalled();
    jest.advanceTimersByTime(700); expect(end).toHaveBeenCalledTimes(1);
  });
  it('уход отменяет ожидающие действия и подписку', () => {
    const end = jest.fn(); const open = jest.fn(); const unsub = jest.fn();
    const stop = startIntroReveal({ map: () => ({ mapActive: true, mapReady: false }), subscribe: () => unsub, open, end });
    stop(); jest.runAllTimers();
    expect(open).not.toHaveBeenCalled(); expect(end).not.toHaveBeenCalled(); expect(unsub).toHaveBeenCalledTimes(1);
  });
  it('поздняя готовность карты раскрывает её один раз до предельного срока', () => {
    let listener!: () => void;
    const state = { mapActive: true, mapReady: false };
    const open = jest.fn(); const end = jest.fn();
    startIntroReveal({ map: () => state, subscribe: (fn) => { listener = fn; return jest.fn(); }, open, end });
    jest.advanceTimersByTime(2250);
    state.mapReady = true; listener(); listener();
    jest.advanceTimersByTime(650);
    expect(open).toHaveBeenCalledTimes(1); expect(end).toHaveBeenCalledTimes(1);
    jest.runAllTimers(); expect(end).toHaveBeenCalledTimes(1);
  });
});

it('снятый план получает понятную отметку, опубликованный остаётся обычным', () => {
  expect(eventStatusLabel({ status: 'archived' })).toBe('Событие удалено из афиши');
  expect(eventStatusLabel({ status: 'draft' })).toBe('Событие снято с карты');
  expect(eventStatusLabel({ status: 'published' })).toBeNull();
});
