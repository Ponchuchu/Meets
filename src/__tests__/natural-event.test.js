/* global jest, it, expect */
import React from 'react';
import { act, create } from 'react-test-renderer';
import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';
import { NaturalEvent } from '../feed/NaturalEvent';
jest.mock('../ui/EventMedia', () => ({ eventMedia: e => e.media ?? [{ type: 'image', url: e.cover }], EventMedia: () => null }));
jest.mock('lucide-react-native', () => Object.fromEntries(['ArrowUpRight','CalendarPlus','Check','ChevronLeft','ChevronRight','Clock','EyeOff','MapPin'].map(name => [name, name])));
global.IS_REACT_ACT_ENVIRONMENT = true;
const e = { id: 'natural', title: 'Настоящая афиша с длинным названием события', category: 'concert', startsAt: '2026-11-21T15:00:00Z', endsAt: null, isFree: false, priceMin: 12000, priceMax: null, venueName: 'Дворец спорта', address: 'Абая, 44', about: '', cover: 'https://example.test/poster.jpg', goingCount: 0 };
async function render(event = e) {
  let tree;
  await act(async () => { tree = create(<NaturalEvent event={event} now={new Date('2026-11-09')} width={300} active planned={false} onOpen={() => {}} onPlan={() => {}} onSkip={() => {}} onFeedback={() => {}} />); });
  return tree;
}
it('portrait owns its full natural height and uses one uncropped image without blur', async () => {
  const tree = await render();
  await act(async () => tree.root.findByType(Image).props.onLoad({ source: { width: 1200, height: 1800 } }));
  const box = tree.root.findAllByType(View).map(n => StyleSheet.flatten(n.props.style)).find(s => s?.width === 300 && s?.height === 450);
  expect(box).toBeDefined();
  expect(tree.root.findAllByType(Image)).toHaveLength(1);
  expect(tree.root.findByType(Image).props.contentFit).toBe('contain');
  expect(tree.root.findByType(Image).props.blurRadius).toBeUndefined();
  await act(async () => tree.unmount());
});
it('landscape owns less height and a failed source leaves a usable event entry', async () => {
  const tree = await render({ ...e, id: 'wide', cover: 'https://example.test/wide.jpg' });
  await act(async () => tree.root.findByType(Image).props.onLoad({ source: { width: 1800, height: 900 } }));
  expect(tree.root.findAllByType(View).some(n => StyleSheet.flatten(n.props.style)?.height === 150)).toBe(true);
  await act(async () => tree.root.findByType(Image).props.onError());
  expect(tree.root.findAllByType(Image)).toHaveLength(0);
  expect(tree.root.findAll(n => n.props.accessibilityLabel === `Пойду: ${e.title}`).length).toBeGreaterThan(0);
  await act(async () => tree.unmount());
});

it('events without media retain title and actions', async () => {
  const tree = await render({ ...e, media: [], cover: null });
  expect(tree.root.findAllByType(Image)).toHaveLength(0);
  expect(tree.root.findAll(n => n.props.accessibilityLabel === `Пойду: ${e.title}`).length).toBeGreaterThan(0);
  await act(async () => tree.unmount());
});
