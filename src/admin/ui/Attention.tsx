// «Аналитика» → «Что требует внимания»: всё, что сломано или ждёт решения, одним списком из базы.
// Нет проблем — одна зелёная строка. Каждая строка говорит, что случилось, и сразу даёт кнопку «что делать».
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, withTimeout } from '../../data/client';
import { colors, fonts } from '../../theme';
import { ago } from '../errors';
import { useState } from 'react';
import { rejectStaleDrafts } from '../api';
import { useRobotView } from '../useRobot';
import { useOverview } from './Overview';
import { useScheduleRow } from './Schedule';
import { Banner, Card, Section, TodoRow } from './kit';
import { Text, View } from 'react-native';

export type Goto = (to: 'events' | 'analytics' | 'settings', sub?: 'queue' | 'map' | 'gaps') => void;

const word = (n: number, a: string, b: string, c: string) => { const m = n % 10, k = n % 100; return m === 1 && k !== 11 ? a : m >= 2 && m <= 4 && (k < 10 || k >= 20) ? b : c; };

export function Attention({ live, go }: { live: boolean; go: Goto }) {
  const qc = useQueryClient();
  const o = useOverview(live);
  const robot = useRobotView(live);
  const sched = useScheduleRow(live);
  const [done, setDone] = useState('');
  const clean = useMutation({
    mutationFn: async () => { if (!live) throw new Error('Откроется после входа сотрудника'); return rejectStaleDrafts(); },
    onSuccess: (n) => { setDone(`Убрали черновиков: ${n}`); void qc.invalidateQueries({ queryKey: ['admin'] }); },
  });

  const crashes = useQuery({
    queryKey: ['admin', 'client_errors'], enabled: live, refetchInterval: 120_000,
    queryFn: async () => {
      const since = new Date(Date.now() - 7 * 86400e3).toISOString();
      const r = await withTimeout(supabase().from('client_errors').select('at,fatal,screen,message,app_version').gte('at', since).order('at', { ascending: false }).limit(20));
      if (r.error) throw r.error;
      return r.data as { at: string; fatal: boolean; screen: string | null; message: string; app_version: string | null }[];
    },
  });
  const [showCrashes, setShowCrashes] = useState(false);

  const d = o.data;
  type Row = { key: string; tone: 'error' | 'warn' | 'info' | 'ok'; title: string; sub?: string; onPress?: () => void };
  const rows: Row[] = [];
  if (robot.state === 'failed' && robot.error) rows.push({ key: 'fail', tone: 'error', title: robot.error.title, sub: robot.error.hint, onPress: () => go('events') });
  const cr = crashes.data ?? [];
  if (cr.length) rows.push({ key: 'crash', tone: cr.some(c => c.fatal) ? 'error' : 'warn', title: `Ошибки в приложении за неделю: ${cr.length}`, sub: `Последняя: ${cr[0].screen ?? 'экран не известен'} · ${ago(cr[0].at)}`, onPress: () => setShowCrashes(v => !v) });
  if (d) {
    if (d.events_draft > 0) rows.push({ key: 'q', tone: 'warn', title: `${d.events_draft} ${word(d.events_draft, 'событие ждёт', 'события ждут', 'событий ждут')} проверки`, sub: 'Открыть «Новые»', onPress: () => go('events', 'queue') });
    if (d.drafts_stale > 0) rows.push({ key: 'stale', tone: 'warn', title: `${d.drafts_stale} ${word(d.drafts_stale, 'черновик', 'черновика', 'черновиков')} с прошедшей датой`, sub: clean.isPending ? 'Убираю…' : 'Нажми — уберу из очереди', onPress: () => clean.mutate() });
    if (d.events_no_place > 0) rows.push({ key: 'pl', tone: 'warn', title: `${d.events_no_place} без точной точки на карте`, sub: 'Без неё не строится маршрут', onPress: () => go('events', 'gaps') });
    if (d.events_no_price > 0) rows.push({ key: 'pr', tone: 'info', title: `${d.events_no_price} без цены`, onPress: () => go('events', 'gaps') });
    if (d.events_no_cover > 0) rows.push({ key: 'cv', tone: 'info', title: `${d.events_no_cover} без фото`, sub: 'Покажем постер раздела' });
  }
  if (live && sched.data && sched.data.paused) rows.push({ key: 'sch', tone: 'info', title: 'Автопоиск выключен', sub: 'События ищутся только по кнопке', onPress: () => go('settings') });
  if (o.isError) rows.push({ key: 'err', tone: 'error', title: 'Сводка не загрузилась', sub: 'Потяни экран вниз, чтобы повторить', onPress: () => void o.refetch() });

  return (
    <Section title="Что требует внимания" hint={live ? undefined : 'Пример. Настоящие данные откроются после входа сотрудника.'}>
      <Card style={{ paddingVertical: 4, gap: 0 }}>
        {o.isLoading && <TodoRow tone="info" title="Загружаю…" last />}
        {!o.isLoading && rows.length === 0 && <TodoRow tone="ok" title="Всё в порядке" sub="Ошибок нет, очередь пуста" last />}
        {rows.map((r, i) => <TodoRow key={r.key} tone={r.tone} title={r.title} sub={r.sub} onPress={r.onPress} last={i === rows.length - 1} />)}
      </Card>
      {showCrashes && cr.length > 0 && (
        <Card style={{ gap: 10 }}>
          {cr.map((c, i) => (
            <View key={i} style={{ gap: 2 }}>
              <Text style={{ fontFamily: fonts.mono600, fontSize: 10.5, color: colors.muted2 }}>{ago(c.at).toUpperCase()} · {c.fatal ? 'ВЫЛЕТ' : 'ОШИБКА'} · {c.screen ?? '—'}{c.app_version ? ` · v${c.app_version}` : ''}</Text>
              <Text style={{ fontFamily: fonts.body500, fontSize: 13, color: colors.ink }} numberOfLines={3}>{c.message}</Text>
            </View>
          ))}
        </Card>
      )}
      {clean.isError && <Banner tone="error" text={(clean.error as Error).message} />}
      {!!done && <Banner tone="ok" text={done} />}
    </Section>
  );
}
