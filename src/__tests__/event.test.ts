import { demoEvents, PEOPLE } from '../data/demo';
import { buildMeetup, ctaLabel, validateMeetup, type MeetupForm } from '../event/meetup';
import { routeLinks } from '../event/route';
import { coverDate, coverLinesFor, coverTime, priceTitle, relative, whenSub, whenTitle } from '../event/text';
import { activeCompany, NEW_CHATS_PER_DAY, usePlans } from '../state/plans';


const at = (s: string) => new Date(`${s}+05:00`);
const NOW = at('2026-09-28T17:30:00');
const events = demoEvents(NOW);
const jazz = events.find((e) => e.id === 'jazz')!;
const hike = events.find((e) => e.id === 'hike')!;
const anime = events.find((e) => e.id === 'anime')!;

describe('тексты события', () => {
  it('когда — как в макете', () => {
    expect(whenTitle(jazz, NOW)).toBe('Сегодня, 19:30–22:00');
    expect(whenSub(jazz, NOW)).toBe('через 2 часа · вечером +16°, ясно');
    expect(whenTitle(hike, NOW)).toBe('Суббота, 3 октября, 08:00–16:00');
    expect(whenTitle(anime, NOW)).toBe('Сегодня, до 21:00');
    expect(whenSub(anime, NOW)).toMatch(/^открыто ещё 4 часа/);
  });
  it('относительное время', () => {
    expect(relative('2026-09-28T18:00:00+05:00', NOW)).toBe('через 30 минут');
    expect(relative('2026-10-03T08:00:00+05:00', NOW)).toBe('через 5 дней');
    expect(relative('2026-09-29T08:00:00+05:00', NOW)).toBe('завтра');
  });
  it('обложка', () => {
    expect(coverDate(jazz.startsAt)).toBe('ПН 28.09');
    expect(coverTime(jazz)).toBe('19:30—22:00');
    expect(coverTime(hike)).toBe('СБОР 08:00');
    expect(coverTime(anime)).toBe('ДО 21:00');
    expect(coverLinesFor('Концерт группы «Дурной Вкус»')).toEqual(['КОНЦЕРТ', 'ГРУППЫ', 'ДУРНОЙ ВКУС']);
  });
  it('цена', () => {
    expect(priceTitle(jazz)).toBe('Бесплатно');
    expect(priceTitle({ isFree: false, priceMin: 3000, priceMax: 3000 })).toBe('3 000 ₸');
    expect(priceTitle({ isFree: false, priceMin: 15000, priceMax: null })).toBe('от 15 000 ₸');
    expect(priceTitle({ isFree: false, priceMin: 5000, priceMax: 12000 })).toBe('5 000–12 000 ₸');
  });
});

describe('маршрут', () => {
  it('2ГИС, Яндекс, Google; Apple — только на iOS', () => {
    const android = routeLinks(43.25, 76.94, 'Двор', false).map((l) => l.label);
    expect(android).toEqual(['2ГИС', 'Яндекс Карты', 'Google Maps']);
    const ios = routeLinks(43.25, 76.94, 'Двор', true);
    expect(ios.map((l) => l.app)).toContain('apple');
    expect(ios[0].web).toContain('76.94%2C43.25');
  });
});

describe('ищу компанию и лимиты', () => {
  it('заявка снимается, когда событие началось', () => {
    const r = { eventId: 'jazz', moods: ['meet' as const], visibility: 'all' as const, note: '', at: '' };
    expect(activeCompany(r, jazz, NOW)).toBe(true);
    expect(activeCompany(r, jazz, at('2026-09-28T19:31:00'))).toBe(false);
  });
  it('«зачем иду» — можно выбрать все причины', () => {
    usePlans.getState().lookForCompany({ eventId: 'jazz', moods: ['music', 'meet', 'walk', 'notalone'], visibility: 'all', note: '' });
    expect(usePlans.getState().company.jazz.moods).toEqual(['music', 'meet', 'walk', 'notalone']);
  });
  it('не больше 10 новых разговоров в день', () => {
    const { startChat } = usePlans.getState();
    for (let i = 0; i < NEW_CHATS_PER_DAY; i++) expect(startChat(`p${i}`, 'd1')).toBe(true);
    expect(startChat('p-extra', 'd1')).toBe(false);
    expect(startChat('p0', 'd1')).toBe(true); // с уже начатым можно
    expect(startChat('p-extra', 'd2')).toBe(true); // новый день
  });
  it('«Я иду» и отмена', () => {
    const s = usePlans.getState();
    s.go('jazz');
    expect(usePlans.getState().going.jazz).toBeTruthy();
    s.ungo('jazz');
    expect(usePlans.getState().going.jazz).toBeUndefined();
  });
});

describe('создать встречу', () => {
  const form: MeetupForm = {
    mode: 'friends', kind: 'dinner', title: 'Ужин у меня', note: 'плов', dayOffset: 4, time: '19:30',
    place: 'Моя квартира', district: 'Бостандык', address: 'Тимирязева 42, кв 5', invited: ['igor', 'denis', 'timur'], plusOne: true, items: [],
  };
  it('кнопка и проверки', () => {
    expect(ctaLabel(form)).toBe('Позвать 3 друзей');
    expect(ctaLabel({ ...form, invited: ['igor'] })).toBe('Позвать 1 друга');
    expect(ctaLabel({ ...form, mode: 'open' })).toBe('Опубликовать на карте');
    expect(validateMeetup({ ...form, title: ' ' })).toBe('Назови встречу');
    expect(validateMeetup({ ...form, invited: [] })).toBe('Выбери, кого позвать');
    expect(validateMeetup(form)).toBeNull();
  });
  it('для друзей — видна только гостям, точка в центре района', () => {
    const e = buildMeetup(form, NOW, 'm1');
    expect(e.visibility).toBe('friends');
    expect(e.startsAt).toBe('2026-10-02T14:30:00.000Z');
    expect(e.category).toBe('food');
    expect(e.lat).toBeCloseTo(43.224, 2);
    expect(e.meetup?.invited).toEqual(['igor', 'denis', 'timur']);
  });
});

it('в демо есть все, кто ищет компанию на джазе', () => {
  for (const l of jazz.lookers ?? []) expect(PEOPLE.find((p) => p.id === l.personId)).toBeTruthy();
});

describe('поделиться событием', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { eventLink, shareText } = require('../event/share') as typeof import('../event/share');
  it('ссылка на событие и подпись', () => {
    expect(eventLink('jazz')).toMatch(/\/event\/jazz$/);
    expect(shareText('Джаз во дворе', 'сегодня в 19:30')).toBe('Джаз во дворе — сегодня в 19:30. Пойдём?');
  });
});
