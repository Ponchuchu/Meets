/* global jest, it, expect, beforeEach */
import React from 'react';
import { act, create } from 'react-test-renderer';
import { AppState } from 'react-native';
import { EventMedia } from '../ui/EventMedia';

jest.mock('expo-router', () => ({ useFocusEffect: callback => require('react').useEffect(callback, [callback]) }));
jest.mock('expo-video', () => ({ useVideoPlayer: () => mockPlayer, VideoView: 'VideoView' }));
jest.mock('lucide-react-native', () => ({ Volume2: 'Volume2', VolumeX: 'VolumeX' }));
const listeners = new Map();
const mockPlayer = {
  play: jest.fn(), pause: jest.fn(), muted: true, videoTrack: null,
  addListener: jest.fn((name, callback) => { listeners.set(name, callback); return { remove: () => listeners.delete(name) }; }),
};
global.IS_REACT_ACT_ENVIRONMENT = true;
beforeEach(() => { listeners.clear(); jest.clearAllMocks(); mockPlayer.muted = true; AppState.currentState = 'active'; });

it('рилс без постера сообщает размер видео и даёт включить звук в карточке', async () => {
  const onAspect = jest.fn();
  let tree;
  await act(async () => { tree = create(<EventMedia items={[{ type: 'video', url: 'https://example.test/reel.mp4' }]} height={300} onAspect={onAspect} />); });
  await act(async () => listeners.get('sourceLoad')({ availableVideoTracks: [{ size: { width: 1080, height: 1920 } }] }));
  expect(onAspect).toHaveBeenLastCalledWith(1080 / 1920);
  const sound = tree.root.findAll(n => n.props.accessibilityLabel === 'Включить звук' && typeof n.props.onPress === 'function')[0];
  expect(sound).toBeDefined();
  await act(async () => sound.props.onPress());
  expect(mockPlayer.muted).toBe(false);
  await act(async () => tree.unmount());
  expect(mockPlayer.pause).toHaveBeenCalled();
});

it('уход с активной карточки освобождает видео и слушателей метаданных', async () => {
  const items = [{ type: 'video', url: 'https://example.test/reel.mp4' }];
  let tree;
  await act(async () => { tree = create(<EventMedia items={items} height={300} />); });
  expect(listeners.has('sourceLoad')).toBe(true);
  await act(async () => tree.update(<EventMedia items={items} height={300} active={false} />));
  expect(mockPlayer.pause).toHaveBeenCalled();
  expect(listeners.has('sourceLoad')).toBe(false);
  expect(listeners.has('videoTrackChange')).toBe(false);
  await act(async () => tree.unmount());
});
