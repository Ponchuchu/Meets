/* eslint-disable @typescript-eslint/no-require-imports -- Jest mock factories need local imports. */
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { AppState, FlatList, View } from 'react-native';
import { EventMedia, type Media } from './EventMedia';

const mockBlur = new Set<() => void>();
const mockAppStateListeners = new Set<(state: string) => void>();
const mockScrollToOffset = jest.fn();
const mockPlayers: { play: jest.Mock; pause: jest.Mock; release: jest.Mock }[] = [];

jest.mock('expo-router', () => ({
  useFocusEffect: (effect: () => () => void) => {
    const React = require('react');
    React.useEffect(() => {
      const cleanup = effect();
      mockBlur.add(cleanup);
      return () => { mockBlur.delete(cleanup); cleanup(); };
    }, [effect]);
  },
}));
jest.mock('react-native', () => {
  const React = require('react');
  return {
    Platform: jest.requireActual('react-native').Platform,
    View: 'View', Text: 'Text', Pressable: 'Pressable',
    StyleSheet: { absoluteFill: {}, create: (styles: unknown) => styles },
    AppState: {
      currentState: 'active',
      addEventListener: (_event: string, callback: (state: string) => void) => {
        mockAppStateListeners.add(callback);
        return { remove: () => mockAppStateListeners.delete(callback) };
      },
    },
    FlatList: React.forwardRef(function MockFlatList(props: { data: Media[]; renderItem: (x: { item: Media; index: number }) => unknown }, ref: unknown) {
      React.useImperativeHandle(ref, () => ({ scrollToOffset: mockScrollToOffset }));
      return React.createElement('FlatList', props, props.data.map((item, index) => React.createElement(React.Fragment, { key: item.url }, props.renderItem({ item, index }))));
    }),
  };
});
jest.mock('expo-image', () => ({ Image: 'Image' }));
jest.mock('lucide-react-native', () => ({ Volume2: 'Volume2', VolumeX: 'VolumeX' }));
jest.mock('../theme', () => ({ colors: { ink: '#17161A' }, fonts: { body600: 'font', body500: 'font' } }));
jest.mock('../data/photos', () => ({ photo: (uri: string) => ({ uri }) }));
jest.mock('expo-video', () => ({
  VideoView: 'VideoView',
  useVideoPlayer: (source: { uri: string }, setup: (player: unknown) => void) => {
    const React = require('react');
    const player = React.useMemo(() => {
      const value = { play: jest.fn(), pause: jest.fn(), release: jest.fn(), addListener: () => ({ remove: jest.fn() }) };
      mockPlayers.push(value);
      setup(value);
      return value;
    // Like the native hook, initialize once per source, not for each setup callback identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [source.uri]);
    React.useEffect(() => () => player.release(), [player]);
    return player;
  },
}));

const image: Media = { type: 'image', url: 'https://example.test/image.jpg' };
const video: Media = { type: 'video', url: 'https://example.test/video.mp4', poster: 'https://example.test/poster.jpg' };
let tree: ReactTestRenderer;
function mount(items: Media[], props: { active?: boolean; gallery?: boolean } = {}) {
  act(() => { tree = create(<EventMedia items={items} height={200} {...props} />); });
  act(() => tree.root.findAllByType(View).find(node => node.props.onLayout)!.props.onLayout({ nativeEvent: { layout: { width: 300 } } }));
}
function background(state: string) {
  AppState.currentState = state as typeof AppState.currentState;
  for (const callback of [...mockAppStateListeners]) callback(state);
}
beforeEach(() => {
  mockBlur.clear(); mockAppStateListeners.clear(); mockPlayers.length = 0;
  mockScrollToOffset.mockClear();
  AppState.currentState = 'active';
});
afterEach(() => { if (tree) act(() => tree.unmount()); });

test('a single cover does not mount a scrolling list or a decoder', () => {
  mount([image]);
  expect(tree.root.findAllByType(FlatList)).toHaveLength(0);
  expect(mockPlayers).toHaveLength(0);
});

test('inactive media does not allocate a video player; activation allocates only one', () => {
  mount([image, video], { active: false });
  expect(mockPlayers).toHaveLength(0);
  act(() => tree.update(<EventMedia items={[image, video]} height={200} active />));
  expect(mockPlayers).toHaveLength(1);
  expect(mockPlayers[0].play).toHaveBeenCalled();
  expect(tree.root.findAllByType(FlatList)).toHaveLength(0);
  act(() => tree.update(<EventMedia items={[image, video]} height={200} active={false} />));
  expect(mockPlayers[0].release).toHaveBeenCalled();
});

test('blur pauses native playback before deferred parent rendering can unmount it', () => {
  mount([video]);
  const player = mockPlayers[0];
  player.pause.mockClear();
  act(() => {
    for (const cleanup of [...mockBlur]) cleanup();
    // Assertion runs inside the batch, before React flushes EventMedia's setFocused(false).
    expect(player.pause).toHaveBeenCalled();
  });
});

test('background pauses immediately and foreground creates a visible player again', () => {
  mount([video]);
  const first = mockPlayers[0];
  first.pause.mockClear();
  act(() => {
    background('background');
    expect(first.pause).toHaveBeenCalled();
  });
  expect(first.release).toHaveBeenCalled();
  act(() => background('active'));
  expect(mockPlayers).toHaveLength(2);
  expect(mockPlayers[1].play).toHaveBeenCalled();
});

test('only the selected gallery video has a player and a shortened gallery clamps its page', () => {
  const secondVideo: Media = { ...video, url: 'https://example.test/second.mp4' };
  mount([image, video, secondVideo], { gallery: true });
  expect(mockPlayers).toHaveLength(0);
  act(() => tree.root.findByType(FlatList).props.onMomentumScrollEnd({ nativeEvent: { contentOffset: { x: 600 } } }));
  expect(mockPlayers).toHaveLength(1);
  const first = mockPlayers[0];
  act(() => tree.update(<EventMedia items={[image, video]} height={200} gallery />));
  expect(first.release).toHaveBeenCalled();
  expect(mockPlayers).toHaveLength(2);
  expect(mockPlayers[1].play).toHaveBeenCalled();
  expect(mockScrollToOffset).toHaveBeenCalledWith({ offset: 300, animated: false });
});
