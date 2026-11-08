/* global jest, beforeEach, describe, it, expect */
import React from 'react';
import { act, create } from 'react-test-renderer';
import { router } from 'expo-router';
import { openDirectChat } from '../data/remote';
import { StateView } from '../ui/StateView';
import { DirectChatOpening } from '../chat/ui/DirectChatOpening';

const mockClient = { invalidateQueries: jest.fn() };
jest.mock('lucide-react-native', () => ({ ChevronLeft: 'ChevronLeft' }));
jest.mock('@tanstack/react-query', () => ({ useQueryClient: () => mockClient }));
jest.mock('expo-router', () => ({ router: { replace: jest.fn(), back: jest.fn(), canGoBack: () => true } }));
jest.mock('../data/remote', () => ({ openDirectChat: jest.fn() }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 20 }) }));
jest.mock('../ui/StateView', () => ({ StateView: props => require('react').createElement('StateView', props) }));

global.IS_REACT_ACT_ENVIRONMENT = true;
const peer = '00000000-0000-4000-8000-000000000002';
const cid = 'd08c7c23-eb4b-4042-a3c6-2bdd917bf9ba';
beforeEach(() => jest.clearAllMocks());

describe('открытие серверного личного чата', () => {
  it('ждёт UUID сервера, затем открывает именно его', async () => {
    let finish;
    openDirectChat.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    let tree;
    await act(async () => { tree = create(<DirectChatOpening personId={peer} />); });
    expect(openDirectChat).toHaveBeenCalledWith(peer);
    expect(tree.root.findByType(StateView).props.kind).toBe('loading');
    expect(router.replace).not.toHaveBeenCalled();
    await act(async () => { finish(cid); });
    expect(router.replace).toHaveBeenCalledWith({ pathname: '/chat/[id]', params: { id: cid } });
    expect(mockClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['chats'] });
    await act(async () => tree.unmount());
  });

  it('показывает отказ и позволяет повторить, не изображая отправленный чат', async () => {
    openDirectChat.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce(cid);
    let tree;
    await act(async () => { tree = create(<DirectChatOpening personId={peer} />); });
    const error = tree.root.findByType(StateView);
    expect(error.props.kind).toBe('error');
    expect(router.replace).not.toHaveBeenCalled();
    await act(async () => error.props.onAction());
    expect(openDirectChat).toHaveBeenCalledTimes(2);
    expect(router.replace).toHaveBeenCalledTimes(1);
    await act(async () => tree.unmount());
  });

  it('поздний ответ не уводит пользователя обратно после ухода', async () => {
    let finish;
    openDirectChat.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    let tree;
    await act(async () => { tree = create(<DirectChatOpening personId={peer} />); });
    await act(async () => tree.unmount());
    await act(async () => { finish(cid); });
    expect(router.replace).not.toHaveBeenCalled();
    expect(mockClient.invalidateQueries).not.toHaveBeenCalled();
  });
});
