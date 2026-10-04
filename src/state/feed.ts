// Лента «Для тебя»: сигналы (из них считается вкус), решённые карточки, история для «Вернуть».
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Signal } from '../reco';
import { dropSignal, pushAttendance, pushSignal } from '../data/sync';
import { deviceStorage } from './storage';

export const MAX_UNDO_PER_SESSION = 10;

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
  decide: (d: Decision, s: Signal) => void;
  addSignal: (s: Signal) => void;
  removeSignal: (id: string) => void;
  /** Вернуть последнее решение: сигнал стирается целиком. */
  undo: () => Decision | null;
  /** «Сбросить вкус» из админки: снова считаем только от ответов при регистрации. */
  resetTaste: () => void;
}

export const useFeed = create<FeedState>()(
  persist(
    (set, get) => ({
      signals: [],
      decided: {},
      history: [],
      undosLeft: MAX_UNDO_PER_SESSION,
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
    }),
    { name: 'ryadom-feed', storage: deviceStorage(), partialize: ({ undosLeft: _u, history: _h, ...rest }) => rest },
  ),
);
