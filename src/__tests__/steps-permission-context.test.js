/* global jest, test, expect, beforeEach, afterEach */
import React from 'react';
import { act, create } from 'react-test-renderer';
import { useStepTracking, askSteps } from '../live/steps';
import { Pedometer } from 'expo-sensors';
import * as health from 'react-native-health-connect';

jest.mock('expo-sensors', () => ({ Pedometer: {
  isAvailableAsync: jest.fn(async () => true),
  getPermissionsAsync: jest.fn(async () => ({ granted: false, canAskAgain: true })),
  requestPermissionsAsync: jest.fn(async () => ({ granted: false })),
} }));
jest.mock('react-native-health-connect', () => ({
  SdkAvailabilityStatus: { SDK_AVAILABLE: 3 },
  getSdkStatus: jest.fn(async () => 3),
  initialize: jest.fn(async () => true),
  getGrantedPermissions: jest.fn(async () => []),
  requestPermission: jest.fn(async () => []),
  aggregateRecord: jest.fn(async () => { throw new Error('not granted'); }),
}));
jest.mock('react-native', () => ({
  Platform: { OS: 'android', select: value => value.android ?? value.default },
  AppState: { currentState: 'active', addEventListener: () => ({ remove() {} }) },
}));
jest.mock('../live/auth', () => ({ useAuth: select => select({ session: { user: { id: 'qa' } } }) }));
jest.mock('../live/query', () => ({ queryClient: { invalidateQueries: jest.fn() } }));
jest.mock('../data/client', () => ({ supabase: jest.fn() }));
jest.mock('../lib/config', () => ({ config: { dataMode: 'live' } }));
jest.mock('../state/perf', () => ({ isEco: () => false }));

global.IS_REACT_ACT_ENVIRONMENT = true;
function Host() { useStepTracking(); return null; }
beforeEach(() => { jest.clearAllMocks(); jest.useFakeTimers(); });
afterEach(() => jest.useRealTimers());

test('entering the app checks health access without opening a permission screen', async () => {
  let tree;
  await act(async () => { tree = create(<Host />); });
  expect(health.getGrantedPermissions).toHaveBeenCalled();
  expect(health.requestPermission).not.toHaveBeenCalled();
  expect(Pedometer.requestPermissionsAsync).not.toHaveBeenCalled();
  await act(async () => { tree.unmount(); });
});

test('sensor fallback also waits for the profile permission button', async () => {
  health.getSdkStatus.mockResolvedValueOnce(1);
  let tree;
  await act(async () => { tree = create(<Host />); });
  expect(Pedometer.getPermissionsAsync).toHaveBeenCalled();
  expect(Pedometer.requestPermissionsAsync).not.toHaveBeenCalled();
  await act(async () => { tree.unmount(); });
});

test('the explicit profile action can request health permission', async () => {
  await act(async () => { await askSteps(); });
  expect(health.requestPermission).toHaveBeenCalledTimes(1);
});
