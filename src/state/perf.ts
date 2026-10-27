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

/** Частота экрана, Гц: 60 / 90 / 120. Измеряется по кадрам один раз за запуск (на сильных телефонах карта рисуется под неё). */
export const useRefreshRate = create<{ hz: number }>(() => ({ hz: 60 }));
const HZ_STEPS = [60, 90, 120] as const;
if (Platform.OS !== 'web') {
  setTimeout(() => {
    const stamps: number[] = [];
    const tick = (t: number) => {
      stamps.push(t);
      if (stamps.length < 40) { requestAnimationFrame(tick); return; }
      // Берём лучшие кадры (без пропусков): медиана нижней половины интервалов.
      const gaps = stamps.slice(1).map((v, i) => v - stamps[i]).sort((a, b) => a - b).slice(0, 20);
      const ms = gaps[Math.floor(gaps.length / 2)];
      const hz = ms > 0 ? 1000 / ms : 60;
      useRefreshRate.setState({ hz: HZ_STEPS.reduce((best, h) => (Math.abs(h - hz) < Math.abs(best - hz) ? h : best), 60 as number) });
    };
    requestAnimationFrame(tick);
  }, 4000);
}
