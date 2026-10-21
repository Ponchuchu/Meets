// Запуск и состояние поиска событий: последний запуск, строки журнала, «Искать сейчас» / «Стоп» / проверка связи.
// Ошибки переводятся в понятные причины (errors.ts).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, withTimeout } from '../data/client';
import { explainError, type Explained } from './errors';
import { useRobotConfig } from './robotConfig';
import { searchProblem } from './rules';
import { keyStatuses, type KeyStatus, type RunStats } from './runStats';
import { loadSources } from './api';
import type { SourceItem } from './model';

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

type Action = 'start' | 'stop' | 'check';
/** Команда роботу. Возвращает понятное сообщение для плашки. */
export function useRobotCommand(live: boolean, runId?: string) {
  const qc = useQueryClient();
  const cfg = useRobotConfig();
  return useMutation({
    mutationFn: async (action: Action): Promise<string> => {
      if (!live) throw new Error('Запуск откроется после входа сотрудника');
      if (action === 'start') {
        const problem = searchProblem(cfg);
        if (problem) throw new Error(problem);
      }
      const body = { action, run_id: runId, model: cfg.sources === 'sites' ? 'gemini-2.5-flash' : cfg.model, days: cfg.days, limit: cfg.limit, topics: cfg.sources === 'sites' ? [] : cfg.topics, sources: cfg.sources, find_images: cfg.findImages };
      const r = await withTimeout(supabase().functions.invoke('robot-run', { body }), 20000);
      if (r.error || r.data?.error) throw new Error(r.data?.error || r.error?.message || 'Не получилось');
      return action === 'check' ? 'Связь с GitHub работает' : action === 'stop' ? 'Останавливаю: текущий шаг дойдёт до конца' : 'Поиск запущен. Обычно 1–2 минуты';
    },
    onSettled: () => { void qc.invalidateQueries({ queryKey: ['admin', 'robot'] }); void qc.invalidateQueries({ queryKey: ['admin', 'overview'] }); },
  });
}

/** Ключи ИИ из журнала последних запусков (воркер пишет «Ключ · Kimi · есть, баланс 12.50»). Самих ключей здесь нет. */
export function useKeyStatuses(live: boolean): { keys: KeyStatus[]; loading: boolean } {
  const q = useQuery({
    queryKey: ['admin', 'keys'], enabled: live, staleTime: 30_000,
    queryFn: async () => {
      const r = await withTimeout(supabase().from('robot_log').select('text,at').like('text', 'Ключ · %').order('at', { ascending: false }).limit(12));
      if (r.error) throw r.error;
      return keyStatuses(r.data as { text: string }[]);
    },
  });
  return { keys: q.data ?? [], loading: live && q.isPending };
}

/** Включённые источники (переключатели «собирать»): что реально будет прочитано при поиске. Без входа — оба сайта, как в макете. */
export function useEnabledSources(live: boolean): { list: SourceItem[]; loading: boolean } {
  const q = useQuery({ queryKey: ['admin', 'sources'], queryFn: loadSources, enabled: live });
  return { list: live ? (q.data ?? []).filter((s) => s.enabled) : [], loading: live && q.isPending };
}
