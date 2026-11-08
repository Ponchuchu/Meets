/* global jest, it, expect */
import React, { useState } from 'react';
import { act, create } from 'react-test-renderer';
import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';
import { FeedCard } from '../feed/FeedCard';
import { EventMedia } from '../ui/EventMedia';

jest.mock('../ui/EventMedia', () => ({ ...jest.requireActual('../ui/EventMedia'), EventMedia: jest.fn(() => null) }));
jest.mock('lucide-react-native', () => ({ ChevronLeft: 'ChevronLeft', ChevronRight: 'ChevronRight', Clock: 'Clock', MapPin: 'MapPin', Ticket: 'Ticket' }));
jest.mock('../map/ui/AttractionPin', () => ({ AttractionPin: () => null }));
jest.mock('expo-video', () => ({ useVideoPlayer: jest.fn(), VideoView: 'VideoView' }));
jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: { View: require('react-native').View },
  useAnimatedStyle: fn => fn(),
  Extrapolation: { CLAMP: 'clamp' },
  interpolate: () => 0,
}));
global.IS_REACT_ACT_ENVIRONMENT = true;
jest.spyOn(require('react-native'), 'useWindowDimensions').mockReturnValue({ width: 390, height: 844, fontScale: 1, scale: 3 });

const event = {
  id: 'wide-poster', title: 'Очень длинное название события '.repeat(12), category: 'art',
  cover: 'https://example.test/landscape.jpg', about: 'Описание события',
  friendsGoing: [], goingCount: 0, lookingCount: 0,
  startsAt: '2026-11-01T14:00:00Z', venueName: 'Галерея', address: 'Абая, 10',
  priceMin: 1000, priceMax: null, isFree: false,
};
const render = async (e = event, height = 540, active = true) => {
  let tree;
  await act(async () => { tree = create(<FeedCard e={e} people={[]} now={new Date('2026-10-31')} height={height} active={active} />); });
  return tree;
};

it('широкая афиша задаёт реальную высоту карточки, без пустого низа и без наложения заголовка на постер', async () => {
  function Host() {
    const [height, setHeight] = useState(540);
    return <FeedCard e={event} people={[]} now={new Date('2026-10-31')} width={360} height={height} maxHeight={540} onMeasured={m => setHeight(m.height)} />;
  }
  let tree;
  await act(async () => { tree = create(<Host />); });
  const image = tree.root.findAllByType(Image).find(n => n.props.contentFit === 'contain');
  expect(image.props.source).toEqual({ uri: event.cover });
  const body = tree.root.findAllByType(View).find(n => n.props.onLayout);
  await act(async () => body.props.onLayout({ nativeEvent: { layout: { height: 200 } } }));
  await act(async () => image.props.onLoad({ source: { width: 1800, height: 900 } }));
  const card = tree.root.findAllByType(View).find(n => n.props.accessibilityLabel?.startsWith(event.title));
  expect(StyleSheet.flatten(card.props.style).height).toBe(380);
  expect(tree.root.findAllByType(Image).some(n => n.props.blurRadius > 0)).toBe(false);
  const title = tree.root.findAllByType(Text).find(n => n.props.children === event.title.trim());
  expect(title.props.numberOfLines).toBe(3);
  expect(StyleSheet.flatten(body.props.style).flex).toBeUndefined();
  expect(StyleSheet.flatten(body.props.style).flexShrink).toBe(0);
  expect(tree.root.findAllByType(Text).some(n => String(n.props.children).includes('Абая, 10'))).toBe(true);
  await act(async () => tree.unmount());
});

it('низкая карточка сохраняет название и факты, освобождая фото от необязательного описания', async () => {
  const tree = await render(event, 330);
  const text = tree.root.findAllByType(Text);
  expect(text.find(n => n.props.children === event.title.trim()).props.numberOfLines).toBe(2);
  expect(text.some(n => n.props.children === event.about)).toBe(false);
  expect(text.some(n => String(n.props.children).includes('1 000'))).toBe(true);
  await act(async () => tree.unmount());
});

it('ошибка первого фото не скрывает следующее; стрелки остаются доступными для касания', async () => {
  const media = [{ type: 'image', url: event.cover }, { type: 'image', url: 'https://example.test/portrait.jpg' }];
  const tree = await render({ ...event, media });
  await act(async () => tree.root.findAllByType(Image).find(n => n.props.contentFit === 'contain').props.onError());
  const next = tree.root.findAll(n => n.props.accessibilityLabel === 'Следующее фото' && typeof n.props.onPress === 'function')[0];
  expect(StyleSheet.flatten(next.props.style).width).toBeGreaterThanOrEqual(44);
  await act(async () => next.props.onPress());
  expect(tree.root.findAllByType(Image).find(n => n.props.contentFit === 'contain').props.source.uri).toBe(media[1].url);
  await act(async () => tree.unmount());
});

it('видео получает реальную оставшуюся высоту медиа и только один проигрыватель', async () => {
  const tree = await render({ ...event, media: [{ type: 'video', url: 'https://example.test/clip.mp4' }] });
  const body = tree.root.findAllByType(View).find(n => n.props.onLayout);
  await act(async () => body.props.onLayout({ nativeEvent: { layout: { height: 200 } } }));
  expect(tree.root.findAllByType(EventMedia)).toHaveLength(1);
  expect(tree.root.findByType(EventMedia).props.height).toBe(340);
  expect(tree.root.findAllByType(Image)).toHaveLength(0);
  await act(async () => tree.unmount());
});

it('горизонтальное фото постоянного места тоже сокращает всю карточку', async () => {
  const e = { ...event, spotId: 'park', spot: { id: 'park', name: 'Парк', kind: 'park', free: true, about: 'Тихая прогулка', photos: [event.cover] } };
  const measured = jest.fn();
  let tree;
  await act(async () => { tree = create(<FeedCard e={e} people={[]} now={new Date('2026-10-31')} width={360} height={540} maxHeight={540} onMeasured={measured} />); });
  await act(async () => tree.root.findAllByType(View).find(n => n.props.onLayout).props.onLayout({ nativeEvent: { layout: { height: 170 } } }));
  await act(async () => tree.root.findAllByType(Image).find(n => n.props.onLoad).props.onLoad({ source: { width: 1600, height: 800 } }));
  expect(measured.mock.calls.at(-1)[0]).toMatchObject({ height: 350, mediaHeight: 180 });
  await act(async () => tree.unmount());
});
