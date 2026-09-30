// Вкладка «Рекомендации» (макет TasteAdmin): что модель знает о человеке и почему колода такая.
import type { EventItem } from '../data/types';
import { buildDeck, scoreEvent, SIGNAL_WEIGHT, type Score, type Signal, type SignalKind } from '../reco';
import { buildStartTaste, type StartAnswers, type Taste } from '../reco/startTaste';

export const SIGNAL_LABEL: Record<SignalKind, string> = {
  go: 'пойду', skip: 'мимо', open: 'открыл', company: 'ищу компанию', arrived: 'дошёл', noShow: 'пойду, не дошёл',
  save: 'сохранил', invite: 'позвал', dwell: 'читал', skipAfterOpen: 'открыл, мимо',
};

/** Уверенность модели: чем больше сигналов, тем меньше решают стартовые ответы. */
export function modelConfidence(signals: number): { confidence: number; answersWeight: number } {
  return {
    confidence: Math.min(0.95, signals / (signals + 150)),
    answersWeight: Math.max(0.2, 1 - signals / 100),
  };
}

export interface TasteRow {
  tag: string;
  label: string;
  value: number;
  delta: number;
}

/** Топ тегов вкуса со сдвигом от стартовых ответов. */
export function tasteRows(taste: Taste, start: Taste, n = 7): TasteRow[] {
  const all = new Set([...Object.keys(taste.tags), ...Object.keys(start.tags)]);
  return [...all]
    .map((tag) => ({ tag, label: tag[0].toUpperCase() + tag.slice(1), value: taste.tags[tag] ?? 0, delta: (taste.tags[tag] ?? 0) - (start.tags[tag] ?? 0) }))
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value) || Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, n);
}

export interface DeckRow {
  event: EventItem;
  score: Score;
  rule: string;
}

/** Следующие карточки с разбором оценки — как их видит человек, в том же порядке. */
export function deckRows(taste: Taste, events: EventItem[], decided: Set<string>, swipes: number, now: Date, opts: { novelty: boolean; friendName?: (id: string) => string | undefined }): DeckRow[] {
  const deck = buildDeck(taste, events, { decided, swipes }, { now }, { size: 8, noveltyEvery: opts.novelty ? 8 : 10_000 });
  const ceiling = taste.priceCeiling;
  return deck.map((event, i) => {
    const score = scoreEvent(taste, event, { now });
    const prev = deck.slice(Math.max(0, i - 2), i).map((e) => e.category);
    let rule = '';
    if (i < 3 && score.parts.taste >= 0.5) rule = 'сильное совпадение';
    else if (score.parts.novelty > 0 && (i + 1) % 8 === 0) rule = 'новое · каждая 8-я';
    else if (event.friendsGoing.length) rule = `идёт ${opts.friendName?.(event.friendsGoing[0]) ?? 'друг'}`;
    else if (ceiling != null && (event.priceMin ?? 0) > ceiling) rule = 'выше бюджета';
    else if (prev.length === 2 && prev[0] === prev[1] && prev[0] !== event.category) rule = 'не 3 темы подряд';
    return { event, score, rule };
  });
}

export const signalWeight = (k: SignalKind) => SIGNAL_WEIGHT[k];

export function startOf(answers: StartAnswers): Taste {
  return buildStartTaste(answers);
}

export type { Signal };
