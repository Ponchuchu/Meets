// Что показывает нижняя панель кроме иконок: бейджи Планов и Чатов, аватарка Профиля. Заполняет приложение.
import { create } from 'zustand';

interface TabBadges {
  plans: number;
  chats: number;
  avatar: { url: string | null; letter: string };
  set: (p: Partial<Omit<TabBadges, 'set'>>) => void;
}

export const useTabBadges = create<TabBadges>((set) => ({
  plans: 0,
  chats: 0,
  avatar: { url: null, letter: '' },
  set: (p) => set(p),
}));
