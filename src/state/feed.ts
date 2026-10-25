// Лента «Для тебя»: сигналы (из них считается вкус), решённые карточки, история для «Вернуть».
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Signal } from '../reco';
import { dropSignal, pushAttendance, pushSignal } from '../data/sync';
import { deviceStorage } from './storage';

export const MAX_UNDO_PER_SESSION = 10;

/** Паузы между подсказками жестов: сразу, через 5 дней, через 30 дней; после трёх — не показываем. */
const HINT_GAPS = [0, 5 * 86400e3, 30 * 86400e3];
/** Сколько ждать бездействия на карточке, прежде чем подсказать жест. */
export const HINT_IDLE_MS = 45000;

export function hintDue(shown: number[] | undefined, now: number): boolean {
  const n = shown?.length ?? 0;
  if (n >= HINT_GAPS.length) return false;
  return n === 0 || now - shown![n - 1] >= HINT_GAPS[n];
}

export interface Decision {
  eventId: string;
  kind: 'go' | 'skip';
  signalId: string;
}

interface FeedState {
  signals: Signal[];
  decided: Record<string, 'go' | 'skip'>;
  history: Decision[];
  undosLeft: number; // за сессию, не сохраняется
  /** Места в ленте: неделя, когда показали, и неделя «Мимо» (тогда не показываем 4 недели). */
  spotSeen: Record<string, number>;
  spotSkipped: Record<string, number>;
  markSpot: (id: string, week: number, skipped?: boolean) => void;
  /** Когда показывали подсказку жестов (мс): первый раз, через 5 дней, через месяц — и больше никогда. */
  hintShown: number[];
  markHint: (at: number) => void;
  decide: (d: Decision, s: Signal) => void;
  addSignal: (s: Signal) => void;
  removeSignal: (id: string) => void;
  /** Вернуть последнее решение: сигнал стирается целиком. */
  undo: () => Decision | null;
  /** «Сбросить вкус» из админки: снова считаем только от ответов при регистрации. */
  resetTaste: () => void;
  /** Снова показать всё, что пропустил («Мимо»); «Пойду» остаётся в планах. */
  restoreSkipped: () => void;
}

export const useFeed = create<FeedState>()(
  persist(
    (set, get) => ({
      signals: [],
      decided: {},
      history: [],
      undosLeft: MAX_UNDO_PER_SESSION,
      spotSeen: {},
      spotSkipped: {},
      hintShown: [],
      markHint: (at) => set((st) => ({ hintShown: [...(st.hintShown ?? []), at].slice(-5) })),
      markSpot: (id, week, skipped = false) => set((st) => ({ spotSeen: { ...st.spotSeen, [id]: week }, ...(skipped ? { spotSkipped: { ...st.spotSkipped, [id]: week } } : {}) })),
      decide: (d, s) => {
        pushSignal(s);
        if (d.kind === 'skip' || d.kind === 'go') pushAttendance(d.eventId, d.kind === 'go' ? 'going' : 'skipped');
        set((st) => ({
        signals: [...st.signals, s],
        decided: { ...st.decided, [d.eventId]: d.kind },
        history: [...st.history, d].slice(-50),
        }));
      },
      addSignal: (s) => {
        pushSignal(s);
        set((st) => ({ signals: [...st.signals, s] }));
      },
      removeSignal: (id) => set((st) => {
        const sig = st.signals.find((x) => x.id === id);
        if (sig) dropSignal(sig.eventId, sig.kind);
        return { signals: st.signals.filter((x) => x.id !== id) };
      }),
      undo: () => {
        const st = get();
        const last = st.history[st.history.length - 1];
        if (!last || st.undosLeft <= 0) return null;
        const decided = { ...st.decided };
        delete decided[last.eventId];
        const sig = st.signals.find((x) => x.id === last.signalId);
        if (sig) dropSignal(sig.eventId, sig.kind);
        pushAttendance(last.eventId, null);
        set({
          history: st.history.slice(0, -1),
          decided,
          signals: st.signals.filter((x) => x.id !== last.signalId),
          undosLeft: st.undosLeft - 1,
        });
        return last;
      },
      resetTaste: () => set({ signals: [], decided: {}, history: [] }),
      restoreSkipped: () => {
        const st = get();
        const skipped = Object.keys(st.decided).filter((id) => st.decided[id] === 'skip');
        skipped.forEach((id) => pushAttendance(id, null));
        set({ decided: Object.fromEntries(Object.entries(st.decided).filter(([, k]) => k !== 'skip')), history: st.history.filter((h) => h.kind !== 'skip') });
      },
    }),
    { name: 'ryadom-feed', storage: deviceStorage(), partialize: ({ undosLeft: _u, history: _h, ...rest }) => rest },
  ),
);
