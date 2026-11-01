/* global jest, it, expect */
import React from 'react';
import { act, create } from 'react-test-renderer';
import { StyleSheet, Text, View } from 'react-native';
import { FriendPin } from '../map/pins';
import { PlacePin } from '../map/ui/PlacePin';
import { Avatar } from '../ui/Avatar';

jest.mock('lucide-react-native', () => ({ Battery: 'Battery', BatteryLow: 'BatteryLow', Clock3: 'Clock3', Zap: 'Zap', Home: 'Home', Briefcase: 'Briefcase', GraduationCap: 'GraduationCap', Dumbbell: 'Dumbbell', TreePine: 'TreePine', Star: 'Star', Heart: 'Heart' }));
jest.mock('../ui/Avatar', () => ({ Avatar: jest.fn(() => null) }));
jest.mock('../profile/frames', () => ({ frameById: () => ({ color: '#2447B8' }) }));
jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: { View: require('react-native').View },
  useSharedValue: initial => require('react').useRef({ value: initial, get() { return this.value; }, set(value) { this.value = value; } }).current,
  useAnimatedStyle: fn => fn(),
  withTiming: value => value,
  withRepeat: value => value,
  Easing: { linear: value => value },
}));
global.IS_REACT_ACT_ENVIRONMENT = true;
const person = { id: 'friend', name: 'Друг', initial: 'Д', photo: null, tint: '#E2DDD0' };
const spot = { personId: 'friend', lat: 43.2, lon: 76.9, state: 'here', place: 'Был здесь', battery: 82, minutesAgo: 6000 };

it('дальняя карта показывает маленькое лицо без перекрывающей карту длинной плашки', async () => {
  let tree;
  await act(async () => { tree = create(<FriendPin person={person} spot={spot} compact onPress={() => undefined} />); });
  expect(tree.root.findByType(Avatar).props.size).toBe(28);
  expect(tree.root.findAllByType(Text)).toHaveLength(0);
  await act(async () => tree.update(<FriendPin person={person} spot={spot} onPress={() => undefined} />));
  expect(tree.root.findByType(Avatar).props.size).toBe(38);
  expect(tree.root.findAllByType(Text).length).toBeGreaterThan(0);
  await act(async () => tree.unmount());
});

it('кадры интерполяции координат не перерисовывают аватар; новый заряд обновляет его плашку', async () => {
  let tree;
  await act(async () => { tree = create(<FriendPin person={person} spot={{ ...spot, minutesAgo: 0 }} onPress={() => undefined} />); });
  const renders = Avatar.mock.calls.length;
  await act(async () => tree.update(<FriendPin person={person} spot={{ ...spot, minutesAgo: 0, lat: 43.20001 }} onPress={() => undefined} />));
  expect(Avatar.mock.calls.length).toBe(renders);
  await act(async () => tree.update(<FriendPin person={person} spot={{ ...spot, minutesAgo: 0, battery: 70 }} onPress={() => undefined} />));
  expect(tree.root.findAllByType(Text).some(n => n.props.children === '70%')).toBe(true);
  await act(async () => tree.unmount());
});

it('дом — компактная плитка; подпись не появляется в дальнем режиме даже для длинного имени', async () => {
  let tree;
  const title = 'Очень длинное название своего места';
  await act(async () => { tree = create(<PlacePin kind="home" title={title} label compact />); });
  expect(tree.root.findAllByType(Text)).toHaveLength(0);
  expect(tree.root.findAllByType(View).some(n => StyleSheet.flatten(n.props.style)?.width === 26)).toBe(true);
  await act(async () => tree.update(<PlacePin kind="home" title={title} label />));
  expect(tree.root.findAllByType(Text).find(n => n.props.children === title).props.numberOfLines).toBe(1);
  expect(tree.root.findAllByType(View).some(n => StyleSheet.flatten(n.props.style)?.width === 34)).toBe(true);
  await act(async () => tree.unmount());
});
