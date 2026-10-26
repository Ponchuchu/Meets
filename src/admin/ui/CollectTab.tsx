// «Сбор» (26 октября, с нуля): одна большая кнопка «Собрать сейчас», что происходит прямо сейчас (журнал по строкам),
// итоги по источникам последнего сбора, история и расписание. Всё делает скрипт — без ИИ и без настроек моделей.
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CircleStop, Play } from 'lucide-react-native';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { supabase, withTimeout } from '../../data/client';
import { colors, fonts } from '../../theme';
import { ago } from '../errors';
import { useRobotView } from '../useRobot';
import { Banner, Card, Section } from './kit';
import { RunHistory } from './RunHistory';
import { Schedule } from './Schedule';
import { Publishing } from './SettingsTab';

const LEVEL: Record<string, string> = { error: colors.accentText, warn: '#9A6B12', ok: colors.ok, info: colors.muted };

export function CollectTab({ live, onReview }: { live: boolean; onReview: () => void }) {
  const qc = useQueryClient();
  const view = useRobotView(live);
  const running = view.state === 'running';
  const cmd = useMutation({
    mutationFn: async (action: 'start' | 'stop') => {
      if (!live) throw new Error('Сбор запускается после входа сотрудника');
      const r = await withTimeout(supabase().functions.invoke('robot-run', { body: { action, run_id: view.run?.id } }), 20000);
      if (r.error || r.data?.error) throw new Error(r.data?.error || r.error?.message || 'Не получилось');
    },
    onSettled: () => { void qc.invalidateQueries({ queryKey: ['admin'] }); },
  });
  const soc = (view.run?.stats as { social?: { handle: string; posts: number; events: number; dups: number; error?: string }[] } | null)?.social ?? [];
  const found = soc.reduce((n, x) => n + x.events, 0);
  return (
    <View style={{ gap: 16 }}>
      <Card>
        <Text style={styles.h}>{running ? 'Идёт сбор…' : view.run ? `Последний сбор ${ago(view.run.started_at)}` : 'Сбор ещё не запускали'}</Text>
        <Text style={styles.help}>Сайты-афиши, Telegram, страницы Instagram и Threads: новые посты → события с датами, местом и фото. Обычно 3–6 минут.</Text>
        {running && !!view.line && <View style={styles.now}><ActivityIndicator color={colors.accent} /><Text style={styles.nowText} numberOfLines={2}>{view.line}</Text></View>}
        <Pressable disabled={cmd.isPending} onPress={() => cmd.mutate(running ? 'stop' : 'start')} style={({ pressed }) => [styles.btn, running && styles.stop, pressed && { transform: [{ scale: 0.98 }] }]} accessibilityRole="button">
          {running ? <CircleStop size={20} color={colors.ink} strokeWidth={2} /> : <Play size={20} color={colors.paper} strokeWidth={2} />}
          <Text style={[styles.btnText, running && { color: colors.ink }]}>{cmd.isPending ? 'Отправляю…' : running ? 'Остановить' : 'Собрать сейчас'}</Text>
        </Pressable>
        {cmd.isError && <Banner tone="error" text={cmd.error instanceof Error ? cmd.error.message : 'Не получилось'} />}
        {view.state === 'failed' && view.error && <Banner tone="error" title={view.error.title} hint={view.error.hint} />}
        {view.state === 'done' && (view.run?.queued ?? 0) + found > 0 && (
          <Pressable onPress={onReview} accessibilityRole="button"><Text style={styles.link}>Новые события — во вкладке «Проверка» →</Text></Pressable>
        )}
      </Card>

      {soc.length > 0 && (
        <Section title="Что дал последний сбор" hint="Instagram и Threads, по страницам: постов прочитано → событий">
          <Card style={{ gap: 6 }}>
            {[...soc].sort((a, b) => b.events - a.events || b.posts - a.posts).slice(0, 25).map((x) => (
              <View key={x.handle} style={styles.srcRow}>
                <Text style={styles.srcName} numberOfLines={1}>@{x.handle}</Text>
                <Text style={[styles.srcVal, x.error && !x.posts ? { color: colors.accentText } : null]} numberOfLines={1}>
                  {x.error && !x.posts ? x.error : `${x.posts} → ${x.events}${x.dups ? ` (+${x.dups} дубл.)` : ''}`}
                </Text>
              </View>
            ))}
          </Card>
        </Section>
      )}

      {view.logs.length > 0 && (
        <Section title="Журнал" fold={running ? 'open' : 'closed'}>
          <Card style={{ gap: 6 }}>
            {view.logs.map((l) => <Text key={l.id} style={[styles.log, { color: LEVEL[l.level] ?? colors.muted }]}>{l.text}</Text>)}
          </Card>
        </Section>
      )}

      <RunHistory live={live} runs={view.runs} loading={view.loading} />
      <Schedule live={live} />
      <Publishing live={live} />
    </View>
  );
}

const styles = StyleSheet.create({
  h: { fontFamily: fonts.display700, fontSize: 18, color: colors.ink },
  help: { fontFamily: fonts.body400, fontSize: 13, lineHeight: 18, color: colors.muted },
  now: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  nowText: { flex: 1, fontFamily: fonts.body500, fontSize: 14, color: colors.ink },
  btn: { minHeight: 56, borderRadius: 16, backgroundColor: colors.ink, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  stop: { backgroundColor: colors.sand },
  btnText: { fontFamily: fonts.body700, fontSize: 16, color: colors.paper },
  link: { fontFamily: fonts.body700, fontSize: 14, color: colors.accentText, paddingVertical: 6 },
  srcRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 28 },
  srcName: { flex: 1, fontFamily: fonts.body600, fontSize: 14, color: colors.ink },
  srcVal: { fontFamily: fonts.mono600, fontSize: 12.5, color: colors.muted2, maxWidth: '60%' },
  log: { fontFamily: fonts.body400, fontSize: 12.5, lineHeight: 17 },
});
