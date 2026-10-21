// «В сети» / «был …» в шапке чата и профиле друга (21 октября, вечер).
jest.mock('../data/client', () => ({ supabase: () => ({}), requireUser: async () => 'me', withTimeout: (p: unknown) => p }));
import { seenText } from '../data/remote';

const at = (iso: string) => Date.parse(iso);

describe('seenText', () => {
  const now = at('2026-10-21T12:00:00Z'); // 17:00 по Алматы
  it('в сети — заходил меньше 2 минут назад', () => {
    expect(seenText('2026-10-21T11:59:10Z', now)).toEqual({ online: true, text: 'в сети' });
  });
  it('минуты, сегодня, вчера и дата', () => {
    expect(seenText('2026-10-21T11:45:00Z', now).text).toBe('был 15 мин назад');
    expect(seenText('2026-10-21T04:20:00Z', now).text).toBe('был в 09:20');
    expect(seenText('2026-10-20T15:00:00Z', now).text).toBe('был вчера в 20:00');
    expect(seenText('2026-10-03T10:00:00Z', now).text).toBe('был 3 окт.');
  });
  it('мусор вместо даты не ломает экран', () => {
    expect(seenText('nope', now)).toEqual({ online: false, text: 'был недавно' });
  });
});
