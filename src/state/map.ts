// Состояние карты: фильтры и выбранное событие. Общее для календаря, фильтра и поиска.
import { create } from 'zustand';
import { DEFAULT_FILTERS, type MapFilters } from '../map/filters';

interface MapState {
  filters: MapFilters;
  selectedId: string | null;
  setFilters: (patch: Partial<MapFilters>) => void;
  resetFilters: () => void;
  select: (id: string | null) => void;
}

export const useMapState = create<MapState>((set) => ({
  filters: DEFAULT_FILTERS,
  selectedId: null,
  setFilters: (patch) => set((s) => ({ filters: { ...s.filters, ...patch } })),
  resetFilters: () => set((s) => ({ filters: { ...DEFAULT_FILTERS, from: s.filters.from, to: s.filters.to } })),
  select: (id) => set({ selectedId: id }),
}));
