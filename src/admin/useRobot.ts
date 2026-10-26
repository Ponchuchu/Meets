// Запуск и состояние поиска событий: последний запуск, строки журнала, «Искать сейчас» / «Стоп» / проверка связи.
// Ошибки переводятся в понятные причины (errors.ts).
import { useQuery } from '@tanstack/react-query';
import { supabase, withTimeout } from '../data/client';
import { explainError, type Explained } from './errors';
import type { RunStats } from './runStats';

export interface Run { id: string; status: 'queued' | 'running' | 'done' | 'failed' | 'cancelled'; found: number; queued: number; started_at: string; finished_at: string | null; params: { sources?: string; model?: string } | null; stats: RunStats | null }
export interface LogLine { id: number; text: string; level: 'info' | 'ok' | 'warn' | 'error' }

export type RobotState = 'never' | 'running' | 'done' | 'failed' | 'cancelled';
export interface RobotView {
  state: RobotState;
  run?: Run;
  /** Последние запуски (новые сверху) — для истории во вкладке «Поиск». */
  runs: Run[];
  /** Последняя строка журнала — что происходит сейчас. */
  line?: string;
  error?: Explained;
  logs: LogLine[];
  loading: boolean;
  fetchError: boolean;
}

export function useRobotView(live: boolean): RobotView {
  const runs = useQuery({
    queryKey: ['admin', 'robot'], enabled: live,
    // Пока поиск идёт — каждые 4 с (видно прогресс), в покое — раз в минуту.
    refetchInterval: (q) => ((q.state.data as Run[] | undefined)?.some((r) => r.status === 'queued' || r.status === 'running') ? 4000 : 60_000),
    queryFn: async () => {
      const r = await withTimeout(supabase().from('robot_runs').select('id,status,found,queued,started_at,finished_at,params,stats').order('started_at', { ascending: false }).limit(8));
      if (r.error) throw r.error;
      return r.data as Run[];
    },
  });
  const run = runs.data?.[0];
  const logs = useQuery({
    queryKey: ['admin', 'robot-log', run?.id], enabled: live && !!run, refetchInterval: run && (run.status === 'queued' || run.status === 'running') ? 4000 : false,
    queryFn: async () => {
      const r = await withTimeout(supabase().from('robot_log').select('id,text,level').eq('run_id', run!.id).order('at', { ascending: false }).limit(20));
      if (r.error) throw r.error;
      return r.data as LogLine[];
    },
  });
  const lines = logs.data ?? [];
  const state: RobotState = !run ? 'never' : run.status === 'queued' ? 'running' : run.status;
  const errText = lines.find((l) => l.level === 'error')?.text;
  return {
    state, run, runs: runs.data ?? [], logs: lines, line: lines[0]?.text,
    error: state === 'failed' ? explainError(errText) : undefined,
    loading: live && runs.isPending, fetchError: runs.isError,
  };
}
