import { deviceOf, groupActivity, shortAgo, toItem, unseenCount, type ActivityRow } from '../activity/model';

const row = (kind: string, at: string, extra: Partial<ActivityRow> = {}): ActivityRow => ({ kind, at, person_id: 'p1', person_name: 'Ердос', person_photo: null, event_id: 'e1', event_title: 'Джаз', detail: null, ...extra });

describe('лента уведомлений (FIX5)', () => {
  it('тексты и действия', () => {
    expect(toItem(row('friend_request', '2026-10-25T10:00:00Z'))).toMatchObject({ who: 'Ердос', text: 'хочет добавить тебя в друзья', action: 'friend', href: '/person/p1' });
    expect(toItem(row('invite', '2026-10-25T10:00:00Z')).action).toBe('invite');
    expect(toItem(row('invite', '2026-10-25T10:00:00Z', { detail: 'yes' })).action).toBeNull();
    expect(toItem(row('invite_answer', '2026-10-25T10:00:00Z', { detail: 'no' })).text).toBe('не сможет прийти на «Джаз»');
    expect(toItem(row('push_reminder', '2026-10-25T10:00:00Z')).who).toBeNull();
    expect(toItem(row('login', '2026-10-25T10:00:00Z', { detail: 'okhttp/4.12.0' })).text).toBe('Вход в аккаунт · Android');
  });
  it('устройство по подписи', () => {
    expect(deviceOf('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)')).toBe('iPhone');
    expect(deviceOf('Mozilla/5.0 (Windows NT 10.0) Chrome/120')).toBe('браузер');
    expect(deviceOf(null)).toBe('неизвестное устройство');
  });
  it('группы и счётчик нового', () => {
    const now = Date.parse('2026-10-25T12:00:00Z');
    const items = ['2026-10-25T11:00:00Z', '2026-10-25T08:00:00Z', '2026-10-24T08:00:00Z', '2026-10-21T08:00:00Z', '2026-10-01T08:00:00Z'].map((at) => toItem(row('friend_added', at)));
    const g = groupActivity(items, Date.parse('2026-10-25T10:00:00Z'), now);
    expect(g.map((x) => [x.title, x.items.length])).toEqual([['Новые', 1], ['Сегодня', 1], ['Вчера', 1], ['На этой неделе', 1], ['Раньше', 1]]);
    expect(unseenCount(items, Date.parse('2026-10-25T07:00:00Z'))).toBe(2);
  });
  it('короткое «когда»', () => {
    const now = Date.parse('2026-10-25T12:00:00Z');
    expect(shortAgo('2026-10-25T11:58:00Z', now)).toBe('2 мин');
    expect(shortAgo('2026-10-25T09:00:00Z', now)).toBe('3 ч');
    expect(shortAgo('2026-10-24T10:00:00Z', now)).toBe('вчера');
    expect(shortAgo('2026-10-11T10:00:00Z', now)).toBe('2 нед');
  });
});
