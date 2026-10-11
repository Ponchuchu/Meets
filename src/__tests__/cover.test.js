/* global it, expect */
import React from 'react';
import { Image } from 'react-native';
import { act, create } from 'react-test-renderer';
import { EventCover } from '../ui/EventCover';

global.IS_REACT_ACT_ENVIRONMENT = true;

it('новая обложка загружается после ошибки предыдущей', async () => {
  let tree;
  await act(async () => { tree = create(<EventCover category="art" cover="https://example.test/old.jpg" />); });
  await act(async () => tree.root.findByType(Image).props.onError());
  expect(tree.root.findAllByType(Image)).toHaveLength(0);
  await act(async () => tree.update(<EventCover category="art" cover="https://example.test/new.jpg" />));
  expect(tree.root.findByType(Image).props.source).toEqual({ uri: 'https://example.test/new.jpg' });
  await act(async () => tree.unmount());
}, 15000);

it('запоздалая ошибка старого фото не скрывает новое', async () => {
  let tree;
  await act(async () => { tree = create(<EventCover category="art" cover="https://example.test/old.jpg" />); });
  const oldError = tree.root.findByType(Image).props.onError;
  await act(async () => tree.update(<EventCover category="art" cover="https://example.test/new.jpg" />));
  await act(async () => oldError());
  expect(tree.root.findByType(Image).props.source).toEqual({ uri: 'https://example.test/new.jpg' });
  await act(async () => tree.unmount());
});
