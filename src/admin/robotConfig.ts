// Параметры поиска событий: хранятся на устройстве сотрудника и уходят в запуск. «Источники»: sites — афиши сайтов кодом (бесплатно),
// ai — поиск ИИ по интернету (платно), all — оба.
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { deviceStorage } from '../state/storage';

export type SearchSources = 'sites' | 'ai' | 'all';
export interface RobotConfig { model: string; days: number; limit: number; topics: string[]; sources: SearchSources }

export const ALL_TOPICS = ['music', 'standup', 'cinema', 'art', 'food', 'sport'];
export const MODELS: { id: string; label: string }[] = [
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  { id: 'kimi-k2.6', label: 'Kimi K2.6' },
];

export const useRobotConfig = create<RobotConfig & { set: (p: Partial<RobotConfig>) => void }>()(persist(
  (set) => ({ model: 'gemini-2.5-flash', days: 7, limit: 40, topics: ALL_TOPICS, sources: 'sites' as SearchSources, set: (p) => set(p) }),
  {
    name: 'ryadom-robot-options-v2', storage: deviceStorage(),
    // Старый формат хранил числа строками — приводим.
    merge: (saved, cur) => { const s = (saved ?? {}) as Partial<RobotConfig>; return { ...cur, ...s, days: Number(s.days ?? cur.days) || 7, limit: Number(s.limit ?? cur.limit) || 40 }; },
  },
));

export const modelOk = (m: string) => /^(gemini|kimi|moonshot)-[a-zA-Z0-9.-]+$/.test(m);
