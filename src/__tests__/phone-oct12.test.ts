import type { EventItem, Message } from '../data/types';
import { mergeChatMessages } from '../chat/messages';
import { registerPlayback, registerPreparation, usePlayback } from '../chat/playback';
import { occurrencesOf } from '../event/occurrences';
import { eventReminder } from '../event/reminder';
import { readPoint } from '../live/point';
import { project, unproject } from '../map/projection';

const event = (patch: Partial<EventItem> = {}): EventItem => ({ id: 'a', title: 'Фильм', category: 'movie', startsAt: '2026-10-12T20:00:00+05:00', endsAt: '2026-10-12T22:00:00+05:00', isLong: false, visibility: 'public', venueName: 'Кинотеатр', venueId: 'venue', status: 'published', ...patch } as EventItem);
const message = (id: string, patch: Partial<Message> = {}): Message => ({ id, chatId: 'c', authorId: 'me', kind: 'text', text: id, time: '12:00', ...patch });

describe('отправка и просмотр без дублей', () => {
  it('ответ сервера заменяет отправляемую копию того же сообщения', () => {
    const confirmed = message('same', { createdAt: '2026-10-12T10:00:00Z' });
    expect(mergeChatMessages([confirmed], [message('same', { delivery: 'sending' })])).toEqual([confirmed]);
  });
  it('при ошибке сообщение и файл остаются для повторной отправки', () => {
    const failed = message('retry', { delivery: 'failed', media: 'file:///voice.m4a', uploadedPath: 'c/voice.m4a' });
    expect(mergeChatMessages([], [failed])[0]).toEqual(failed);
  });
  it('сообщения приходят в порядке времени, независимо от порядка ответов сети', () => {
    expect(mergeChatMessages([message('new', { createdAt: '2026-10-12T10:02:00Z' }), message('old', { createdAt: '2026-10-12T10:01:00Z' })], []).map(m => m.id)).toEqual(['old', 'new']);
  });
  it('запись выключает просмотр и сохраняет только один активный проигрыватель', () => {
    usePlayback.getState().play('first'); usePlayback.getState().play('second');
    expect(usePlayback.getState().active).toBe('second');
    usePlayback.getState().record(true);
    expect(usePlayback.getState().active).toBeNull();
    usePlayback.getState().record(false);
  });
});

it('перед записью и уходом с экрана сразу останавливается нативное видео', () => {
  usePlayback.getState().record(false);
  const pause = jest.fn(), release = jest.fn();
  const unregister = registerPlayback('native', pause);
  const unprepare = registerPreparation(release);
  usePlayback.getState().play('native');
  usePlayback.getState().record(true);
  expect(pause).toHaveBeenCalledTimes(1); expect(release).toHaveBeenCalledTimes(1);
  usePlayback.getState().play('blocked'); expect(usePlayback.getState().active).toBeNull();
  usePlayback.getState().record(false); usePlayback.getState().play('native');
  usePlayback.getState().focus(false); expect(pause).toHaveBeenCalledTimes(2);
  unregister(); unprepare();
});

describe('время показа и напоминание о билетах', () => {
  it('разные сеансы одного фильма остаются отдельными, прошедшие исключаются', () => {
    const first = event(); const second = event({ id: 'b', startsAt: '2026-10-12T21:00:00+05:00', venueId: 'another', venueName: 'Другой кинотеатр' });
    const past = event({ id: 'old', startsAt: '2026-10-11T20:00:00+05:00' });
    expect(occurrencesOf(first, [first, second, past], new Date('2026-10-12T12:00:00+05:00')).map(e => e.id)).toEqual(['a', 'b']);
  });
  it('варианты обычного события ограничены той же площадкой', () => {
    const e = event({ category: 'standup' });
    expect(occurrencesOf(e, [event({ id: 'other', category: 'standup', venueId: 'different' })], new Date('2026-10-12T12:00:00+05:00'))).toEqual([e]);
  });
  it('для кино напоминание за три часа, для других событий за час', () => {
    const now = Date.parse('2026-10-12T10:00:00+05:00');
    expect(eventReminder(event(), now)).toMatchObject({ at: Date.parse('2026-10-12T17:00:00+05:00'), lead: 10800000, ticket: true });
    expect(eventReminder(event({ category: 'standup' }), now)).toMatchObject({ at: Date.parse('2026-10-12T19:00:00+05:00'), ticket: false });
  });
  it('снятый сеанс или уже прошедшее время напоминания не создают пуш', () => {
    expect(eventReminder(event({ status: 'archived' }), 0)).toBeNull();
    expect(eventReminder(event(), Date.parse('2026-10-12T18:00:00+05:00'))).toBeNull();
  });
});

describe('ручная точка на карте', () => {
  it('понимает настоящий EWKB PostGIS, GeoJSON и EWKT', () => {
    const data = new Uint8Array(25); const view = new DataView(data.buffer);
    view.setUint8(0, 1); view.setUint32(1, 0x20000001, true); view.setUint32(5, 4326, true); view.setFloat64(9, 76.945, true); view.setFloat64(17, 43.25, true);
    const hex = [...data].map(n => n.toString(16).padStart(2, '0')).join('');
    for (const input of [hex, { coordinates: [76.945, 43.25] }, 'SRID=4326;POINT(76.945 43.25)']) expect(readPoint(input)).toEqual({ lat: 43.25, lon: 76.945 });
  });
  it('не передаёт в карту повреждённые и бесконечные координаты', () => {
    for (const input of [null, '', '0101', { coordinates: [Infinity, 43] }, { coordinates: [76, 900] }]) expect(readPoint(input)).toBeNull();
  });
  it('тап на подложке выбирает ту же координату, которая нарисована на экране', () => {
    const camera = { lat: 43.25, lon: 76.95, zoom: 15 };
    const screen = project(43.251, 76.952, camera, 390, 250);
    const point = unproject(screen.x, screen.y, camera, 390, 250);
    expect(point.lat).toBeCloseTo(43.251, 7); expect(point.lon).toBeCloseTo(76.952, 7);
  });
});
