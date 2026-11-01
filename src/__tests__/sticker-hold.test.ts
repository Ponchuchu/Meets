import { createStickerHold, STICKER_HOLD_LIMIT } from '../stickers/hold';

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

it('удержание начинает очередь сразу и останавливается ровно на 100', () => {
  const tick = jest.fn();
  const hold = createStickerHold(tick);
  hold.start();
  expect(tick).toHaveBeenCalledWith(1);
  hold.start(); // повторное событие не запускает второй таймер
  jest.advanceTimersByTime(20000);
  expect(tick).toHaveBeenCalledTimes(STICKER_HOLD_LIMIT);
  expect(tick.mock.calls.at(-1)).toEqual([100]);
  expect(jest.getTimerCount()).toBe(0);
});

it('отпускание отменяет продолжение, следующее удержание начинает с одного', () => {
  const tick = jest.fn();
  const hold = createStickerHold(tick);
  hold.start();
  jest.advanceTimersByTime(240);
  expect(tick).toHaveBeenCalledTimes(3);
  hold.stop(); hold.stop();
  jest.advanceTimersByTime(10000);
  expect(tick).toHaveBeenCalledTimes(3);
  hold.start();
  expect(tick.mock.calls.at(-1)).toEqual([1]);
  hold.stop();
});

it('отмена из обработчика не оставляет следующего таймера', () => {
  const hold = createStickerHold(() => hold.stop());
  hold.start();
  expect(jest.getTimerCount()).toBe(0);
});
