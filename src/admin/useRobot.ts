// Запуск и состояние поиска событий: последний запуск, строки журнала, «Искать сейчас» / «Стоп» / проверка связи.
// Ошибки переводятся в понятные причины (errors.ts).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, withTimeout } from '../data/client';
import { explainError, type Explained } from './errors';
import { modelOk, useRobotConfig } from './robotConfig';

export interface Run { id: string; status: 'queued' | 'running' | 'done' | 'failed' | 'cancelled'; found: number; queued: number; started_at: string; finished_at: string | null; params: { sources?: string; model?: string } | null }
export interface LogLine { id: number; text: string; level: 'info' | 'ok' | 'warn' | 'error' }

export type RobotState = 'never' | 'running' | 'done' | 'failed' | 'cancelled';
export interface RobotView {
  state: RobotState;
  run?: Run;
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
    refetchInterval: (q) => ((q.state.data as Run[] | undefined)?.some((r) => r.status === 'queued' || r.status === 'running') ? 4000 : 20000),
    queryFn: async () => {
      const r = await withTimeout(supabase().from('robot_runs').select('id,status,found,queued,started_at,finished_at,params').order('started_at', { ascending: false }).limit(3));
      if (r.error) throw r.error;
      return r.data as Run[];
    },
  });
  const run = runs.data?.[0];
  const logs = useQuery({
    queryKey: ['admin', 'robot-log', run?.id], enabled: live && !!run, refetchInterval: run && (run.status === 'queued' || run.status === 'running') ? 4000 : false,
    queryFn: async () => {
      const r = await withTimeout(supabase().from('robot_log').select('id,text,level').eq('run_id', run!.id).order('at', { ascending: false }).limit(12));
      if (r.error) throw r.error;
      return r.data as LogLine[];
    },
  });
  const lines = logs.data ?? [];
  const state: RobotState = !run ? 'never' : run.status === 'queued' ? 'running' : run.status;
  const errText = lines.find((l) => l.level === 'error')?.text;
  return {
    state, run, logs: lines, line: lines[0]?.text,
    error: state === 'failed' ? explainError(errText) : undefined,
    loading: live && runs.isPending, fetchError: runs.isError,
  };
}

type Action = 'start' | 'stop' | 'check';
/** Команда роботу. Возвращает понятное сообщение для плашки. */
export function useRobotCommand(live: boolean, runId?: string) {
  const qc = useQueryClient();
  const cfg = useRobotConfig();
  return useMutation({
    mutationFn: async (action: Action): Promise<string> => {
      if (!live) throw new Error('Запуск откроется после входа сотрудника');
      if (action === 'start') {
        if (cfg.sources !== 'sites') {
          if (!modelOk(cfg.model)) throw new Error('Выбери модель ИИ в «Настройки → ИИ-поиск»');
          if (!cfg.topics.length) throw new Error('Выбери хотя бы одну тему в «Настройки → ИИ-поиск»');
        }
      }
      const body = { action, run_id: runId, model: cfg.model, days: cfg.days, limit: cfg.limit, topics: cfg.topics, sources: cfg.sources };
      const r = await withTimeout(supabase().functions.invoke('robot-run', { body }), 20000);
      if (r.error || r.data?.error) throw new Error(r.data?.error || r.error?.message || 'Не получилось');
      return action === 'check' ? 'Связь с GitHub работает' : action === 'stop' ? 'Останавливаю: текущий шаг дойдёт до конца' : 'Поиск запущен. Обычно 1–2 минуты';
    },
    onSettled: () => { void qc.invalidateQueries({ queryKey: ['admin', 'robot'] }); void qc.invalidateQueries({ queryKey: ['admin', 'overview'] }); },
  });
}
