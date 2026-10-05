// Что показывает нижняя панель кроме иконок: бейджи Планов и Чатов, аватарка Профиля. Заполняет приложение.
import { create } from 'zustand';

interface TabBadges {
  plans: number;
  chats: number;
  avatar: { url: string | null; letter: string };
  /** Счётчик «прилётов» в «Планы»: каждое +1 — иконка подпрыгивает, искры, бейдж +1 (V6PlansFly). */
  land: number;
  landPlans: () => void;
  set: (p: Partial<Omit<TabBadges, 'set'>>) => void;
}

export const useTabBadges = create<TabBadges>((set) => ({
  plans: 0,
  chats: 0,
  avatar: { url: null, letter: '' },
  land: 0,
  landPlans: () => set((s) => ({ land: s.land + 1, plans: s.plans + 1 })),
  set: (p) => set(p),
}));
