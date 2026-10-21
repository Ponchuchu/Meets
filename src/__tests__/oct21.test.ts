// 21 октября: галочки сообщений, ошибки сети против отказов сервера, экономия заряда, туман «Где я был».
import { tickOf } from '../chat/ticks';
import { isNetworkError } from '../live/outbox';
import { ecoOf } from '../state/perf';
import { fogShape } from '../live/geo';

describe('галочки', () => {
  it('ждёт сети — часики, отказ — ошибка', () => {
    expect(tickOf({ delivery: 'sending' })).toBe('wait');
    expect(tickOf({ delivery: 'failed' })).toBe('failed');
  });
  it('прочитано, если собеседник прочитал до этого времени (разные форматы времени)', () => {
    expect(tickOf({ createdAt: '2026-10-21T05:10:02.980Z' }, '2026-10-21 05:10:02.98+00')).toBe('read');
    expect(tickOf({ createdAt: '2026-10-21T05:10:03Z' }, '2026-10-21T05:10:02+00:00')).toBe('sent');
    expect(tickOf({ createdAt: '2026-10-21T05:10:03Z' })).toBe('sent');
  });
});

describe('очередь отправки', () => {
  it('таймаут и обрыв — ошибка сети, сообщение ждёт', () => {
    expect(isNetworkError(new Error('timeout'))).toBe(true);
    expect(isNetworkError(new TypeError('Network request failed'))).toBe(true);
    expect(isNetworkError({ message: 'x', status: 503 })).toBe(true);
  });
  it('отказ базы — «Не отправилось»', () => {
    expect(isNetworkError({ code: '42501', message: 'rls' })).toBe(false);
    expect(isNetworkError({ message: 'bad', status: 400 })).toBe(false);
  });
});

describe('экономия заряда', () => {
  it('авто включается при энергосбережении или слабом телефоне', () => {
    expect(ecoOf({ mode: 'auto', powerSave: true }, false)).toBe(true);
    expect(ecoOf({ mode: 'auto', powerSave: false }, true)).toBe(true);
    expect(ecoOf({ mode: 'auto', powerSave: false }, false)).toBe(false);
    expect(ecoOf({ mode: 'off', powerSave: true }, true)).toBe(false);
    expect(ecoOf({ mode: 'on', powerSave: false }, false)).toBe(true);
  });
});

describe('туман', () => {
  it('край — только вокруг открытых мест, без внешней рамки', () => {
    const f = fogShape(['8660:15400', '8660:15401']);
    expect(f.features[0].geometry.type).toBe('Polygon');
    const edge = f.features[1] as { properties: { edge: boolean }; geometry: { type: string; coordinates: number[][][] } };
    expect(edge.properties.edge).toBe(true);
    expect(edge.geometry.type).toBe('MultiLineString');
    expect(edge.geometry.coordinates.length).toBe(1);
    expect(fogShape([]).features.length).toBe(1);
  });
});
