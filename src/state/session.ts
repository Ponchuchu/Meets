// Сессия и ответы регистрации. Хранится на устройстве (AsyncStorage / localStorage на web).
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { deviceStorage } from './storage';
import { buildStartTaste, type Budget, type Interest, type Taste, type TimeSlot, type WithWho } from '../reco/startTaste';

export type Provider = 'google' | 'apple' | 'phone';

export interface Draft {
  provider: Provider | null;
  phone: string;
  name: string;
  photo: string | null; // ключ демо-фото ('danil') или uri из галереи
  birthDate: string; // ДД.ММ.ГГГГ
  interests: Interest[];
  times: TimeSlot[];
  withWho: WithWho;
  budget: Budget;
  /** Правки профиля на устройстве (поверх того, что пришло с сервера). */
  about?: string;
  handle?: string;
  instagram?: string;
}

// Значения по умолчанию — как в макете: 3 интереса, будни вечером + выходные днём, с друзьями, до 5 000 ₸.
export const INITIAL_DRAFT: Draft = {
  provider: null, phone: '', name: '', photo: null, birthDate: '',
  interests: ['music', 'hike', 'games'],
  times: ['weekday', 'weekend'],
  withWho: 'friends',
  budget: 'mid',
};

interface SessionState {
  hydrated: boolean;
  signedIn: boolean;
  onboarded: boolean;
  locationAsked: boolean;
  /** Обучение пройдено (V6Tutorial) — дублируется на сервер в profile_settings.tutorial_done. */
  tutorialDone: boolean;
  draft: Draft;
  taste: Taste | null;
  signIn: (provider: Provider, prefill?: Partial<Draft>) => void;
  update: (patch: Partial<Draft>) => void;
  finish: () => void;
  setLocationAsked: () => void;
  setTutorialDone: (v: boolean) => void;
  signOut: () => void;
}

export const useSession = create<SessionState>()(
  persist(
    (set, get) => ({
      hydrated: false,
      signedIn: false,
      onboarded: false,
      locationAsked: false,
      tutorialDone: false,
      draft: INITIAL_DRAFT,
      taste: null,
      signIn: (provider, prefill) => set((s) => ({ signedIn: true, draft: { ...s.draft, provider, ...prefill } })),
      update: (patch) => set((s) => ({ draft: { ...s.draft, ...patch } })),
      finish: () => {
        const d = get().draft;
        set({ onboarded: true, taste: buildStartTaste({ interests: d.interests, times: d.times, withWho: d.withWho, budget: d.budget }) });
      },
      setLocationAsked: () => set({ locationAsked: true }),
      setTutorialDone: (v) => set({ tutorialDone: v }),
      signOut: () => set({ signedIn: false, onboarded: false, locationAsked: false, tutorialDone: false, draft: INITIAL_DRAFT, taste: null }),
    }),
    {
      name: 'ryadom-session',
      storage: deviceStorage(),
      partialize: ({ hydrated: _h, ...rest }) => rest,
      // Старые или неполные сохранения дополняем значениями по умолчанию (после обновлений приложения).
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<SessionState>;
        return { ...current, ...p, draft: { ...INITIAL_DRAFT, ...(p.draft ?? {}) } };
      },
      onRehydrateStorage: () => () => useSession.setState({ hydrated: true }),
    },
  ),
);
