/* global jest, it, expect, beforeEach, afterEach */
import React, { useEffect } from 'react';
import { act, create } from 'react-test-renderer';
import { useSmoothSpots } from '../map/useSmooth';

global.IS_REACT_ACT_ENVIRONMENT = true;
let latest;
let nextFrame;
const a = [{ personId: 'friend', lat: 43.2, lon: 76.9 }];
const b = [{ personId: 'friend', lat: 43.201, lon: 76.901 }];
function Host({ spots, active }) { const value = useSmoothSpots(spots, active); useEffect(() => { latest = value; }, [value]); return null; }
beforeEach(() => {
  jest.spyOn(global, 'requestAnimationFrame').mockImplementation(fn => { nextFrame = fn; return 1; });
  jest.spyOn(global, 'cancelAnimationFrame').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

it('скрытая карта не запускает кадры и при возврате показывает актуальную точку', async () => {
  let tree;
  await act(async () => { tree = create(<Host spots={a} active={false} />); });
  await act(async () => tree.update(<Host spots={b} active={false} />));
  expect(requestAnimationFrame).not.toHaveBeenCalled();
  expect(latest).toEqual(b);
  await act(async () => tree.update(<Host spots={b} active />));
  expect(latest).toEqual(b);
  await act(async () => tree.unmount());
});

it('уход с карты отменяет запущенную интерполяцию', async () => {
  let tree;
  await act(async () => { tree = create(<Host spots={a} active />); });
  await act(async () => tree.update(<Host spots={b} active />));
  expect(nextFrame).toEqual(expect.any(Function));
  await act(async () => tree.update(<Host spots={b} active={false} />));
  expect(cancelAnimationFrame).toHaveBeenCalledWith(1);
  expect(latest).toEqual(b);
  await act(async () => tree.unmount());
});
