import { create } from 'zustand';

const native = new Map<string, () => void>();
const preparations = new Set<() => void>();
const safely = (stop?: () => void) => { try { stop?.(); } catch { /* Проигрыватель уже закрыт. */ } };
const cancelPreparations = () => { preparations.forEach(safely); preparations.clear(); };
export function registerPlayback(id: string, stop: () => void) { native.set(id, stop); return () => { if (native.get(id) === stop) native.delete(id); }; }
export function registerPreparation(stop: () => void) { preparations.add(stop); return () => { preparations.delete(stop); }; }

// Остановка вызывает нативный pause сразу, даже если предыдущий экран заморожен навигатором.
export const usePlayback = create<{
  active: string | null; recording: boolean; video: boolean; screen: boolean;
  play: (id: string | null, video?: boolean) => void; record: (on: boolean) => void; focus: (on: boolean) => void;
}>((set, get) => ({
  active: null, recording: false, video: false, screen: false,
  play: (active, video = false) => {
    if (get().recording && active) return;
    if (get().active !== active) safely(native.get(get().active ?? ''));
    if (video && active) cancelPreparations();
    set({ active, video: !!active && video });
  },
  record: recording => {
    if (recording) { safely(native.get(get().active ?? '')); cancelPreparations(); }
    set({ recording, ...(recording ? { active: null, video: false } : {}) });
  },
  focus: screen => {
    if (!screen) { safely(native.get(get().active ?? '')); cancelPreparations(); }
    set({ screen, ...(!screen ? { active: null, video: false } : {}) });
  },
}));
