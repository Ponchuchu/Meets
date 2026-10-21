import type { Session } from '@supabase/supabase-js';
import { useAuth } from '../live/auth';
import { useNet } from '../live/net';
import { setOutboxSender, useOutbox } from '../live/outbox';

const item = (id: string, ownerId = 'a') => ({ id, ownerId, kind: 'message' as const, chatId: 'chat', payload: { body: id } });
const settle = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };

describe('очередь отправки сообщений', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    useNet.getState().setOnline(false);
    useOutbox.setState({ items: [] });
    useAuth.setState({ session: { user: { id: 'a' } } as Session });
  });
  afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); });
  it('сохраняет сообщение без сети и отправляет при восстановлении', async () => {
    const send = jest.fn().mockResolvedValue(undefined);
    setOutboxSender(send);
    useOutbox.getState().add(item('m1'));
    expect(send).not.toHaveBeenCalled();
    expect(useOutbox.getState().items).toHaveLength(1);
    useNet.getState().setOnline(true);
    await settle();
    expect(send).toHaveBeenCalledTimes(1);
    expect(useOutbox.getState().items).toHaveLength(0);
  });
  it('при сбое не удаляет сообщение, повторяет с тем же ключом и сохраняет порядок', async () => {
    const send = jest.fn().mockRejectedValueOnce(new Error('connection reset')).mockResolvedValue(undefined);
    setOutboxSender(send);
    useOutbox.getState().add(item('m1')); useOutbox.getState().add(item('m2'));
    useNet.getState().setOnline(true);
    await settle();
    expect(useOutbox.getState().items.map(x => x.id)).toEqual(['m1', 'm2']);
    expect(useOutbox.getState().items[0].tries).toBe(1);
    jest.advanceTimersByTime(2000);
    await settle();
    expect(send.mock.calls.map(([x]) => x.id)).toEqual(['m1', 'm1', 'm2']);
    expect(useOutbox.getState().items).toHaveLength(0);
  });
  it('не отправляет очередь другого пользователя', async () => {
    const send = jest.fn().mockResolvedValue(undefined);
    setOutboxSender(send);
    useOutbox.getState().add(item('other', 'b')); useOutbox.getState().add(item('mine'));
    useNet.getState().setOnline(true);
    await settle();
    expect(send.mock.calls.map(([x]) => x.id)).toEqual(['mine']);
    expect(useOutbox.getState().items.map(x => x.id)).toEqual(['other']);
  });
  it('читает владельца старой очереди из payload.owner', async () => {
    const send = jest.fn().mockResolvedValue(undefined);
    setOutboxSender(send);
    useOutbox.getState().add({ ...item('old'), ownerId: undefined, payload: { owner: 'a', body: 'старое сообщение' } });
    useNet.getState().setOnline(true);
    await settle();
    expect(send).toHaveBeenCalledTimes(1);
    expect(useOutbox.getState().items).toHaveLength(0);
  });
  it('подхватывает сообщение, добавленное во время отправки', async () => {
    let finish!: () => void;
    const send = jest.fn().mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; })).mockResolvedValue(undefined);
    setOutboxSender(send);
    useOutbox.getState().add(item('m1'));
    useNet.getState().setOnline(true);
    useOutbox.getState().add(item('m2'));
    finish();
    await settle();
    expect(send.mock.calls.map(([x]) => x.id)).toEqual(['m1', 'm2']);
    expect(useOutbox.getState().items).toHaveLength(0);
  });
});
