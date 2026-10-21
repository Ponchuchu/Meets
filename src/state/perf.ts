// Экономия заряда (21 октября, после проверки на телефонах): на слабом телефоне или в режиме энергосбережения
// приложение само становится легче — без живых рамок, без 3D, меньше точек на карте, геолокация реже.
// «Авто» — включается сама (энергосбережение телефона или памяти меньше 4 ГБ); можно включить всегда или выключить.
import * as Battery from 'expo-battery';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { deviceStorage } from './storage';

export type EcoMode = 'auto' | 'on' | 'off';
const weak = (Device.totalMemory ?? 8e9) < 4e9;

interface PerfState {
  mode: EcoMode;
  /** Телефон в режиме энергосбережения (не сохраняется). */
  powerSave: boolean;
  setMode: (m: EcoMode) => void;
}

export const usePerf = create<PerfState>()(persist(
  (set) => ({ mode: 'auto', powerSave: false, setMode: (mode) => set({ mode }) }),
  { name: 'ryadom-perf', storage: deviceStorage(), partialize: (s) => ({ mode: s.mode }) as PerfState },
));

export const ecoOf = (s: Pick<PerfState, 'mode' | 'powerSave'>, lowEnd = weak) => s.mode === 'on' || (s.mode === 'auto' && (s.powerSave || lowEnd));
/** Экономия сейчас включена (для компонентов). */
export const useEco = () => usePerf((s) => ecoOf(s));
/** То же вне React (геолокация, шаги). */
export const isEco = () => ecoOf(usePerf.getState());
/** Почему включена — для подписи в настройках. */
export const ecoReason = (s: Pick<PerfState, 'mode' | 'powerSave'>, lowEnd = weak) =>
  s.mode !== 'auto' ? null : s.powerSave ? 'включено энергосбережение телефона' : lowEnd ? 'телефону не хватает памяти' : null;

if (Platform.OS !== 'web') {
  void Battery.isLowPowerModeEnabledAsync().then((on) => usePerf.setState({ powerSave: on })).catch(() => undefined);
  Battery.addLowPowerModeListener(({ lowPowerMode }) => usePerf.setState({ powerSave: lowPowerMode }));
}
