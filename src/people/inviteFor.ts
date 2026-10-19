// «Позвать куда-то»: алгоритм «Для тебя» для двоих — 3 события по общим интересам и планам.
import type { EventItem, PersonDetails } from '../data/types';
import { buildDeck, eventTags, scoreEvent } from '../reco';
import { INTEREST_TAGS, type Interest, type Taste } from '../reco/startTaste';

const CAT_WORD: Partial<Record<EventItem['category'], string>> = {
  music: 'ДЖАЗ И ЖИВУЮ МУЗЫКУ', concert: 'КОНЦЕРТЫ', standup: 'СТЕНДАП', games: 'НАСТОЛКИ', hike: 'ГОРЫ', art: 'ВЫСТАВКИ',
  food: 'ЕДУ И МАРКЕТЫ', sport: 'СПОРТ', bike: 'ВЕЛО', talks: 'ЛЕКЦИИ', lecture: 'ЛЕКЦИИ', party: 'ВЕЧЕРИНКИ', theatre: 'ТЕАТР', movie: 'КИНО',
};

export interface InviteIdea {
  e: EventItem;
  why: string;
}

export function friendAffinity(e: EventItem, friend: PersonDetails): number {
  const tags = new Set(eventTags(e));
  const hits = friend.interestKeys.filter((k) => (INTEREST_TAGS[k as Interest] ?? []).some((t) => tags.has(t))).length;
  return Math.min(1, hits / 1.5);
}

export function ideasForTwo(myTaste: Taste, friendId: string, friendName: string, friend: PersonDetails, events: EventItem[], ctx: { now: Date; going: Set<string>; savedByFriend?: Set<string> }): InviteIdea[] {
  const deck = buildDeck(myTaste, events, { decided: new Set(), swipes: 99 }, { now: ctx.now }, { size: 30, noveltyEvery: 1000 });
  const scored = deck.map((e) => {
    const both = ctx.going.has(e.id) && e.friendsGoing.includes(friendId);
    const his = e.friendsGoing.includes(friendId);
    const s = scoreEvent(myTaste, e, { now: ctx.now }).total * 0.5 + friendAffinity(e, friend) * 0.35 + (both ? 0.4 : his ? 0.25 : 0);
    return { e, s, both, his };
  }).sort((a, b) => b.s - a.s);
  const upper = friendName.toUpperCase();
  return scored.slice(0, 3).map(({ e, both, his }) => {
    let why = 'РЯДОМ С ВАМИ ОБОИМИ';
    if (both) why = 'ВЫ ОБА ИДЁТЕ — ВСТРЕТИТЬСЯ У ВХОДА';
    else if (his) why = `${upper} ИДЁТ ТУДА`;
    else if (ctx.savedByFriend?.has(e.id)) why = `${upper} СОХРАНИЛ ЭТО СОБЫТИЕ`;
    else if (ctx.going.has(e.id)) why = 'ТЫ ИДЁШЬ — ПОЗОВИ С СОБОЙ';
    else if (friendAffinity(e, friend) > 0 && CAT_WORD[e.category]) why = `ОБА ЛЮБИТЕ ${CAT_WORD[e.category]}`;
    return { e, why };
  });
}
