import { Pedometer } from 'expo-sensors';
import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { deviceStorage } from '../state/storage';
import { config } from '../lib/config';
import { supabase } from '../data/client';
import { useAuth } from './auth';
import { dayIndex, dayStart } from '../lib/clock';
import { queryClient } from './query';

const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Almaty' });
export const STEP_GOALS = [{ steps: 3000, points: 10 }, { steps: 6000, points: 20 }, { steps: 10000, points: 30 }];
interface StepsState { owner: string | null; enabled: boolean; day: string; count: number; status: 'off' | 'ready' | 'denied' | 'unavailable'; setEnabled: (v: boolean) => void; record: (day: string, count: number) => void }
export const useSteps = create<StepsState>()(persist((set) => ({
  owner: null, enabled: false, day: '', count: 0, status: 'off',
  setEnabled: enabled => set({ enabled, status: enabled ? 'ready' : 'off' }),
  record: (day, count) => set(s => ({ day, count: Math.max(day === s.day ? s.count : 0, Math.max(0, Math.floor(count))) })),
}), { name: 'ryadom-steps', storage: deviceStorage(), partialize: ({ owner, enabled, day, count }) => ({ owner, enabled, day, count }) }));

export async function enableSteps(): Promise<boolean> {
  if (Platform.OS === 'web' || !(await Pedometer.isAvailableAsync())) { useSteps.setState({ status: 'unavailable' }); return false; }
  const p = await Pedometer.requestPermissionsAsync();
  if (!p.granted) { useSteps.setState({ status: 'denied' }); return false; }
  useSteps.getState().setEnabled(true);
  return true;
}

/** Один датчик на приложение. iOS читает день; Android — реальные шаги в активной сессии. */
export function useStepTracking() {
  const enabled = useSteps(s => s.enabled);
  const userId = useAuth(s => s.session?.user.id);
  useEffect(() => {
    if (!enabled || Platform.OS === 'web') return;
    if (useSteps.getState().owner !== (userId ?? null)) useSteps.setState({ owner: userId ?? null, day: '', count: 0 });
    let live = true;
    let generation = 0;
    let sub: ReturnType<typeof Pedometer.watchStepCount> | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const sync = async () => {
      if (!userId || useAuth.getState().session?.user.id !== userId || config.dataMode === 'demo') return;
      const s = useSteps.getState();
      if (s.day !== today() || !s.count) return;
      const { error } = await supabase().rpc('record_daily_steps', { step_day: s.day, step_count: s.count });
      if (!error) void queryClient.invalidateQueries({ queryKey: ['me', 'stats'] });
    };
    const stop = () => { generation++; sub?.remove(); sub = null; clearTimeout(timer); timer = undefined; void sync().catch(() => undefined); };
    const start = async () => {
      stop(); const run = generation;
      if (!(await Pedometer.getPermissionsAsync()).granted) { if (live) useSteps.setState({ status: 'denied' }); return; }
      if (!live || run !== generation) return;
      const day = today();
      const state = useSteps.getState();
      let base = state.day === day ? state.count : 0;
      if (Platform.OS === 'ios') {
        const midnight = dayStart(dayIndex(new Date()));
        const count = await Pedometer.getStepCountAsync(midnight, new Date()).catch(() => null);
        if (!live || run !== generation) return;
        if (count) base = Math.max(base, count.steps);
      }
      useSteps.getState().record(day, base);
      useSteps.setState({ status: 'ready' });
      let last = 0;
      sub = Pedometer.watchStepCount(({ steps }) => {
        if (!live || run !== generation) return;
        if (today() !== day) { void start().catch(() => undefined); return; }
        if (!Number.isFinite(steps) || steps < last) return;
        last = steps;
        useSteps.getState().record(day, base + steps);
        if (!timer) timer = setTimeout(() => { timer = undefined; void sync().catch(() => undefined); }, 60000);
      });
      void sync().catch(() => undefined);
    };
    if (AppState.currentState === 'active') void start().catch(() => useSteps.setState({ status: 'unavailable' }));
    const app = AppState.addEventListener('change', s => { if (s === 'active') void start().catch(() => undefined); else stop(); });
    return () => { live = false; app.remove(); stop(); };
  }, [enabled, userId]);
}
