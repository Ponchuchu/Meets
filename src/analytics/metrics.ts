// Метрики рекомендаций (docs/RECOMMENDATIONS.md, раздел 6). Чистые функции — покрыты тестами.
import { dayIndex } from '../lib/clock';

export type AnalyticsName = 'feed_open' | 'card_shown' | 'go' | 'skip' | 'undo' | 'cancel_plan' | 'arrived' | 'event_open' | 'chat_sent';

export interface AnalyticsEvent {
  name: AnalyticsName;
  at: string; // ISO
  eventId?: string;
  /** Человек или устройство — для D1/D7 по когортам. */
  who?: string;
}

export interface Metrics {
  shown: number;
  goRate: number | null; // доля «пойду» от показанных, норма 20–35%
  arrivedRate: number | null; // дошли из нажавших «пойду» — главная метрика
  d1: number | null; // вернулись в «Для тебя» на следующий день
  d7: number | null; // … через неделю
  undoRate: number | null; // отмены и «вернуть», норма < 5%
  verdicts: string[];
}

const ratio = (a: number, b: number) => (b > 0 ? a / b : null);

export function computeMetrics(events: AnalyticsEvent[], now: Date): Metrics {
  const count = (n: AnalyticsName) => events.filter((e) => e.name === n).length;
  const shown = count('card_shown');
  const goes = new Set(events.filter((e) => e.name === 'go' && e.eventId).map((e) => `${e.who ?? ''}:${e.eventId}`));
  const arrived = new Set(events.filter((e) => e.name === 'arrived' && e.eventId).map((e) => `${e.who ?? ''}:${e.eventId}`));
  const arrivedOfGo = [...arrived].filter((k) => goes.has(k)).length;
  const decisions = count('go') + count('skip');

  // Возвраты: для каждого человека — первый день с лентой; D1/D7 считаем только у тех, у кого этот день уже наступил.
  const days = new Map<string, Set<number>>();
  events.filter((e) => e.name === 'feed_open').forEach((e) => {
    const k = e.who ?? 'me';
    days.set(k, (days.get(k) ?? new Set()).add(dayIndex(e.at)));
  });
  const today = dayIndex(now);
  const cohort = (offset: number) => {
    let eligible = 0;
    let back = 0;
    days.forEach((set) => {
      const first = Math.min(...set);
      if (first + offset > today) return;
      eligible++;
      if (set.has(first + offset)) back++;
    });
    return ratio(back, eligible);
  };

  const m: Metrics = {
    shown,
    goRate: ratio(count('go'), shown),
    arrivedRate: ratio(arrivedOfGo, goes.size),
    d1: cohort(1),
    d7: cohort(7),
    undoRate: ratio(count('undo') + count('cancel_plan'), decisions),
    verdicts: [],
  };
  if (m.goRate != null && shown >= 20) {
    if (m.goRate < 0.2) m.verdicts.push('Меньше 20% «пойду» — промахиваемся со вкусом');
    else if (m.goRate > 0.35) m.verdicts.push('Больше 35% «пойду» — карточки слишком лёгкие: соглашаются и не идут');
  }
  if (m.undoRate != null && decisions >= 20 && m.undoRate >= 0.05) m.verdicts.push('Много отмен и «вернуть» — проблема в жестах, а не во вкусе');
  return m;
}

export const pct = (v: number | null) => (v == null ? '—' : `${Math.round(v * 100)}%`);
