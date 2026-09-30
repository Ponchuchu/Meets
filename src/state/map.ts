// Состояние карты: фильтры и выбранное событие. Общее для календаря, фильтра и поиска.
import { create } from 'zustand';
import { DEFAULT_FILTERS, type MapFilters } from '../map/filters';

interface MapState {
  filters: MapFilters;
  selectedId: string | null;
  /** Фокус на друге (MapFocus): карта сдвигается к нему, остальное бледнеет. */
  focusId: string | null;
  focusFriend: (id: string | null, invite?: boolean) => void;
  /** Открыта шторка «Позвать …» для друга в фокусе. */
  inviteOpen: boolean;
  setInviteOpen: (v: boolean) => void;
  setFilters: (patch: Partial<MapFilters>) => void;
  resetFilters: () => void;
  select: (id: string | null) => void;
}

export const useMapState = create<MapState>((set) => ({
  filters: DEFAULT_FILTERS,
  selectedId: null,
  focusId: null,
  focusFriend: (id, invite = false) => set({ focusId: id, inviteOpen: !!id && invite }),
  inviteOpen: false,
  setInviteOpen: (v) => set({ inviteOpen: v }),
  setFilters: (patch) => set((s) => ({ filters: { ...s.filters, ...patch } })),
  resetFilters: () => set((s) => ({ filters: { ...DEFAULT_FILTERS, from: s.filters.from, to: s.filters.to } })),
  select: (id) => set({ selectedId: id }),
}));
