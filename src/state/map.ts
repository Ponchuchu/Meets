// Состояние карты: фильтры и выбранное событие. Общее для календаря, фильтра и поиска.
import { create } from 'zustand';
import { DEFAULT_FILTERS, type MapFilters } from '../map/filters';

interface MapState {
  lens: 'normal' | 'traffic' | 'explore';
  setLens: (lens: 'normal' | 'traffic' | 'explore') => void;
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
  /** «Год в Алматы»: к какому большому событию подлететь на карте. */
  cityFocus: string | null;
  setCityFocus: (id: string | null) => void;
}

export const useMapState = create<MapState>((set) => ({
  lens: 'normal',
  setLens: (lens) => set({ lens }),
  filters: DEFAULT_FILTERS,
  selectedId: null,
  focusId: null,
  focusFriend: (id, invite = false) => set({ focusId: id, inviteOpen: !!id && invite }),
  inviteOpen: false,
  setInviteOpen: (v) => set({ inviteOpen: v }),
  setFilters: (patch) => set((s) => ({ filters: { ...s.filters, ...patch } })),
  resetFilters: () => set({ filters: DEFAULT_FILTERS }),
  select: (id) => set({ selectedId: id }),
  cityFocus: null,
  setCityFocus: (id) => set({ cityFocus: id }),
}));
