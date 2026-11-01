/* global jest, beforeEach, afterEach, it, expect */
import React from 'react';
import { act, create } from 'react-test-renderer';
import { SwipeCard } from '../feed/SwipeCard';
import { FeedCard } from '../feed/FeedCard';

const mockGestures = [];
jest.mock('../feed/FeedCard', () => ({ FeedCard: jest.fn(() => null) }));
jest.mock('../state/feed', () => ({ HINT_IDLE_MS: 45000, hintDue: () => false, useFeed: { getState: () => ({ hintShown: [] }) } }));
jest.mock('react-native-worklets', () => ({ scheduleOnRN: (fn, ...args) => fn(...args) }));
jest.mock('react-native-gesture-handler', () => {
  const build = kind => {
    const gesture = { kind, handlers: {} };
    for (const name of ['enabled', 'minDuration', 'minDistance', 'onBegin', 'onChange', 'onEnd', 'onFinalize']) gesture[name] = value => { gesture.handlers[name] = value; return gesture; };
    mockGestures.push(gesture);
    return gesture;
  };
  return { Gesture: { Pan: () => build('pan'), Tap: () => build('tap'), LongPress: () => build('long'), Race: (...gestures) => gestures }, GestureDetector: ({ children }) => children };
});
jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: { View: require('react-native').View },
  useSharedValue: value => require('react').useRef({ value, get() { return this.value; }, set(next) { this.value = next; } }).current,
  useAnimatedStyle: fn => fn(),
  useAnimatedReaction: () => undefined,
  withTiming: value => value, withSpring: value => value, withDelay: (_ms, value) => value,
  withSequence: (...values) => values.at(-1),
  Easing: { out: fn => fn, in: fn => fn, inOut: fn => fn, cubic: n => n, quad: n => n },
}));
global.IS_REACT_ACT_ENVIRONMENT = true;
beforeEach(() => { jest.useFakeTimers(); mockGestures.length = 0; });
afterEach(() => jest.useRealTimers());
const measurement = { height: 380, mediaHeight: 180, width: 360, maxHeight: 540, fontScale: 1 };
const render = async () => {
  const measured = jest.fn(), ref = React.createRef(); let tree;
  const expand = { get: () => 0, set: () => undefined };
  await act(async () => { tree = create(<SwipeCard ref={ref} e={{ id: 'event' }} people={[]} now={new Date()} k={0} top width={360} height={540} maxHeight={540}
    target={{ x: 20, y: 400 }} enterFrom={null} onDecide={() => undefined} onTap={() => undefined} onReveal={() => undefined} onRevealEnd={() => undefined} onUndo={() => undefined} expand={expand} onMeasured={measured} />); });
  return { tree, measured, ref };
};

it('поздний onLoad не меняет геометрию под пальцем, измерение применяется после отпускания', async () => {
  const { tree, measured } = await render();
  await act(async () => mockGestures.filter(g => g.kind === 'pan').at(-1).handlers.onBegin());
  await act(async () => tree.root.findByType(FeedCard).props.onMeasured(measurement));
  expect(measured).not.toHaveBeenCalled();
  await act(async () => mockGestures.filter(g => g.kind === 'pan').at(-1).handlers.onFinalize({}, false));
  await act(async () => jest.advanceTimersByTime(279));
  expect(measured).not.toHaveBeenCalled();
  await act(async () => jest.advanceTimersByTime(1));
  expect(measured).toHaveBeenCalledWith('event', measurement);
  await act(async () => tree.unmount());
});

it('полёт фиксирует рамку до решения; после unmount нет отложенного изменения размера', async () => {
  const { tree, measured, ref } = await render();
  await act(async () => ref.current.fly('go'));
  await act(async () => tree.root.findByType(FeedCard).props.onMeasured(measurement));
  await act(async () => jest.advanceTimersByTime(1000));
  expect(measured).not.toHaveBeenCalled();
  await act(async () => tree.unmount());
  await act(async () => jest.advanceTimersByTime(1000));
  expect(measured).not.toHaveBeenCalled();
});
