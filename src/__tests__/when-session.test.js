/* global jest, beforeEach, describe, it, expect */
import React from 'react';
import { Pressable, Text } from 'react-native';
import { act, create } from 'react-test-renderer';
import { chooseEventVisit } from '../live/api';
import { WhenSheet } from '../feed/WhenSheet';

const mockClient = { invalidateQueries: jest.fn() };
jest.mock('lucide-react-native', () => ({ X: 'X', CalendarDays: 'CalendarDays', Clock: 'Clock', Check: 'Check' }));
const mockAddPlan = jest.fn();
jest.mock('react-native', () => ({
  Platform: jest.requireActual('react-native').Platform,
  Pressable: 'Pressable', Text: 'Text', View: 'View', ActivityIndicator: 'ActivityIndicator',
  StyleSheet: { create: styles => styles },
}));
const mockGo = jest.fn();
let mockPlans;
jest.mock('@tanstack/react-query', () => ({ useQueryClient: () => mockClient }));
jest.mock('../lib/config', () => ({ config: { dataMode: 'live' } }));
jest.mock('../live/api', () => ({ chooseEventVisit: jest.fn() }));
jest.mock('../state/app', () => ({ useApp: select => select({ addPlan: mockAddPlan }) }));
jest.mock('../state/plans', () => ({ usePlans: {
  getState: () => ({ go: mockGo }),
  setState: update => { mockPlans = { ...mockPlans, ...update(mockPlans) }; },
} }));
jest.mock('../event/ScheduleSheet', () => ({ ScheduleSheet: props => require('react').createElement('ScheduleSheet', props) }));
jest.mock('../event/ui/pickers', () => ({
  DayTimeWheel: props => require('react').createElement('DayTimeWheel', props),
  dayTitle: () => 'завтра', wheelDayLabel: () => 'завтра',
}));
jest.mock('../ui/EventCover', () => ({ EventCover: props => require('react').createElement('EventCover', props) }));
jest.mock('../ui/sheet', () => ({
  Backdrop: props => require('react').createElement('Backdrop', props),
  BottomSheet: props => require('react').createElement('BottomSheet', props, props.children),
}));

global.IS_REACT_ACT_ENVIRONMENT = true;
const now = new Date('2026-10-27T12:00:00+05:00');
const dates = ['2026-10-28T19:30:00+05:00', '2026-10-29T19:30:00+05:00'];
const event = { id: 'event-qa', title: 'Две даты', category: 'theatre', dates, startsAt: dates[0], isLong: false };
const saveButton = tree => tree.root.findAllByType(Pressable).find(p => !p.props.accessibilityLabel && p.props.accessibilityRole === 'button');
beforeEach(() => { jest.clearAllMocks(); mockPlans = { going: {}, visits: {} }; });

describe('подтверждение выбранной даты', () => {
  it('ожидает сервер, блокирует двойной тап и добавляет план ровно один раз', async () => {
    let finish;
    chooseEventVisit.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    const planned = jest.fn(); let tree;
    await act(async () => { tree = create(<WhenSheet e={event} events={[]} now={now} onClose={jest.fn()} onPlanned={planned} />); });
    const press = saveButton(tree).props.onPress;
    await act(async () => { press(); press(); });
    expect(chooseEventVisit).toHaveBeenCalledTimes(1);
    expect(mockPlans.going).toEqual({});
    expect(planned).not.toHaveBeenCalled();
    expect(saveButton(tree).props.disabled).toBe(true);
    await act(async () => { finish(); });
    expect(mockPlans.going[event.id]).toBe(dates[0]);
    expect(mockPlans.visits[event.id]).toBe(dates[0]);
    expect(mockAddPlan).toHaveBeenCalledTimes(1);
    expect(planned).toHaveBeenCalledTimes(1);
    await act(async () => tree.unmount());
  });

  it('при отказе сохраняет шторку и не создаёт ложный план; повтор работает', async () => {
    chooseEventVisit.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce(undefined);
    const planned = jest.fn(); let tree;
    await act(async () => { tree = create(<WhenSheet e={event} events={[]} now={now} onClose={jest.fn()} onPlanned={planned} />); });
    await act(async () => saveButton(tree).props.onPress());
    expect(mockPlans.going).toEqual({});
    expect(mockAddPlan).not.toHaveBeenCalled();
    expect(planned).not.toHaveBeenCalled();
    expect(tree.root.findAllByType(Text).some(n => n.props.accessibilityRole === 'alert')).toBe(true);
    expect(saveButton(tree).props.disabled).toBe(false);
    await act(async () => saveButton(tree).props.onPress());
    expect(chooseEventVisit).toHaveBeenCalledTimes(2);
    expect(planned).toHaveBeenCalledTimes(1);
    await act(async () => tree.unmount());
  });
});
