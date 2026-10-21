// Демо-админка: решения модератора живут только в памяти (в настоящей — в базе). Перезагрузка страницы сбрасывает.
import { create } from 'zustand';
import { DEMO_SOURCES, DEMO_STATS, type QueueItem, type SourceItem } from './model';

export interface EvEdit { title?: string; cover?: string; gone?: boolean }
interface AdminDemo {
  evEdits: Record<string, EvEdit>;
  editEvent: (id: string, patch: EvEdit) => void;
  done: Record<string, 'publish' | 'reject'>;
  edits: Record<string, Partial<QueueItem>>;
  sources: SourceItem[];
  autoPublish: boolean;
  novelty: boolean;
  published: number;
  decide: (id: string, a: 'publish' | 'reject') => void;
  edit: (id: string, patch: Partial<QueueItem>) => void;
  setSource: (id: string, patch: Partial<SourceItem>) => void;
  addSource: (s: SourceItem) => void;
  removeSource: (id: string) => void;
  setAutoPublish: (v: boolean) => void;
  setNovelty: (v: boolean) => void;
}

export const useAdminDemo = create<AdminDemo>()((set) => ({
  done: {},
  evEdits: {},
  editEvent: (id, patch) => set((s) => ({ evEdits: { ...s.evEdits, [id]: { ...s.evEdits[id], ...patch } } })),
  edits: {},
  sources: DEMO_SOURCES,
  autoPublish: true,
  novelty: true,
  published: DEMO_STATS.onMap,
  decide: (id, a) => set((s) => ({ done: { ...s.done, [id]: a }, published: s.published + (a === 'publish' ? 1 : 0) })),
  edit: (id, patch) => set((s) => ({ edits: { ...s.edits, [id]: { ...s.edits[id], ...patch } } })),
  setSource: (id, patch) => set((s) => ({ sources: s.sources.map((x) => (x.id === id ? { ...x, ...patch } : x)) })),
  addSource: (x) => set((s) => ({ sources: [...s.sources, x] })),
  removeSource: (id) => set((s) => ({ sources: s.sources.filter((x) => x.id !== id) })),
  setAutoPublish: (v) => set({ autoPublish: v }),
  setNovelty: (v) => set({ novelty: v }),
}));
