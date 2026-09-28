import { demoEvents, PERSON_DETAILS } from '../data/demo';
import { ideasForTwo } from '../people/inviteFor';
import { tasteFrom } from '../reco';
import { canSee, canSendSticker, DEFAULT_PRIVACY, distanceLabel, distanceM, fuzz, inHomeZone, type Field, type Relation } from '../people/visibility';

const P = DEFAULT_PRIVACY;
const all: Relation[] = ['stranger', 'coEvent', 'friend'];
const see = (field: Field, p = P) => all.map((r) => canSee(r, field, p));

describe('кто что видит', () => {
  it('фото, о себе, интересы — все', () => {
    expect(see('profile')).toEqual([true, true, true]);
  });
  it('«ищет компанию»: все — если сам включил для всех; идущие вместе и друзья — да', () => {
    expect(see('lookingForCompany')).toEqual([false, false, false]); // заявки нет
    expect(see('lookingForCompany', { ...P, company: 'all' })).toEqual([true, true, true]);
    expect(see('lookingForCompany', { ...P, company: 'fof' })).toEqual([false, true, true]);
    expect(canSee('stranger', 'lookingForCompany', { ...P, company: 'fof' }, { friendOfFriend: true })).toBe(true);
  });
  it('значки и % города: друзьям — да, остальным — если сам разрешил', () => {
    expect(see('achievements')).toEqual([false, false, true]);
    expect(see('achievements', { ...P, achievements: 'all' })).toEqual([true, true, true]);
    expect(see('achievements', { ...P, achievements: 'me' })).toEqual([false, false, false]);
  });
  it('мои планы — только друзья', () => {
    expect(see('plans')).toEqual([false, false, true]);
    expect(see('plans', { ...P, plansVisible: 'nobody' })).toEqual([false, false, false]);
  });
  it('где сейчас на карте — только друзья и только если включил', () => {
    expect(see('location')).toEqual([false, false, false]);
    expect(see('location', { ...P, sharingLocation: true })).toEqual([false, false, true]);
    expect(see('location', { ...P, sharingLocation: true, invisible: true })).toEqual([false, false, false]);
    expect(see('location', { ...P, sharingLocation: true, atHome: true })).toEqual([false, false, false]);
  });
  it('скорость и статус — как геолокация и если показывает движение', () => {
    expect(see('speedStatus', { ...P, sharingLocation: true })).toEqual([false, false, true]);
    expect(see('speedStatus', { ...P, sharingLocation: true, showMoving: false })).toEqual([false, false, false]);
  });
  it('вкус и рекомендации — никому, даже себе', () => {
    expect([...see('taste'), canSee('self', 'taste', P)]).toEqual([false, false, false, false]);
  });
  it('невидимка прячет планы и компанию', () => {
    expect(see('plans', { ...P, invisible: true })).toEqual([false, false, false]);
    expect(see('lookingForCompany', { ...P, company: 'all', invisible: true })).toEqual([false, false, false]);
  });
});

describe('геолокация', () => {
  it('точность около 50 м', () => {
    const p = { lat: 43.25671, lon: 76.94532 };
    expect(distanceM(p, fuzz(p.lat, p.lon))).toBeLessThan(40);
  });
  it('300 м вокруг дома скрыты', () => {
    const home = { lat: 43.2240, lon: 76.9180 };
    expect(inHomeZone({ lat: 43.2255, lon: 76.9180 }, home)).toBe(true); // ~170 м
    expect(inHomeZone({ lat: 43.2280, lon: 76.9180 }, home)).toBe(false); // ~450 м
    expect(inHomeZone({ lat: 43.2255, lon: 76.9180 }, null)).toBe(false);
  });
  it('подписи расстояний', () => {
    expect(distanceLabel(412)).toBe('в 400 м');
    expect(distanceLabel(1210)).toBe('в 1,2 км');
  });
  it('стикер — не чаще раза в 10 минут', () => {
    const now = new Date('2026-09-28T18:00:00Z');
    expect(canSendSticker(undefined, now)).toBe(true);
    expect(canSendSticker('2026-09-28T17:55:00Z', now)).toBe(false);
    expect(canSendSticker('2026-09-28T17:50:00Z', now)).toBe(true);
  });
});


describe('позвать куда-то', () => {
  const NOW = new Date('2026-09-28T12:00:00+05:00');
  const taste = tasteFrom({ interests: ['music', 'games', 'hike'], times: ['weekday', 'weekend'], withWho: 'friends', budget: 'mid' }, [], NOW);
  it('Игорю: 3 события, первым — джаз, куда идёте оба', () => {
    const ideas = ideasForTwo(taste, 'igor', 'Игорь', PERSON_DETAILS.igor, demoEvents(NOW), { now: NOW, going: new Set(['jazz']) });
    expect(ideas).toHaveLength(3);
    expect(ideas[0].e.id).toBe('jazz');
    expect(ideas[0].why).toBe('ВЫ ОБА ИДЁТЕ — ВСТРЕТИТЬСЯ У ВХОДА');
    expect(new Set(ideas.map((x) => x.e.id)).size).toBe(3);
  });
});
