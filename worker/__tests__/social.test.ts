// Разбор постов Instagram без ИИ — на настоящих подписях (worker/fixtures/instagram.json, 26 октября).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { dateIn, parseSocial, priceIn, russianPart, tidyTitle, whenOf } from '../src/social.ts';
import { findDuplicate, findSeries } from '../src/dedupe.ts';
import type { Extraction } from '../src/types.ts';
import type { VenueRow } from '../src/venues.ts';

const posts = JSON.parse(readFileSync(join(__dirname, '../fixtures/instagram.json'), 'utf8')) as { handle: string; at: string; text: string }[];

const venues: VenueRow[] = [
  { id: 'arena', name: 'Almaty Arena', aliases: ['Алматы Арена'], address: 'микрорайон Нуркент, 7', lat: 43.26376, lon: 76.81755 },
  { id: 'central', name: 'Central Stand-up Club', aliases: ['Almaty Central Stand Up Club'], address: 'улица Кабанбай батыра, 71', lat: 43.25037, lon: 76.95164 },
  { id: 'tennisi', name: 'Tennisi Arena Pub', aliases: [], address: 'улица Жандосова, 2', lat: 43.18646, lon: 76.82971 },
];
const NOW = new Date('2026-10-26T12:00:00+05:00');
const post = (handle: string, start: string) => posts.find((p) => p.handle === handle && p.text.startsWith(start))!;
const events = (p: { text: string; at: string }, folder: string, venue: string | null = null, title?: string): Extraction[] => {
  const r = parseSocial(p.text, p.at, { folder, venue_name: venue, title }, venues, NOW);
  return r.kind === 'events' ? r.items : [];
};

describe('даты', () => {
  it('русские, казахские и английские месяцы', () => {
    expect(dateIn('📅 5 ноября | 20:00')).toMatchObject({ day: 5, month: 10 });
    expect(dateIn('29 қарашада Almaty Arena сахнасында')).toMatchObject({ day: 29, month: 10 });
    expect(dateIn('October 24')).toMatchObject({ day: 24, month: 9 });
    expect(dateIn('31 октября — 1 ноября')).toMatchObject({ day: 31, month: 9, endDay: 1, endMonth: 10 });
  });
  it('год — ближайший после поста, время после даты', () => {
    const w = whenOf('Концерт 3 января в 19:00', new Date('2026-10-26T00:00:00Z'))!;
    expect(w.starts).toBe('2027-01-03T19:00:00+05:00');
    expect(w.timeKnown).toBe(true);
    expect(whenOf('9 PM · October 24', new Date('2026-10-20T00:00:00Z'))!.starts).toBe('2026-10-24T21:00:00+05:00');
  });
  it('цена и «бесплатно»', () => {
    expect(priceIn('Вход свободный')).toEqual({ min: null, max: null, free: true });
    expect(priceIn('Кіру тегін')).toEqual({ min: null, max: null, free: true });
    expect(priceIn('Билеты от 5 000 тг до 15 000 тг')).toEqual({ min: 5000, max: 15000, free: false });
    expect(priceIn('доступ во Freedom SuperApp').free).toBe(false);
  });
  it('русская часть двуязычного поста и заголовок без капса', () => {
    expect(russianPart('Қазақша мәтін әнші\n———\nРусский текст концерта')).toBe('Русский текст концерта');
    expect(tidyTitle('ХАМДАМ СОБИРОВ ВПЕРВЫЕ НА ALMATY ARENA! 🔥', 'шоу Хамдама Собирова и Хамдам Собиров')).toBe('Хамдам Собиров впервые на Almaty Arena');
  });
});

describe('посты', () => {
  it('розыгрыш билетов — не событие', () => {
    expect(parseSocial(post('almatyarena', '🎁').text, post('almatyarena', '🎁').at, { folder: 'venue', venue_name: 'Almaty Arena' }, venues, NOW)).toEqual({ kind: 'junk', cls: 'ad' });
  });
  it('страница площадки: место по умолчанию, точка с карты, время', () => {
    const [x] = events(post('almatyarena', '🎤 ARO'), 'venue', 'Almaty Arena', 'Almaty Arena');
    expect(x).toMatchObject({ title: 'ARO TOUR Алматы Аренада', starts_at: '2026-11-29T20:00:00+05:00', venue_name: 'Almaty Arena', lat: 43.26376, category: 'concert' });
    expect(x.confidence).toBeGreaterThanOrEqual(0.95);
  });
  it('спектакль на два дня — одна карточка с двумя датами', () => {
    const [x, ...rest] = events(post('total_theater', 'Не ходи'), 'theatre', 'Тотальный театр', 'Тотальный театр');
    expect(rest).toHaveLength(0);
    expect(x.title).toBe('Гретель und Гензель');
    expect(x.sessions).toHaveLength(2);
    expect(x.category).toBe('theatre');
  });
  it('дата продажи билетов — не дата концерта', () => {
    const [x] = events(post('kuda.almaty', 'Thirty'), 'afisha');
    expect(x.starts_at!.slice(0, 10)).toBe('2027-05-29');
    expect(x.title).toBe('Thirty Seconds to Mars возвращаются в Алматы');
  });
  it('название над датой и площадка в строке с 📍', () => {
    const [x] = events(post('central.standup.almaty', 'Отдел'), 'standup', 'Central Stand-up Club');
    expect(x).toMatchObject({ title: 'Отдел маркетинга', starts_at: '2026-10-26T21:30:00+05:00', venue_name: 'Central Stand-up Club' });
  });
  it('афиша недели: отдельные карточки, повторы в одном баре — даты одной карточки', () => {
    const list = events(post('quizplease_almaty', 'Хватит залипать'), 'community', null, 'Квиз, плиз!');
    expect(list.length).toBeGreaterThan(8);
    const classic = list.find((x) => x.title === 'Квиз, плиз!: Классика' && x.venue_name === 'Tennisi Arena Pub')!;
    expect(classic.sessions!.length).toBeGreaterThanOrEqual(2);
    expect(list.every((x) => x.category === 'games')).toBe(true);
    expect(list.find((x) => x.venue_name === 'Mad Murphy’s')).toBeTruthy();
  });
});

describe('дубли и даты', () => {
  const known = [{ id: 'e1', title: 'Хамдам Собиров', starts_at: '2026-11-05T15:00:00Z', venue_name: 'Almaty Arena' }];
  it('пост без времени склеивается с афишей по дню и площадке', () => {
    expect(findDuplicate({ title: 'Хамдам Собиров впервые на Almaty Arena', starts_at: '2026-11-05T07:00:00Z', venue_name: 'Almaty Arena', time_known: false }, known)?.id).toBe('e1');
  });
  it('тот же спектакль в другой день — новая дата у прежней карточки', () => {
    const k = [{ id: 't1', title: 'Мой внутренний Элвис', starts_at: '2026-10-28T14:30:00Z', venue_name: 'Тотальный театр' }];
    expect(findSeries({ title: 'Мой внутренний Элвис', starts_at: '2026-11-12T14:30:00Z', venue_name: 'Тотальный театр' }, k)?.id).toBe('t1');
    expect(findSeries({ title: 'Некармен', starts_at: '2026-11-12T14:30:00Z', venue_name: 'Тотальный театр' }, k)).toBeNull();
  });
});
