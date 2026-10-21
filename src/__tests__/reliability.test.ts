import { withTimeout } from '../data/client';
import { isDbError, reportDb, useNet } from '../live/net';
import { registerPlayback, usePlayback } from '../chat/playback';
import { photoSize } from '../chat/media';

jest.mock('expo-image-manipulator', () => ({ ImageManipulator: {}, SaveFormat: { JPEG: 'jpeg' } }));

describe('индикатор доступности сервера', () => {
  beforeEach(() => { reportDb(true); useNet.getState().setOnline(true); });
  it.each([
    { code: '42501', message: 'permission denied' },
    { code: 'PGRST202', message: 'function is missing' },
    { code: '42P01', message: 'relation does not exist' },
    new Error('no-session'), new Error('no-profile'), new Error('no-weather'),
    { status: 401, message: 'JWT expired' }, { status: 429, message: 'rate limit' },
    { name: 'FunctionsFetchError', message: 'Failed to fetch' },
  ])('не объявляет сервер недоступным из-за %j', error => expect(isDbError(error)).toBe(false));
  it.each([new Error('timeout'), new TypeError('Network request failed'), { status: 503 }, { status: 503, code: 'PGRST000' }, { code: 'PGRST003', message: 'pool timeout' }, { code: '08006', message: 'lost connection' }])(
    'распознаёт транспортный сбой %j', error => expect(isDbError(error)).toBe(true),
  );
  it('не переносит старые ошибки через потерю интернета', () => {
    reportDb(false, 1000); reportDb(false, 2000);
    useNet.getState().setOnline(false);
    reportDb(false, 3000);
    useNet.getState().setOnline(true);
    reportDb(false, 4000);
    expect(useNet.getState().serverDown).toBe(false);
  });
});

describe('таймауты запросов', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());
  it('освобождает таймер после ответа и ошибки', async () => {
    await expect(withTimeout(Promise.resolve('ok'))).resolves.toBe('ok');
    await Promise.resolve();
    expect(jest.getTimerCount()).toBe(0);
    await expect(withTimeout(Promise.reject(new Error('RLS')))).rejects.toThrow('RLS');
    await Promise.resolve();
    expect(jest.getTimerCount()).toBe(0);
  });
  it('завершает зависший запрос', async () => {
    const check = expect(withTimeout(new Promise(() => {}), 100)).rejects.toThrow('timeout');
    jest.advanceTimersByTime(100);
    await check;
  });
});

it('фото ограничено 1080 по длинной стороне без увеличения маленьких файлов', () => {
  expect(photoSize(4032, 3024)).toEqual({ width: 1080, height: 810 });
  expect(photoSize(800, 1600)).toEqual({ width: 540, height: 1080 });
  expect(photoSize(320, 240)).toEqual({ width: 320, height: 240 });
});

it('новое медиа останавливает предыдущее, а уход с экрана освобождает воспроизведение', () => {
  const voice = jest.fn(), circle = jest.fn();
  const offVoice = registerPlayback('voice', voice), offCircle = registerPlayback('circle', circle);
  usePlayback.getState().play('voice');
  usePlayback.getState().play('circle', true);
  expect(voice).toHaveBeenCalledTimes(1);
  expect(circle).not.toHaveBeenCalled();
  usePlayback.getState().focus(false);
  expect(circle).toHaveBeenCalledTimes(1);
  offVoice(); offCircle();
});
