const made: { play: jest.Mock; pause: jest.Mock; seekTo: jest.Mock; remove: jest.Mock; volume: number }[] = [];
jest.mock('expo-audio', () => ({ createAudioPlayer: () => {
  const p = { play: jest.fn(), pause: jest.fn(), seekTo: jest.fn().mockResolvedValue(undefined), remove: jest.fn(), volume: 0 };
  made.push(p); return p;
} }));
jest.mock('expo-haptics', () => ({ selectionAsync: jest.fn().mockResolvedValue(undefined) }));
import { playSound } from '../stickers/reactions';

it('переиспользует звук и освобождает проигрыватели после паузы', async () => {
  jest.useFakeTimers();
  playSound('heart');
  playSound('heart');
  await Promise.resolve();
  expect(made).toHaveLength(1);
  expect(made[0].seekTo).toHaveBeenCalledWith(0);
  expect(made[0].play).toHaveBeenCalledTimes(2);
  jest.advanceTimersByTime(30000);
  expect(made[0].remove).toHaveBeenCalledTimes(1);
  jest.useRealTimers();
});
