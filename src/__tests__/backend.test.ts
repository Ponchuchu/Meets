import { e164 } from '../auth/service';
import { coarse, isRemoteId } from '../data/realtime';
import { hhmm, mapMessage, mapProfile, mapSpot } from '../data/remote';
import { fromOpenMeteo, skyOf } from '../data/weather';

describe('погода Open-Meteo', () => {
  const payload = {
    daily: {
      time: ['2026-09-27', '2026-09-28', '2026-09-29', '2026-09-30'],
      weather_code: [0, 61, 2, 95],
      temperature_2m_max: [20.4, 11.6, 15.2, 9],
    },
  };
  it('начинает с сегодняшнего дня и добивает до 7 дней', () => {
    const f = fromOpenMeteo(payload, '2026-09-28');
    expect(f).toHaveLength(7);
    expect(f[0]).toEqual({ sky: 'rain', text: 'дождь', temp: 12 });
    expect(f[1]).toEqual({ sky: 'part', text: 'переменная облачность', temp: 15 });
    expect(f[2].text).toBe('гроза');
    expect(f[6]).toEqual(f[2]);
  });
  it('коды WMO', () => {
    expect(skyOf(0).sky).toBe('sun');
    expect(skyOf(3).sky).toBe('cloud');
    expect(skyOf(73).text).toBe('снег');
    expect(skyOf(81).sky).toBe('rain');
  });
});

describe('строки базы → приложение', () => {
  const id = 'a86e3d93-8824-cebe-5f4a-c8556c6352f0';
  it('профиль: возраст, инициал, друг', () => {
    const p = mapProfile({ id, name: 'игорь', photo_url: 'igor', handle: 'igor', birth_date: '2001-03-14' }, new Set([id]), new Date('2026-09-28T12:00:00Z'));
    expect(p).toMatchObject({ id, name: 'игорь', initial: 'И', age: 25, photo: 'igor', isFriend: true, handle: 'igor' });
  });
  it('сообщение: моё — «me», время по Алматы, длительность', () => {
    const m = mapMessage({ id: 'm1', chat_id: 'c', author_id: 'u1', kind: 'voice', body: null, media_path: null, duration_s: 74, created_at: '2026-09-28T13:10:00Z' }, 'u1');
    expect(m).toMatchObject({ authorId: 'me', time: '18:10', duration: '1:14', text: '' });
    expect(hhmm('2026-09-28T19:05:00Z')).toBe('00:05');
  });
  it('друг на карте: едет, стоит, давно не обновлялся', () => {
    const at = new Date('2026-09-28T13:10:00Z');
    const base = { user_id: 'u', lat: 43.25, lon: 76.94, heading: 90, updated_at: '2026-09-28T13:09:00Z' };
    expect(mapSpot({ ...base, speed: 5 }, at)).toMatchObject({ state: 'moving', speedKmh: 18, minutesAgo: 1, heading: 90 });
    expect(mapSpot({ ...base, speed: 0.3 }, at).state).toBe('here');
    expect(mapSpot({ ...base, speed: null, updated_at: '2026-09-28T12:30:00Z' }, at).state).toBe('paused');
  });
});

describe('Realtime и вход', () => {
  it('точка для друзей огрубляется до ~50 м', () => {
    const c = coarse(43.253312, 76.940987);
    expect(Math.abs(c.lat - 43.253312)).toBeLessThan(0.00045);
    expect(Math.abs(c.lon - 76.940987)).toBeLessThan(0.0006);
    expect(coarse(43.2531, 76.94099)).toEqual(coarse(43.25312, 76.94101));
  });
  it('id из базы отличаем от демо', () => {
    expect(isRemoteId('a86e3d93-8824-cebe-5f4a-c8556c6352f0')).toBe(true);
    expect(isRemoteId('dm-igor')).toBe(false);
  });
  it('телефон в формате E.164', () => {
    expect(e164('707 123 45 67')).toBe('+77071234567');
  });
});
