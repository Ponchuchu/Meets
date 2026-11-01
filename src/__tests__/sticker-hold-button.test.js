/* global jest, beforeEach, afterEach, it, expect */
import React from 'react';
import { act, create } from 'react-test-renderer';
import { AppState, Text } from 'react-native';
import * as Haptics from 'expo-haptics';
import { StickerHoldButton } from '../stickers/StickerHoldButton';

const mockListeners = new Set();
jest.mock('expo-haptics', () => ({ ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' }, impactAsync: jest.fn(async () => undefined) }));
jest.mock('../stickers/StickerView', () => ({ StickerView: () => null }));
jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: { View: require('react-native').View },
  useSharedValue: initial => require('react').useRef({ value: initial, get() { return this.value; }, set(value) { this.value = value; } }).current,
  useAnimatedStyle: fn => fn(),
  useReducedMotion: () => true,
  withTiming: value => value,
  withSequence: (...values) => values.at(-1),
}));
global.IS_REACT_ACT_ENVIRONMENT = true;
const sticker = { id: 'heart', label: 'Сердце', rot: 0 };
const button = tree => tree.root.findAll(n => typeof n.props.onLongPress === 'function')[0];
const render = async (props = {}) => {
  let tree;
  await act(async () => { tree = create(<StickerHoldButton st={sticker} index={2} onSticker={() => undefined} {...props} />); });
  return tree;
};
beforeEach(() => {
  jest.useFakeTimers(); jest.clearAllMocks(); mockListeners.clear(); AppState.currentState = 'active';
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => { mockListeners.add(listener); return { remove: () => mockListeners.delete(listener) }; });
});
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });

it('быстрый тап отправляет ровно один, простой уход пальца без тапа ничего не отправляет', async () => {
  const onSticker = jest.fn(); const tree = await render({ onSticker });
  await act(async () => { button(tree).props.onPressIn(); button(tree).props.onPressOut(); });
  expect(onSticker).not.toHaveBeenCalled();
  await act(async () => button(tree).props.onPress());
  expect(onSticker.mock.calls).toEqual([[2, 1]]);
  await act(async () => tree.unmount());
  await act(async () => jest.advanceTimersByTime(5000));
  expect(onSticker).toHaveBeenCalledTimes(1);
});

it('удержание отправляет максимум100 и подавляет лишний тап после отпускания', async () => {
  const onSticker = jest.fn(); const onHoldEnd = jest.fn(); const tree = await render({ onSticker, onHoldEnd });
  await act(async () => { button(tree).props.onPressIn(); button(tree).props.onLongPress(); });
  await act(async () => jest.advanceTimersByTime(20000));
  await act(async () => { button(tree).props.onLongPress(); jest.advanceTimersByTime(20000); });
  expect(onSticker).toHaveBeenCalledTimes(100);
  expect(onSticker.mock.calls.every(call => call[0] === 2 && call[1] === 1)).toBe(true);
  expect(tree.root.findAllByType(Text).some(n => n.props.children?.join?.('') === '×100')).toBe(true);
  expect(Haptics.impactAsync.mock.calls.length).toBeLessThan(65);
  expect(Haptics.impactAsync.mock.calls.some(call => call[0] === 'heavy')).toBe(true);
  await act(async () => { button(tree).props.onPressOut(); button(tree).props.onPress(); });
  expect(onSticker).toHaveBeenCalledTimes(100);
  expect(onHoldEnd).toHaveBeenCalledTimes(1);
  expect(mockListeners.size).toBe(0);
  await act(async () => tree.unmount());
});

it('фон и unmount прекращают отправку и удаляют таймеры/подписку', async () => {
  const onSticker = jest.fn(); const tree = await render({ onSticker });
  await act(async () => { button(tree).props.onPressIn(); button(tree).props.onLongPress(); });
  expect(mockListeners.size).toBe(1);
  await act(async () => { AppState.currentState = 'background'; for (const listener of [...mockListeners]) listener('background'); });
  await act(async () => jest.advanceTimersByTime(5000));
  expect(onSticker).toHaveBeenCalledTimes(1);
  expect(mockListeners.size).toBe(0);
  await act(async () => tree.unmount());
  AppState.currentState = 'active';
  const next = await render({ onSticker });
  await act(async () => { button(next).props.onPressIn(); button(next).props.onLongPress(); });
  await act(async () => next.unmount());
  await act(async () => jest.advanceTimersByTime(5000));
  expect(onSticker).toHaveBeenCalledTimes(2);
  expect(mockListeners.size).toBe(0);
});

it('другая удерживаемая плитка может отклонить второе удержание без случайного тапа', async () => {
  const onSticker = jest.fn(); const tree = await render({ onSticker, onHoldStart: () => false });
  await act(async () => { button(tree).props.onPressIn(); button(tree).props.onLongPress(); button(tree).props.onPressOut(); button(tree).props.onPress(); jest.advanceTimersByTime(5000); });
  expect(onSticker).not.toHaveBeenCalled();
  await act(async () => tree.unmount());
});
