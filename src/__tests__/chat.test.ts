import { canWrite, eventChatOpen, isBlurred, startsIn, vote } from '../chat/rules';

const NOW = new Date('2026-09-28T18:02:00+05:00');
const base = {
  friend: false, recipientAllows: 'common' as const, commonEvent: true, existing: false,
  myAccountCreatedAt: '2026-09-01T00:00:00Z', newChatsToday: 0, blocked: false, now: NOW,
};

describe('кто может писать', () => {
  it('другу — всегда', () => expect(canWrite({ ...base, friend: true, commonEvent: false }).ok).toBe(true));
  it('незнакомому — только при общем событии', () => {
    expect(canWrite(base).ok).toBe(true);
    expect(canWrite({ ...base, commonEvent: false })).toEqual({ ok: false, reason: 'no-common-event' });
  });
  it('если человек разрешил только друзьям — нельзя', () => {
    expect(canWrite({ ...base, recipientAllows: 'friends' })).toEqual({ ok: false, reason: 'not-allowed' });
  });
  it('новые аккаунты первые 24 часа не пишут первыми', () => {
    expect(canWrite({ ...base, myAccountCreatedAt: '2026-09-28T10:00:00+05:00' }).reason).toBe('new-account');
    expect(canWrite({ ...base, myAccountCreatedAt: '2026-09-28T10:00:00+05:00', existing: true }).ok).toBe(true);
  });
  it('не больше 10 новых разговоров в день', () => {
    expect(canWrite({ ...base, newChatsToday: 10 }).reason).toBe('daily-limit');
    expect(canWrite({ ...base, newChatsToday: 9 }).ok).toBe(true);
  });
  it('блок и закрытие через 48 часов после события', () => {
    expect(canWrite({ ...base, blocked: true }).reason).toBe('blocked');
    expect(canWrite({ ...base, existing: true, eventEndsAt: '2026-09-26T10:00:00+05:00' }).reason).toBe('closed');
    expect(canWrite({ ...base, existing: true, eventEndsAt: '2026-09-27T10:00:00+05:00' }).ok).toBe(true);
  });
});

describe('чат события и медиа', () => {
  it('размытие медиа от незнакомых', () => {
    expect(isBlurred(false, false)).toBe(true);
    expect(isBlurred(false, true)).toBe(false);
    expect(isBlurred(true, false)).toBe(false);
  });
  it('чат живёт 48 часов после события', () => {
    expect(eventChatOpen('2026-09-26T19:30:00+05:00', '2026-09-26T22:00:00+05:00', NOW)).toBe(true);
    expect(eventChatOpen('2026-09-25T19:30:00+05:00', '2026-09-25T22:00:00+05:00', NOW)).toBe(false);
  });
  it('«начало через 1 ч 28 мин»', () => {
    expect(startsIn('2026-09-28T19:30:00+05:00', null, NOW)).toBe('начало через 1 ч 28 мин');
    expect(startsIn('2026-09-28T18:30:00+05:00', null, NOW)).toBe('начало через 28 мин');
    expect(startsIn('2026-09-28T17:30:00+05:00', null, NOW)).toBe('идёт сейчас');
  });
  it('опрос: голос можно поменять', () => {
    const opts = [{ text: 'Гулять', votes: 5 }, { text: 'Кофе', votes: 3 }, { text: 'Домой', votes: 1 }];
    const a = vote(opts, null, 1);
    expect(a.options.map((o) => o.votes)).toEqual([5, 4, 1]);
    const b = vote(a.options, 1, 0);
    expect(b.options.map((o) => o.votes)).toEqual([6, 3, 1]);
    expect(b.total).toBe(10);
  });
});

describe('список чатов', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { sortChats } = require('../chat/rules') as typeof import('../chat/rules');
  it('закреп сверху, дальше от новых к старым', () => {
    const list = [{ id: 'a', time: '11:08' }, { id: 'b', time: 'вчера' }, { id: 'c', time: '18:10' }, { id: 'd', time: '17:40' }];
    expect(sortChats(list, {}).map((x) => x.id)).toEqual(['c', 'd', 'a', 'b']);
    expect(sortChats(list, { b: true }).map((x) => x.id)).toEqual(['b', 'c', 'd', 'a']);
  });
});
