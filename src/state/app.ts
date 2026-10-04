// Локальное состояние интерфейса (Zustand): счётчики на таб-баре.
import { useEffect } from 'react';
import { BackHandler } from 'react-native';
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
  /** Сколько шторок/полноэкранных карточек открыто — таб-бар в это время уезжает вниз. */
  covers: number;
  cover: () => void;
  uncover: () => void;
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
  covers: 0,
  cover: () => set((s) => ({ covers: s.covers + 1 })),
  uncover: () => set((s) => ({ covers: Math.max(0, s.covers - 1) })),
}));

/** Пока компонент смонтирован и on=true — таб-бар спрятан (шторка, раскрытая карточка). */
export function useCoverTabBar(on = true) {
  useEffect(() => {
    if (!on) return;
    useApp.getState().cover();
    return () => useApp.getState().uncover();
  }, [on]);
}

/** Кнопка «Назад» на Android закрывает открытое (шторку, событие, поиск), а не всё приложение. */
export function useBackClose(onClose?: () => void, on = true) {
  useEffect(() => {
    if (!on || !onClose) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { onClose(); return true; });
    return () => sub.remove();
  }, [onClose, on]);
}
