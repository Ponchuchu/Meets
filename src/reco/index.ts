// Модуль рекомендаций «Для тебя» (docs/RECOMMENDATIONS.md). Чистые функции без UI и БД:
// тот же код потом крутится в Edge Function `deck`. Пользователь механику не видит нигде.
import { distinctEvents } from '../event/identity';
import { groupEventDates } from '../event/series';
import type { Category, EventItem } from '../data/types';
import { almaty, dayIndex } from '../lib/clock';
import { phaseOf } from '../map/lifecycle';
import { buildStartTaste, INTEREST_TAGS, type DayPart, type StartAnswers, type Taste } from './startTaste';

export type SignalKind = 'arrived' | 'company' | 'go' | 'invite' | 'save' | 'open' | 'dwell' | 'skipAfterOpen' | 'noShow' | 'skip';

export const SIGNAL_WEIGHT: Record<SignalKind, number> = {
  arrived: 3.0, company: 1.5, go: 1.0, invite: 1.0, save: 0.6, open: 0.3, dwell: 0.2,
  skipAfterOpen: -0.2, noShow: -0.3, skip: -0.4,
};

export interface Signal {
  id: string;
  eventId: string;
  kind: SignalKind;
  at: string;
  tags: string[];
  category: Category;
}

const HALF_LIFE_DAYS = 30;
const LEARNING_RATE = 0.25;
const CALIBRATION = 10; // первые 10 свайпов весят вдвое больше
const SKIP_STREAK = 3; // тема проседает после 3 «мимо» подряд
const STREAK_PENALTY = 0.5;

/** Теги события для вкуса: свои теги + группа интереса по категории + «бесплатно». */
export function eventTags(e: Pick<EventItem, 'tags' | 'category' | 'isFree' | 'priceMin'>): string[] {
  const group: Partial<Record<Category, keyof typeof INTEREST_TAGS>> = {
    music: 'music', concert: 'music', standup: 'standup', hike: 'hike', sport: 'sport', bike: 'sport', meetup: 'people',
    games: 'games', art: 'art', theatre: 'art', movie: 'art', food: 'food', party: 'party', talks: 'talks', lecture: 'talks',
  };
  const g = group[e.category];
  const base = g ? INTEREST_TAGS[g].slice(0, 2) : [];
  const set = new Set([...e.tags.map((t) => t.toLowerCase()), ...base]);
  if (e.isFree || e.priceMin === 0) set.add('бесплатно');
  return [...set];
}

export function makeSignal(e: EventItem, kind: SignalKind, at: Date, id = `${e.id}-${kind}-${at.getTime()}`): Signal {
  return { id, eventId: e.id, kind, at: at.toISOString(), tags: eventTags(e), category: e.category };
}

/** Применить один сигнал к вкусу. calibration — сигнал из первых 10 (вес ×2). */
export function applySignal(taste: Taste, s: Signal, now: Date, calibration = false): Taste {
  const ageDays = Math.max(0, (now.getTime() - new Date(s.at).getTime()) / 86400000);
  const decay = 0.5 ** (ageDays / HALF_LIFE_DAYS);
  const w = SIGNAL_WEIGHT[s.kind] * decay * LEARNING_RATE * (calibration ? 2 : 1);
  const tags = { ...taste.tags };
  for (const t of s.tags) tags[t] = Math.max(-1.5, Math.min(3, (tags[t] ?? 0) + w));
  return { ...taste, tags };
}

/** Вкус = стартовые ответы + все сигналы (отменённые из списка удаляются — и не учатся). */
export function tasteFrom(answers: StartAnswers, signals: Signal[], now: Date): Taste {
  let taste = buildStartTaste(answers);
  let streakCat: Category | null = null;
  let streak = 0;
  signals.forEach((s, i) => {
    taste = applySignal(taste, s, now, i < CALIBRATION);
    if (s.kind === 'skip' || s.kind === 'skipAfterOpen') {
      streak = s.category === streakCat ? streak + 1 : 1;
      streakCat = s.category;
      if (streak === SKIP_STREAK) {
        // 3 «мимо» подряд в одной теме — тема заметно проседает.
        const tags = { ...taste.tags };
        for (const t of s.tags) tags[t] = (tags[t] ?? 0) - STREAK_PENALTY;
        taste = { ...taste, tags };
      }
    } else if (s.kind === 'go' || s.kind === 'save' || s.kind === 'company' || s.kind === 'arrived') {
      streak = 0;
      streakCat = null;
    }
  });
  return taste;
}

export interface ScoreContext {
  now: Date;
  /** Похожим понравилось: 0..1 (пока — популярность в городе). */
  similar?: (e: EventItem) => number;
  /** Где я: ближе — лучше (до 2 км — полный балл, дальше 15 км — ноль). Нет точки — не учитываем. */
  me?: { lat: number; lon: number } | null;
}

export interface Score {
  total: number;
  parts: { taste: number; friends: number; time: number; price: number; soon: number; similar: number; novelty: number; near: number };
}

// 21 окт.: добавлено «рядом» (расстояние до места) — далёкое событие при прочих равных теперь ниже.
const WEIGHTS = { taste: 0.32, friends: 0.18, time: 0.13, price: 0.1, soon: 0.1, near: 0.08, similar: 0.05, novelty: 0.04 };

/** Расстояние по прямой, км. */
function km(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const dLat = (b.lat - a.lat) * 111.32, dLon = (b.lon - a.lon) * 111.32 * Math.cos((a.lat * Math.PI) / 180);
  return Math.hypot(dLat, dLon);
}

function dayPartOf(iso: string): { wd: number; part: DayPart } {
  const a = almaty(iso);
  const h = a.getUTCHours();
  return { wd: (a.getUTCDay() + 6) % 7, part: h < 12 ? 'morning' : h < 17 ? 'day' : 'evening' };
}

export function scoreEvent(taste: Taste, e: EventItem, ctx: ScoreContext): Score {
  const tags = eventTags(e);
  const ws = tags.map((t) => taste.tags[t] ?? 0);
  const positive = ws.filter((w) => w > 0);
  const tasteRaw = ws.reduce((a, b) => a + b, 0) / Math.max(1, Math.min(tags.length, 4));
  const tasteScore = Math.max(0, Math.min(1, tasteRaw));
  const friends = Math.min(1, e.friendsGoing.length / 2) * Math.min(1, taste.friendsMultiplier / 2.4);
  const { wd, part } = dayPartOf(e.startsAt);
  const time = taste.timeGrid[wd]?.[part] ?? 0.15;
  const price = e.isFree || !e.priceMin ? 1 : taste.priceCeiling == null ? 1
    : taste.priceCeiling === 0 ? 0 : e.priceMin <= taste.priceCeiling ? 1 : Math.max(0, 1 - (e.priceMin - taste.priceCeiling) / taste.priceCeiling);
  const days = Math.max(0, dayIndex(e.startsAt) - dayIndex(ctx.now));
  const soon = Math.max(0, 1 - days / 14);
  const similar = ctx.similar ? ctx.similar(e) : Math.min(1, Math.log10(1 + e.goingCount) / Math.log10(5000));
  const novelty = positive.length === 0 ? 1 : 0;
  const near = ctx.me && !e.noPoint && !e.needsPin && Number.isFinite(e.lat) ? Math.max(0, Math.min(1, 1 - (km(ctx.me, e) - 2) / 13)) : 0.5;
  const parts = { taste: tasteScore, friends, time, price, soon, similar, novelty, near };
  const total = (Object.keys(WEIGHTS) as (keyof typeof WEIGHTS)[]).reduce((sum, k) => sum + WEIGHTS[k] * parts[k], 0);
  return { total, parts };
}

export interface DeckHistory {
  /** Решённые: пойду / мимо — в колоду больше не попадают. */
  decided: Set<string>;
  /** Сколько было сигналов-свайпов (для калибровки). */
  swipes: number;
}

export interface DeckOptions {
  size?: number;
  /** Каждая N-я карточка — новое за пределами вкуса (по умолчанию каждая 8-я, ~12%). */
  noveltyEvery?: number;
}

/**
 * Колода: первые 3 — сильнейшие совпадения, не больше 2 одной темы подряд, каждая 8-я — новое,
 * при равной оценке «сегодня» выше «через неделю». Калибровка (первые 10 свайпов) — нарочно разные темы.
 */
export function buildDeck(taste: Taste, candidates: EventItem[], history: DeckHistory, ctx: ScoreContext, opts: DeckOptions = {}): EventItem[] {
  const size = opts.size ?? 10;
  const every = opts.noveltyEvery ?? 8;
  const pool = groupEventDates(distinctEvents(candidates))
    .filter((e) => !history.decided.has(e.id) && !e.sessions?.some(s => history.decided.has(s.id)) && phaseOf(e, ctx.now) !== 'hidden' && !e.meetup)
    .map((e) => ({ e, s: scoreEvent(taste, e, ctx) }))
    .sort((a, b) => b.s.total - a.s.total || Date.parse(a.e.startsAt)-Date.parse(b.e.startsAt));
  const deck: EventItem[] = [];
  const used = new Set<string>();
  const calibrating = history.swipes < CALIBRATION;
  while (deck.length < size && used.size < pool.length) {
    const pos = deck.length;
    const last2 = deck.slice(-2).map((e) => e.category);
    const blocked = last2.length === 2 && last2[0] === last2[1] ? last2[0] : null;
    // Не два события одной площадки подряд (раньше кинотеатр мог занять полколоды).
    const lastVenue = deck.at(-1)?.venueName?.toLowerCase() ?? null;
    const sameVenue = (e: EventItem) => !!lastVenue && e.venueName?.toLowerCase() === lastVenue;
    const recent = new Set(deck.slice(-3).map((e) => e.category));
    const free0 = pool.filter((x) => !used.has(x.e.id));
    const recentCovers = new Set(deck.slice(-3).map(e => e.cover).filter(Boolean));
    const varied = free0.filter(x => !x.e.cover || !recentCovers.has(x.e.cover));
    const free = varied.length ? varied : free0;
    let pick: { e: EventItem } | undefined;
    if (pos >= 3 && (pos + 1) % every === 0) {
      // Новое: меньше всего совпадает со вкусом.
      pick = [...free].sort((a, b) => b.s.parts.novelty - a.s.parts.novelty || a.s.parts.taste - b.s.parts.taste || b.s.total - a.s.total)
        .find((x) => x.e.category !== blocked);
    }
    if (!pick && calibrating && pos >= 3) pick = free.find((x) => !recent.has(x.e.category) && x.s.parts.taste > 0);
    if (!pick) pick = free.find((x) => x.e.category !== blocked && !sameVenue(x.e)) ?? free.find((x) => x.e.category !== blocked) ?? free[0];
    if (!pick) break;
    used.add(pick.e.id);
    deck.push(pick.e);
  }
  return deck;
}
