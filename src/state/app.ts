// Локальное состояние интерфейса (Zustand): счётчики на таб-баре.
import { create } from 'zustand';

interface AppState {
  /** Новых планов с последнего открытия профиля — бейдж на вкладке «Профиль». */
  newPlans: number;
  /** Есть новые карточки в «Для тебя» — оранжевая точка. */
  freshFeed: boolean;
  addPlan: () => void;
  removePlan: () => void;
  seenPlans: () => void;
  seenFeed: () => void;
}

export const useApp = create<AppState>((set) => ({
  newPlans: 0,
  freshFeed: true,
  addPlan: () => set((s) => ({ newPlans: s.newPlans + 1 })),
  removePlan: () => set((s) => ({ newPlans: Math.max(0, s.newPlans - 1) })),
  seenPlans: () => set({ newPlans: 0 }),
  seenFeed: () => set({ freshFeed: false }),
}));
