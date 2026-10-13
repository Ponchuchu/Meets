import { mediaFormat } from '../chat/media';
import { useOutbox, setOutboxSender } from '../live/outbox';
import { useNet } from '../live/net';
import { fitCamera } from '../map/fit';
import { project } from '../map/projection';
import { closeGroups } from '../map/proximity';
import { groupEventDates } from '../event/series';
import { demoEvents } from '../data/demo';
import { buildDeck, tasteFrom } from '../reco';
import { withTimeout } from '../data/client';
import { STICKERS } from '../stickers/catalog';
import type { FriendSpot } from '../data/types';

const now = new Date('2026-10-12T09:00:00Z');
const base = demoEvents(now)[0];

describe('событие с несколькими датами', () => {
  const first = { ...base, id: 'fair-friday', title: 'Маркет', category: 'art' as const, venueName: 'Парк', sourceUrl: 'https://example.org/events/market?utm_source=one', startsAt: '2026-10-16T04:00:00Z', endsAt: '2026-10-16T17:00:00Z' };
  const second = { ...first, id: 'fair-saturday', startsAt: '2026-10-17T04:00:00Z', endsAt: '2026-10-17T17:00:00Z', sourceUrl: 'https://example.org/events/market?utm_source=two' };
  it('одна карточка сохраняет реальные даты и id обоих сеансов', () => {
    const series = groupEventDates([second, first, first]);
    expect(series).toHaveLength(1);
    expect(series[0].sessions?.map(s => s.id)).toEqual([first.id, second.id]);
    expect(series[0].endsAt).toBe(second.endsAt);
  });
  it('разные места, страницы и удалённые даты остаются отдельными', () => {
    expect(groupEventDates([first, { ...second, venueName: 'Другой парк' }])).toHaveLength(2);
    expect(groupEventDates([first, { ...second, sourceUrl: 'https://example.org/events/other' }])).toHaveLength(2);
    expect(groupEventDates([{ ...first, sourceUrl: 'https://example.org/events?id=1' }, { ...second, sourceUrl: 'https://example.org/events?id=2' }])).toHaveLength(2);
    expect(groupEventDates([first, { ...second, startsAt: '2026-11-17T04:00:00Z' }])).toHaveLength(2);
  });
  it('выбранный или пропущенный сеанс не возвращается другой карточкой', () => {
    const taste = tasteFrom({ interests: ['art'], times: ['weekend'], withWho: 'friends', budget: 'mid' }, [], now);
    expect(buildDeck(taste, [first, second], { decided: new Set([second.id]), swipes: 0 }, { now })).toEqual([]);
  });
});

describe('путь полностью виден между шапкой и шторкой', () => {
  it.each([[390,844],[320,640],[562,1280]])('%i×%i: все повороты и оба конца помещаются', (width,height) => {
    const coords: [number,number][] = [[76.83,43.29],[76.92,43.21],[76.88,43.25],[76.95,43.24]];
    const padding = { top: 130, right: 72, bottom: Math.round(height*.4), left: 36 };
    const camera = fitCamera(coords,width,height,padding)!;
    for (const [lon,lat] of coords) {
      const p=project(lat,lon,camera,width,height);
      expect(p.x).toBeGreaterThanOrEqual(padding.left-.001);
      expect(p.x).toBeLessThanOrEqual(width-padding.right+.001);
      expect(p.y).toBeGreaterThanOrEqual(padding.top-.001);
      expect(p.y).toBeLessThanOrEqual(height-padding.bottom+.001);
    }
  });
});

it('«Рядом» не склеивает старую точку или цепочку людей на расстоянии', () => {
  const a: FriendSpot = { personId:'a',lat:43.25,lon:76.94,place:'Сейчас',state:'here',minutesAgo:0 };
  const b = { ...a,personId:'b',lat:43.2504 };
  const c = { ...a,personId:'c',lat:43.2508 };
  expect(closeGroups([a,b,c]).map(g=>g.length)).toEqual([2,1]);
  expect(closeGroups([a,{...b,minutesAgo:20}]).map(g=>g.length)).toEqual([1,1]);
});

it('быстрый ответ очищает таймер, а зависший запрос завершается ошибкой', async () => {
  jest.useFakeTimers();
  try {
    await expect(withTimeout(Promise.resolve('ok'),1000)).resolves.toBe('ok');
    expect(jest.getTimerCount()).toBe(0);
    const pending=withTimeout(new Promise(()=>{}),1000);
    const check=expect(pending).rejects.toThrow('timeout');
    jest.advanceTimersByTime(1000);
    await check;
  } finally { jest.useRealTimers(); }
});

it('реакции уникальны и не заменяют коллекцию маскота', () => {
  expect(STICKERS.filter(s=>s.effect).map(s=>s.effect).sort()).toEqual(['confetti','heart','punch','squeak']);
  expect(STICKERS.filter(s=>!s.effect)).toHaveLength(51);
});

it('очередь отправляет сообщение, добавленное во время предыдущей отправки', async () => {
  useOutbox.setState({ items: [] }); useNet.setState({ online: false });
  let release!: () => void;
  const hold = new Promise<void>(resolve => { release = resolve; });
  const sent: string[] = [];
  setOutboxSender(async item => { sent.push(item.id); if (item.id === 'one') await hold; });
  useOutbox.getState().add({ id: 'one', kind: 'message', chatId: 'chat', payload: {} });
  useNet.setState({ online: true });
  await Promise.resolve();
  useOutbox.getState().add({ id: 'two', kind: 'message', chatId: 'chat', payload: {} });
  release();
  await new Promise(resolve => setTimeout(resolve,0));
  expect(sent).toEqual(['one','two']);
  expect(useOutbox.getState().items).toHaveLength(0);
});

it('голос и кружок не загружаются в Storage как JPEG', () => {
  expect(mediaFormat('file:///recording.m4a','voice','application/octet-stream')).toEqual({ contentType: 'audio/mp4', ext: 'm4a' });
  expect(mediaFormat('content://camera/123','circle',null)).toEqual({ contentType:'video/mp4',ext:'mp4' });
  expect(mediaFormat('file:///photo.heic','photo',null)).toEqual({ contentType:'image/heic',ext:'heic' });
});
