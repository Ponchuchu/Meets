// «Настройки» → расписание поиска: по умолчанию выключено. Запускает Supabase (robot-tick раз в 5 минут), время — по Алматы.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { supabase, withTimeout } from '../../data/client';
import { colors, fonts } from '../../theme';
import { Toggle } from '../../ui/v6/Settings';
import { Banner, Btn, Card, Chip, Section, Stepper } from './kit';

type Row = { repeat: 'daily' | 'weekly' | 'hours'; days: number[]; time: string; every_hours: number | null; paused: boolean; last_run_at: string | null };
const WD: [number, string][] = [[1, 'пн'], [2, 'вт'], [3, 'ср'], [4, 'чт'], [5, 'пт'], [6, 'сб'], [0, 'вс']];

/** Расписание поиска из базы (общий запрос для «Настроек» и «Внимания»). */
export function useScheduleRow(live: boolean) {
  return useQuery({
    queryKey: ['admin', 'schedule'], enabled: live,
    queryFn: async () => {
      const r = await withTimeout(supabase().from('robot_schedule').select('repeat,days,time,every_hours,paused,last_run_at').eq('task', 'search').maybeSingle());
      if (r.error) throw r.error;
      return r.data as Row | null;
    },
  });
}

export function Schedule({ live }: { live: boolean }) {
  const qc = useQueryClient();
  const q = useScheduleRow(live);
  // Строка = то, что в базе, поверх — то, что человек уже поменял на экране.
  const [edits, setEdits] = useState<Partial<Row>>({});
  const row: Row = { repeat: 'daily', days: [1, 2, 3, 4, 5, 6, 0], time: '09:00', every_hours: 6, paused: true, last_run_at: null, ...q.data, ...edits };
  const [note, setNote] = useState('');
  const save = useMutation({
    mutationFn: async (r: Row) => {
      if (!live) throw new Error('Расписание сохраняется после входа сотрудника');
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(r.time)) throw new Error('Время — в формате 09:30');
      if (r.repeat === 'hours' && !(Number.isInteger(r.every_hours) && r.every_hours! >= 1 && r.every_hours! <= 48)) throw new Error('Раз в сколько часов: от 1 до 48');
      const a = await withTimeout(supabase().from('robot_schedule').upsert({ task: 'search', repeat: r.repeat, days: r.days, time: r.time, every_hours: r.repeat === 'hours' ? r.every_hours : null, paused: r.paused }));
      if (a.error) throw a.error;
      const b = await withTimeout(supabase().from('app_flags').upsert({ key: 'robot_paused', value: r.paused, updated_at: new Date().toISOString() }));
      if (b.error) throw b.error;
    },
    onSuccess: (_d, r) => { setEdits({}); setNote(r.paused ? 'Расписание выключено' : 'Сохранено. Gemini запустится сам в назначенное время'); void qc.invalidateQueries({ queryKey: ['admin', 'schedule'] }); },
    onError: (e) => setNote(e instanceof Error ? e.message : 'Не удалось сохранить'),
  });
  const up = (p: Partial<Row>) => setEdits((e) => ({ ...e, ...p }));
  const on = !row.paused;

  return (
    <Section fold="closed" title="Расписание" hint="Без расписания поиск запускается только кнопкой. Включишь, и он пойдёт сам в назначенное время (по Алматы).">
      <Card>
        <View style={styles.line}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Искать по расписанию</Text>
            <Text style={styles.sub}>{on ? 'Включено' : 'Выключено'}</Text>
          </View>
          <Toggle on={on} onChange={(v) => { up({ paused: !v }); save.mutate({ ...row, paused: !v }); }} label="Искать по расписанию" />
        </View>
        <View style={styles.chips}>
          <Chip label="Каждый день" on={row.repeat !== 'hours'} onPress={() => up({ repeat: 'daily' })} />
          <Chip label="Каждые N часов" on={row.repeat === 'hours'} onPress={() => up({ repeat: 'hours' })} />
        </View>
        {row.repeat === 'hours' ? (
          <Stepper label="Раз в" unit="ч" value={row.every_hours ?? 6} min={1} max={48} onChange={(v) => up({ every_hours: v })} />
        ) : (
          <>
            <View style={styles.line}>
              <Text style={styles.title}>Во сколько (Алматы)</Text>
              <TextInput style={[styles.input, { width: 96, textAlign: 'center' }]} value={row.time} onChangeText={(v) => up({ time: v })} keyboardType="numbers-and-punctuation" maxLength={5} accessibilityLabel="Время запуска" placeholder="09:00" placeholderTextColor={colors.muted3} />
            </View>
            <View style={styles.chips}>
              {WD.map(([d, l]) => <Chip key={d} label={l} on={row.days.includes(d)} onPress={() => up({ days: row.days.includes(d) ? row.days.filter((x) => x !== d) : [...row.days, d] })} />)}
            </View>
          </>
        )}
        <Btn label={save.isPending ? 'Сохраняю…' : 'Сохранить расписание'} disabled={save.isPending} onPress={() => save.mutate(row)} />
        {!!row.last_run_at && <Text style={styles.sub}>Последний запуск по расписанию: {new Date(row.last_run_at).toLocaleString('ru-RU')}</Text>}
        {!!note && <Banner tone={/не|время|раз в/i.test(note) && !/Сохранено|выключено/.test(note) ? 'error' : 'ok'} text={note} />}
      </Card>
    </Section>
  );
}

const styles = StyleSheet.create({
  line: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontFamily: fonts.body600, fontSize: 15, color: colors.ink },
  sub: { fontFamily: fonts.body400, fontSize: 13, color: colors.muted },
  input: { minHeight: 44, paddingHorizontal: 12, borderRadius: 12, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, color: colors.ink, fontFamily: fonts.body600, fontSize: 16 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
