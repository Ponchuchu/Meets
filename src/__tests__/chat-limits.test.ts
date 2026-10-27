import { maySend, SEND_MAX } from '../chat/rules';

describe('лимит отправки в чате', () => {
  it('10 тысяч сообщений подряд: проходит только SEND_MAX за окно', () => {
    let log: number[] = [];
    let ok = 0;
    for (let i = 0; i < 10000; i++) { const r = maySend(log, 1000 + i % 3, false); log = r.log; if (r.ok) ok++; }
    expect(ok).toBe(SEND_MAX);
    expect(log.length).toBeLessThanOrEqual(SEND_MAX);
  });
  it('стикеры — не больше двух в секунду, потом снова можно', () => {
    let log: number[] = [];
    const a = maySend(log, 0, true); log = a.log;
    const b = maySend(log, 100, true); log = b.log;
    const c = maySend(log, 200, true);
    expect([a.ok, b.ok, c.ok]).toEqual([true, true, false]);
    expect(maySend(c.log, 1500, true).ok).toBe(true);
  });
  it('после паузы лимит сбрасывается', () => {
    let log: number[] = [];
    for (let i = 0; i < SEND_MAX; i++) log = maySend(log, i, false).log;
    expect(maySend(log, 100, false).ok).toBe(false);
    expect(maySend(log, 6000, false).ok).toBe(true);
  });
});
