// Шаги за день — как во ВКонтакте (FIX3 Ф7): считаются всегда, без кнопки «стоп».
// Android: итог дня из Health Connect (туда шаги пишет сам телефон, даже когда приложение закрыто);
// нет Health Connect — датчик шагов, пока приложение открыто. iPhone: итог дня из «Здоровья» через CoreMotion.
// Разрешение спрашиваем сами один раз; итог раз в минуту уходит на сервер (record_daily_steps — очки за 3, 6 и 10 тысяч).
import { isEco } from '../state/perf';
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

type HC = typeof import('react-native-health-connect');
let hc: HC | null = null;
try {
  // В web, тестах и старых сборках модуля нет — тогда датчик.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  if (Platform.OS === 'android') hc = require('react-native-health-connect') as HC;
} catch { hc = null; }

export const STEP_GOAL = 10000;
export const STEP_GOALS = [{ steps: 3000, points: 10 }, { steps: 6000, points: 20 }, { steps: 10000, points: 30 }];
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Almaty' });

/** Откуда шаги: health — Health Connect, sensor — датчик (пока открыто), ios — «Здоровье». */
export type StepSource = 'health' | 'sensor' | 'ios' | 'none';
export type StepStatus = 'starting' | 'ready' | 'denied' | 'install' | 'unavailable';
interface StepsState {
  owner: string | null; day: string; count: number; source: StepSource; status: StepStatus;
  record: (day: string, count: number) => void;
}
export const useSteps = create<StepsState>()(persist((set) => ({
  owner: null, day: '', count: 0, source: 'none', status: 'starting',
  record: (day, count) => set(s => ({ day, count: Math.max(day === s.day ? s.count : 0, Math.max(0, Math.floor(count))) })),
}), { name: 'ryadom-steps', version: 2, storage: deviceStorage(), partialize: ({ owner, day, count }) => ({ owner, day, count }) }));

export const stepsToday = (s: { day: string; count: number }) => (s.day === today() ? s.count : 0);

let asked = false;
/** Health Connect: true — читаем оттуда; false — использовать датчик. */
async function healthReady(ask: boolean): Promise<boolean> {
  if (!hc) return false;
  try {
    const sdk = await hc.getSdkStatus();
    if (sdk !== hc.SdkAvailabilityStatus.SDK_AVAILABLE) {
      if (sdk === hc.SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) useSteps.setState({ status: 'install' });
      return false;
    }
    if (!(await hc.initialize())) return false;
    const has = (list: { recordType: string; accessType: string }[]) => list.some(p => p.recordType === 'Steps' && p.accessType === 'read');
    if (has(await hc.getGrantedPermissions())) return true;
    if (!ask || asked) { useSteps.setState({ status: 'denied' }); return true; }
    asked = true;
    const granted = await hc.requestPermission([{ accessType: 'read', recordType: 'Steps' }]);
    if (!has(granted)) useSteps.setState({ status: 'denied' });
    return true;
  } catch { return false; }
}

async function healthToday(): Promise<number | null> {
  if (!hc) return null;
  const r = await hc.aggregateRecord({ recordType: 'Steps', timeRangeFilter: { operator: 'between', startTime: dayStart(dayIndex(new Date())).toISOString(), endTime: new Date().toISOString() } });
  return Number.isFinite(r.COUNT_TOTAL) ? r.COUNT_TOTAL : null;
}

/** «Разрешить» на карточке шагов: повторный системный запрос (Health Connect или датчик). */
export async function askSteps(): Promise<void> {
  asked = false;
  if (await healthReady(true)) { restart(); return; }
  const p = await Pedometer.requestPermissionsAsync().catch(() => null);
  useSteps.setState({ status: p?.granted ? 'ready' : 'denied' });
  restart();
}
export function openStepSettings() { try { hc?.openHealthConnectSettings(); } catch { /* нет Health Connect */ } }

let restart: () => void = () => undefined;

/** Один подсчёт на приложение (в корне вкладок). */
export function useStepTracking() {
  const userId = useAuth(s => s.session?.user.id);
  useEffect(() => {
    if (Platform.OS === 'web') { useSteps.setState({ status: 'unavailable', source: 'none' }); return; }
    if (useSteps.getState().owner !== (userId ?? null)) useSteps.setState({ owner: userId ?? null, day: '', count: 0 });
    let live = true;
    let generation = 0;
    let sub: ReturnType<typeof Pedometer.watchStepCount> | null = null;
    let poll: ReturnType<typeof setInterval> | undefined;
    let sent = '';
    let flush: ReturnType<typeof setTimeout> | undefined;
    const sync = async () => {
      if (!userId || useAuth.getState().session?.user.id !== userId || config.dataMode === 'demo') return;
      const s = useSteps.getState();
      const key = `${s.day}:${s.count}`;
      if (s.day !== today() || !s.count || key === sent) return;
      const { error } = await supabase().rpc('record_daily_steps', { step_day: s.day, step_count: Math.min(100000, s.count) });
      if (!error) { sent = key; void queryClient.invalidateQueries({ queryKey: ['me', 'stats'] }); void queryClient.invalidateQueries({ queryKey: ['me', 'steps'] }); }
    };
    const stop = () => { generation++; clearTimeout(flush); flush = undefined; sub?.remove(); sub = null; clearInterval(poll); poll = undefined; void sync().catch(() => undefined); };
    const start = async () => {
      stop(); const run = generation;
      const fresh = () => live && run === generation;
      if (await healthReady(true)) {
        if (!fresh()) return;
        const read = async () => {
          const n = await healthToday().catch(() => null);
          if (!fresh() || n == null) return;
          useSteps.getState().record(today(), n);
          useSteps.setState({ source: 'health', status: 'ready' });
          void sync().catch(() => undefined);
        };
        await read();
        poll = setInterval(() => void read(), isEco() ? 180000 : 60000);
        return;
      }
      // Датчик: разрешение «Физическая активность» спрашиваем сами.
      if (!(await Pedometer.isAvailableAsync().catch(() => false))) { if (fresh()) useSteps.setState({ status: 'unavailable', source: 'none' }); return; }
      let perm = await Pedometer.getPermissionsAsync();
      if (!perm.granted && perm.canAskAgain && !asked) { asked = true; perm = await Pedometer.requestPermissionsAsync(); }
      if (!fresh()) return;
      if (!perm.granted) { useSteps.setState({ status: 'denied', source: 'sensor' }); return; }
      const day = today();
      let base = useSteps.getState().day === day ? useSteps.getState().count : 0;
      if (Platform.OS === 'ios') {
        const count = await Pedometer.getStepCountAsync(dayStart(dayIndex(new Date())), new Date()).catch(() => null);
        if (!fresh()) return;
        if (count) base = Math.max(base, count.steps);
      }
      useSteps.getState().record(day, base);
      useSteps.setState({ source: Platform.OS === 'ios' ? 'ios' : 'sensor', status: 'ready' });
      let last = 0;
      sub = Pedometer.watchStepCount(({ steps }) => {
        if (!fresh()) return;
        if (today() !== day) { void start().catch(() => undefined); return; }
        if (!Number.isFinite(steps) || steps < last) return;
        last = steps;
        // Датчик присылает каждый шаг; экран и запись на телефон — не чаще раза в 3 с (каждый шаг перерисовывал профиль).
        if (!flush) flush = setTimeout(() => { flush = undefined; if (fresh()) useSteps.getState().record(day, base + last); }, isEco() ? 8000 : 3000);
      });
      poll = setInterval(() => void sync().catch(() => undefined), isEco() ? 180000 : 60000);
      void sync().catch(() => undefined);
    };
    restart = () => void start().catch(() => undefined);
    if (AppState.currentState === 'active') void start().catch(() => useSteps.setState({ status: 'unavailable' }));
    const app = AppState.addEventListener('change', s => { if (s === 'active') void start().catch(() => undefined); else stop(); });
    return () => { live = false; restart = () => undefined; app.remove(); stop(); };
  }, [userId]);
}

/** Шаги по дням за 4 недели с сервера (для недели на карточке и наград). */
export async function stepHistory(): Promise<{ day: string; steps: number }[]> {
  const since = new Date(Date.now() - 28 * 86400e3).toLocaleDateString('en-CA', { timeZone: 'Asia/Almaty' });
  const { data, error } = await supabase().from('daily_steps').select('day,steps').gte('day', since).order('day');
  if (error) throw error;
  return (data ?? []) as { day: string; steps: number }[];
}
