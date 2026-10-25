import { decide, isQuiet, nextScheduled, quietEnd, reminderAt, type SentPush } from '../notify/rules';

import { pushPath } from '../live/reminders';

const at = (s: string) => new Date(`${s}+05:00`);

describe('тихие часы', () => {
  it('23:00–09:00 по Алматы', () => {
    expect(isQuiet(at('2026-09-28T23:10:00'))).toBe(true);
    expect(isQuiet(at('2026-09-29T08:59:00'))).toBe(true);
    expect(isQuiet(at('2026-09-29T09:00:00'))).toBe(false);
    expect(isQuiet(at('2026-09-28T22:59:00'))).toBe(false);
  });
  it('конец тихих часов — ближайшие 09:00', () => {
    expect(quietEnd(at('2026-09-28T23:30:00'))).toEqual(at('2026-09-29T09:00:00'));
    expect(quietEnd(at('2026-09-29T03:00:00'))).toEqual(at('2026-09-29T09:00:00'));
  });
  it('сообщение ночью приходит без звука', () => {
    expect(decide({ kind: 'message', at: at('2026-09-28T23:30:00') }, [])).toEqual({ send: true, silent: true });
  });
  it('подборка ночью переносится на утро', () => {
    expect(decide({ kind: 'dailyFeed', at: at('2026-09-29T02:00:00') }, [])).toEqual({ send: false, reason: 'quiet', retryAt: at('2026-09-29T09:00:00') });
  });
  it('«друг рядом» ночью не отправляется и не переносится', () => {
    expect(decide({ kind: 'friendNear', at: at('2026-09-29T02:00:00'), about: 'a' }, [])).toEqual({ send: false, reason: 'quiet' });
  });
});

describe('частота', () => {
  const noon = at('2026-09-28T12:00:00');
  it('не больше 4 пушей в день, сообщения не считаются', () => {
    const sent: SentPush[] = [
      { kind: 'friendNear', at: at('2026-09-28T10:00:00'), about: 'a' },
      { kind: 'dailyFeed', at: at('2026-09-28T10:00:00') },
      { kind: 'invite', at: at('2026-09-28T11:00:00') },
      { kind: 'message', at: at('2026-09-28T11:10:00') },
      { kind: 'message', at: at('2026-09-28T11:20:00') },
    ];
    expect(decide({ kind: 'friendNear', at: noon, about: 'b' }, sent).send).toBe(true);
    const full = [...sent, { kind: 'reminder' as const, at: at('2026-09-28T11:30:00'), about: 'e1' }];
    expect(decide({ kind: 'friendNear', at: noon, about: 'b' }, full)).toEqual({ send: false, reason: 'dailyLimit' });
    expect(decide({ kind: 'message', at: noon }, full).send).toBe(true);
  });
  it('лимит сбрасывается на следующий день', () => {
    const sent: SentPush[] = Array.from({ length: 4 }, (_, i) => ({ kind: 'invite', at: at(`2026-09-27T1${i}:00:00`) }));
    expect(decide({ kind: 'invite', at: noon }, sent).send).toBe(true);
  });
  it('друг рядом — не чаще раза в 3 часа на друга', () => {
    const sent: SentPush[] = [{ kind: 'friendNear', at: at('2026-09-28T10:00:00'), about: 'a' }];
    expect(decide({ kind: 'friendNear', at: noon, about: 'a' }, sent)).toEqual({ send: false, reason: 'friendCooldown' });
    expect(decide({ kind: 'friendNear', at: noon, about: 'b' }, sent).send).toBe(true);
    expect(decide({ kind: 'friendNear', at: at('2026-09-28T13:00:00'), about: 'a' }, sent).send).toBe(true);
  });
  it('стикеры без лимита: серия от одного друга — один пуш за 30 секунд', () => {
    const sent: SentPush[] = [{ kind: 'sticker', at: at('2026-09-28T11:59:50'), about: 'a' }];
    expect(decide({ kind: 'sticker', at: noon, about: 'a' }, sent)).toEqual({ send: false, reason: 'stickerCooldown', retryAt: at('2026-09-28T12:00:20') });
    expect(decide({ kind: 'sticker', at: at('2026-09-28T12:00:30'), about: 'a' }, sent).send).toBe(true);
    expect(decide({ kind: 'sticker', at: noon, about: 'b' }, sent).send).toBe(true);
    const full: SentPush[] = Array.from({ length: 4 }, (_, i) => ({ kind: 'invite', at: at(`2026-09-28T1${i}:00:00`) }));
    expect(decide({ kind: 'sticker', at: noon, about: 'c' }, full).send).toBe(true);
  });
  it('настройки выключают вид пушей', () => {
    expect(decide({ kind: 'weekend', at: at('2026-10-01T18:00:00') }, [])).toEqual({ send: false, reason: 'prefs' });
  });
  it('отмена события и пуш команде — сразу и вне лимита', () => {
    const full: SentPush[] = Array.from({ length: 4 }, (_, i) => ({ kind: 'invite', at: at(`2026-09-28T1${i}:00:00`) }));
    expect(decide({ kind: 'cancelled', at: noon, about: 'e1' }, full)).toEqual({ send: true, silent: false });
    expect(decide({ kind: 'staff', at: at('2026-09-28T23:30:00') }, full)).toEqual({ send: true, silent: true });
  });
  it('подборка — один раз в день', () => {
    const sent: SentPush[] = [{ kind: 'dailyFeed', at: at('2026-09-28T10:00:00') }];
    expect(decide({ kind: 'dailyFeed', at: noon }, sent)).toEqual({ send: false, reason: 'duplicate' });
  });
});

describe('расписание', () => {
  it('напоминание за 2 часа', () => {
    const now = at('2026-09-28T12:00:00');
    expect(reminderAt(at('2026-09-28T19:00:00'), now)).toEqual(at('2026-09-28T17:00:00'));
    expect(reminderAt(at('2026-09-28T13:00:00'), now)).toEqual(now);
    expect(reminderAt(at('2026-09-28T11:00:00'), now)).toBeNull();
  });
  it('подборка в 10:00, выходные — в четверг 18:00', () => {
    expect(nextScheduled('dailyFeed', at('2026-09-28T09:00:00'))).toEqual(at('2026-09-28T10:00:00'));
    expect(nextScheduled('dailyFeed', at('2026-09-28T10:30:00'))).toEqual(at('2026-09-29T10:00:00'));
    // 28.09.2026 — понедельник, ближайший четверг — 01.10.
    expect(nextScheduled('weekend', at('2026-09-28T10:00:00'))).toEqual(at('2026-10-01T18:00:00'));
    expect(new Date(at('2026-10-01T18:00:00')).getUTCDay()).toBe(4);
  });
});
it('пуш «Модерация» со старым адресом /admin ведёт в панель, а не по кругу (FIX5)', () => {
  expect(pushPath('/admin')).toBe('/dev?tab=events');
  expect(pushPath('/chat/1')).toBe('/chat/1');
});
