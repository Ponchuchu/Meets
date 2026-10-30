/* global jest, beforeEach, afterEach, test, expect */
import React from 'react';
import { act, create } from 'react-test-renderer';
import { AppState } from 'react-native';
import { useLiveChats } from '../data/realtime';
import { touchPresence } from '../data/remote';

let mockSession;
const mockListeners = new Set();
const mockClient = { channel: jest.fn(), removeChannel: jest.fn() };
const mockQuery = { invalidateQueries: jest.fn() };
jest.mock('@tanstack/react-query', () => ({ useQueryClient: () => mockQuery }));
jest.mock('../live/auth', () => ({ useAuth: select => select({ session: mockSession }) }));
jest.mock('../lib/config', () => ({ config: { dataMode: 'live' } }));
jest.mock('../state/perf', () => ({ isEco: () => false }));
jest.mock('../data/client', () => ({ supabase: () => mockClient, uniqTopic: topic => topic }));
jest.mock('../data/remote', () => ({ touchPresence: jest.fn(async () => undefined) }));
jest.mock('react-native', () => ({
  Platform: jest.requireActual('react-native').Platform,
  AppState: {
    currentState: 'active',
    addEventListener: (_event, listener) => {
      mockListeners.add(listener);
      return { remove: () => mockListeners.delete(listener) };
    },
  },
}));

global.IS_REACT_ACT_ENVIRONMENT = true;
function Host() { useLiveChats(); return null; }
function state(value) {
  AppState.currentState = value;
  for (const listener of [...mockListeners]) listener(value);
}
beforeEach(() => {
  jest.useFakeTimers(); jest.clearAllMocks(); mockListeners.clear();
  mockSession = { user: { id: 'qa' } }; AppState.currentState = 'active';
  mockClient.channel.mockImplementation(() => {
    const channel = { on: () => channel, subscribe: () => channel };
    return channel;
  });
});
afterEach(() => jest.useRealTimers());

test('authenticated services work without tabs, pause in background, resume and clean up', async () => {
  let tree;
  await act(async () => { tree = create(<Host />); });
  expect(touchPresence).toHaveBeenCalledTimes(1);
  await act(async () => { state('background'); jest.advanceTimersByTime(60000); });
  expect(touchPresence).toHaveBeenCalledTimes(1);
  await act(async () => state('active'));
  expect(touchPresence).toHaveBeenCalledTimes(2);
  await act(async () => tree.unmount());
  await act(async () => jest.advanceTimersByTime(120000));
  expect(touchPresence).toHaveBeenCalledTimes(2);
  expect(mockListeners.size).toBe(0);
});

test('logged-out screens never publish presence or open private subscriptions', async () => {
  mockSession = null; let tree;
  await act(async () => { tree = create(<Host />); jest.advanceTimersByTime(120000); });
  expect(touchPresence).not.toHaveBeenCalled();
  expect(mockClient.channel).not.toHaveBeenCalled();
  await act(async () => tree.unmount());
});
