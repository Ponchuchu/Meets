// Локальное состояние интерфейса (Zustand): счётчики на таб-баре.
import { create } from 'zustand';

interface AppState {
  /** Новых планов с последнего открытия профиля — бейдж на вкладке «Профиль». */
  newPlans: number;
  /** Есть новые карточки в «Для тебя» — оранжевая точка. */
  freshFeed: boolean;
  /** Счётчик прилётов «пойду» — таб-бар проигрывает кольцо и «+1» на «Профиле». */
  planPulse: number;
  pulsePlan: () => void;
  addPlan: () => void;
  removePlan: () => void;
  seenPlans: () => void;
  seenFeed: () => void;
}

export const useApp = create<AppState>((set) => ({
  newPlans: 0,
  freshFeed: true,
  planPulse: 0,
  pulsePlan: () => set((s) => ({ planPulse: s.planPulse + 1 })),
  addPlan: () => set((s) => ({ newPlans: s.newPlans + 1 })),
  removePlan: () => set((s) => ({ newPlans: Math.max(0, s.newPlans - 1) })),
  seenPlans: () => set({ newPlans: 0 }),
  seenFeed: () => set({ freshFeed: false }),
}));
