// «Аналитика» → «Что требует внимания»: всё, что сломано или ждёт решения, одним списком из базы.
// Нет проблем — одна зелёная строка. Каждая строка говорит, что случилось, и сразу даёт кнопку «что делать».
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { rejectStaleDrafts } from '../api';
import { useRobotView } from '../useRobot';
import { useOverview } from './Overview';
import { useScheduleRow } from './Schedule';
import { Banner, Section } from './kit';
import { View } from 'react-native';

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

  const d = o.data;
  const items: React.ReactNode[] = [];
  if (robot.state === 'failed' && robot.error) {
    items.push(<Banner key="fail" tone="error" title={`Последний поиск не удался: ${robot.error.title}`} hint={robot.error.hint} action={{ label: 'Открыть поиск', onPress: () => go('events') }} />);
  }
  if (d) {
    if (d.events_draft > 0) items.push(<Banner key="q" tone="warn" title={`${d.events_draft} ${word(d.events_draft, 'событие ждёт', 'события ждут', 'событий ждут')} согласования`} action={{ label: 'Открыть очередь', onPress: () => go('events', 'queue') }} />);
    if (d.drafts_stale > 0) items.push(<Banner key="stale" tone="warn" title={`${d.drafts_stale} ${word(d.drafts_stale, 'черновик', 'черновика', 'черновиков')} с прошедшей датой`} hint="В очереди они не нужны: событие уже было." action={{ label: clean.isPending ? 'Убираю…' : 'Убрать старые', onPress: () => clean.mutate() }} />);
    if (d.events_no_place > 0) items.push(<Banner key="pl" tone="warn" title={`${d.events_no_place} на карте без точной точки`} hint="Откроются без маршрута. Поставь точку в «Ждут» или поправь адрес." action={{ label: 'Показать', onPress: () => go('events', 'gaps') }} />);
    if (d.events_no_price > 0) items.push(<Banner key="pr" tone="warn" title={`${d.events_no_price} без цены`} action={{ label: 'Показать', onPress: () => go('events', 'gaps') }} />);
    if (d.events_no_cover > 0) items.push(<Banner key="cv" tone="info" title={`${d.events_no_cover} без фото`} hint="В карточке будет постер раздела. Фото подтянется, если оно есть на странице афиши." />);
  }
  if (live && sched.data && sched.data.paused) items.push(<Banner key="sch" tone="info" title="Автопоиск выключен" hint="События ищутся только по кнопке." action={{ label: 'Настроить расписание', onPress: () => go('settings') }} />);
  if (o.isError) items.push(<Banner key="err" tone="error" title="Сводка не загрузилась" hint="Проверь связь. Если ошибка не уходит, в базе нет последней миграции (admin_overview): GitHub → Actions → Supabase backend." />);
  if (clean.isError) items.push(<Banner key="ce" tone="error" text={(clean.error as Error).message} />);
  if (done) items.push(<Banner key="done" tone="ok" text={done} />);

  return (
    <Section title="Что требует внимания" hint={live ? undefined : 'Пример. Настоящие данные откроются после входа сотрудника.'}>
      {items.length === 0 && !o.isLoading && <Banner tone="ok" title="Всё в порядке" text="Ошибок нет, очередь пуста." />}
      {o.isLoading && <Banner tone="info" text="Загружаю…" />}
      <View style={{ gap: 8 }}>{items}</View>
    </Section>
  );
}
