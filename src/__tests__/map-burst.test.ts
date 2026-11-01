import { createMapBurstQueue } from '../stickers/mapBurst';
it('объединяет очередь отдельно для каждого адресата и стикера', () => {
  jest.useFakeTimers();
  const send = jest.fn(); const q = createMapBurstQueue(send);
  for (let i = 0; i < 100; i++) q.add('friend', 'heart');
  q.add('friend', 'fire'); q.add('other', 'heart');
  expect(send).not.toHaveBeenCalled();
  jest.advanceTimersByTime(250);
  expect(send).toHaveBeenCalledTimes(3);
  expect(send).toHaveBeenCalledWith('friend', 'heart', 100);
  q.flush(); expect(send).toHaveBeenCalledTimes(3);
  jest.useRealTimers();
});
