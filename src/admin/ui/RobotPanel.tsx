// «Ивенты» → поиск Gemini: параметры, «Искать сейчас», статус и понятная причина, если запуск не удался.
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { supabase, withTimeout } from '../../data/client';
import { colors, fonts } from '../../theme';
import { useRobotConfig } from '../robotConfig';
import { Banner, Btn, Card, Chip, Section } from './kit';

const TOPICS = ['music', 'standup', 'cinema', 'art', 'food', 'sport'];
const TITLE: Record<string, string> = { cinema: 'Кино и театр', music: 'Музыка', standup: 'Стендап', art: 'Выставки', sport: 'Спорт', games: 'Игры', food: 'Еда' };
const STATUS: Record<string, string> = { queued: 'В очереди', running: 'Ищет события…', done: 'Готово', failed: 'Не получилось', cancelled: 'Остановлен' };
type Run = { id: string; status: string; found: number; queued: number };
type Log = { id: number; text: string; level: string };

export function RobotPanel({ live }: { live: boolean }) {
  const qc = useQueryClient();
  const { model, days, limit, topics, set } = useRobotConfig();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const q = useQuery({
    queryKey: ['admin', 'robot'], enabled: live, refetchInterval: 5000,
    queryFn: async () => {
      const r = await withTimeout(supabase().from('robot_runs').select('*').order('started_at', { ascending: false }).limit(5));
      if (r.error) throw r.error;
      return r.data as Run[];
    },
  });
  const current = q.data?.[0];
  const running = !!q.data?.some((r) => ['queued', 'running'].includes(r.status));
  const logs = useQuery({
    queryKey: ['admin', 'robot-log', current?.id], enabled: live && !!current, refetchInterval: 5000,
    queryFn: async () => {
      const r = await withTimeout(supabase().from('robot_log').select('id,text,level').eq('run_id', current!.id).order('at', { ascending: false }).limit(10));
      if (r.error) throw r.error;
      return r.data as Log[];
    },
  });
  const failText = current?.status === 'failed' ? logs.data?.find((l) => l.level === 'error')?.text : undefined;

  const invoke = async (action: 'start' | 'stop' | 'check') => {
    if (busy) return;
    if (!live) { setNote('Запуск доступен после входа сотрудника'); return; }
    if (action === 'start' && (!topics.length || !/^gemini-[a-zA-Z0-9.-]+$/.test(model) || !Number.isInteger(Number(days)) || Number(days) < 1 || Number(days) > 30 || !Number.isInteger(Number(limit)) || Number(limit) < 1 || Number(limit) > 100)) {
      setNote('Выбери темы, модель Gemini, период 1–30 дней и лимит 1–100');
      return;
    }
    setBusy(true); setNote('');
    try {
      const r = await withTimeout(supabase().functions.invoke('robot-run', { body: { action, run_id: current?.id, model, days: Number(days), limit: Number(limit), topics } }), 15000);
      if (r.error || r.data?.error) throw new Error(r.data?.error || r.error?.message);
      setNote(action === 'check' ? 'Связь с GitHub работает' : action === 'stop' ? 'Остановится после текущего шага' : 'Поиск запущен — обычно 1–2 минуты');
      await qc.invalidateQueries({ queryKey: ['admin', 'robot'] });
    } catch (e) {
      setNote(e instanceof Error ? e.message : 'Не удалось запустить');
    } finally { setBusy(false); }
  };

  return (
    <Section title="Поиск Gemini" hint="Найденные события сначала попадают на согласование — на карту сами не идут.">
      <Card>
        {current && (
          <Banner tone={current.status === 'failed' ? 'error' : current.status === 'done' ? 'ok' : 'info'}
            text={failText ?? `${STATUS[current.status] ?? current.status} · найдено ${current.found}${current.queued ? ` · в очереди ${current.queued}` : ''}`} />
        )}
        <Text style={styles.label}>Модель</Text>
        <TextInput style={styles.input} accessibilityLabel="Модель Gemini" value={model} onChangeText={(v) => set({ model: v })} autoCapitalize="none" autoCorrect={false} placeholder="gemini-2.5-flash" placeholderTextColor={colors.muted3} />
        <View style={styles.two}>
          <View style={{ flex: 1, gap: 6 }}><Text style={styles.label}>Дней вперёд</Text><TextInput style={styles.input} value={days} onChangeText={(v) => set({ days: v })} keyboardType="number-pad" accessibilityLabel="Дней вперёд" /></View>
          <View style={{ flex: 1, gap: 6 }}><Text style={styles.label}>Лимит событий</Text><TextInput style={styles.input} value={limit} onChangeText={(v) => set({ limit: v })} keyboardType="number-pad" accessibilityLabel="Лимит событий" /></View>
        </View>
        <Text style={styles.label}>Что искать</Text>
        <View style={styles.chips}>
          {TOPICS.map((t) => <Chip key={t} label={TITLE[t]} on={topics.includes(t)} onPress={() => set({ topics: topics.includes(t) ? topics.filter((x) => x !== t) : [...topics, t] })} />)}
        </View>
        <View style={styles.two}>
          <Btn flex label={busy ? 'Подожди…' : running ? 'Идёт поиск…' : 'Искать сейчас'} disabled={busy || running} onPress={() => void invoke('start')} />
          {running && <Btn label="Стоп" kind="ghost" onPress={() => void invoke('stop')} />}
        </View>
        <Btn label="Проверить подключение" kind="ghost" onPress={() => void invoke('check')} />
        {!!note && <Banner tone="info" text={note} />}
        {(q.isError || logs.isError) && <Banner tone="error" text="Журнал не загрузился. Нажми «Проверить подключение»." />}
        {logs.data && logs.data.length > 0 && (
          <View style={{ gap: 4 }}>
            <Text style={styles.label}>Журнал</Text>
            {logs.data.map((l) => <Text key={l.id} style={[styles.log, l.level === 'error' && { color: colors.accentText }]}>{l.text}</Text>)}
          </View>
        )}
      </Card>
    </Section>
  );
}

const styles = StyleSheet.create({
  label: { fontFamily: fonts.body600, fontSize: 13, color: colors.muted2 },
  input: { minHeight: 48, paddingHorizontal: 14, borderRadius: 14, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, color: colors.ink, fontFamily: fonts.body500, fontSize: 15 },
  two: { flexDirection: 'row', gap: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  log: { fontFamily: fonts.body400, fontSize: 12.5, lineHeight: 18, color: colors.muted },
});
