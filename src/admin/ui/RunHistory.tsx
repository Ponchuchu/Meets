// «Поиск» → история: последние запуски одной строкой каждый — когда, чем искали, сколько нашли. Без анимаций.
import { History } from 'lucide-react-native';
import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../../theme';
import { ago } from '../errors';
import type { Run } from '../useRobot';
import { Card, Empty, Section } from './kit';

const STATUS: Record<Run['status'], [string, string]> = {
  queued: ['в очереди', colors.muted3], running: ['идёт', colors.accent], done: ['готово', '#4E7A52'], failed: ['ошибка', colors.accent], cancelled: ['остановлен', colors.muted3],
};
const HOW: Record<string, string> = { sites: 'Скрипт', ai: 'ИИ', all: 'Скрипт + ИИ' };

const Line = memo(function Line({ r, last }: { r: Run; last: boolean }) {
  const [label, color] = STATUS[r.status];
  return (
    <View style={[styles.row, !last && styles.sep]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <View style={{ flex: 1, gap: 1 }}>
        <Text style={styles.t}>{ago(r.started_at)} · {HOW[r.params?.sources ?? ''] ?? 'Поиск'}</Text>
        <Text style={styles.s}>{label}{r.status === 'done' || r.found ? ` · найдено ${r.found}, в очередь ${r.queued}` : ''}</Text>
      </View>
    </View>
  );
});

export function RunHistory({ live, runs, loading }: { live: boolean; runs: Run[]; loading: boolean }) {
  return (
    <Section title="История" right={runs.length ? <Text style={styles.count}>{runs.length}</Text> : undefined}>
      {!live ? <Empty icon={History} title="История появится после входа" text="Здесь будут последние запуски поиска: когда, чем искали и сколько нашли." />
        : loading ? <Empty loading title="Загружаю историю…" />
          : !runs.length ? <Empty icon={History} title="Поиск ещё не запускали" text="Нажми «Найти» выше — запуск появится здесь." />
            : <Card style={{ paddingVertical: 4, gap: 0 }}>{runs.map((r, i) => <Line key={r.id} r={r} last={i === runs.length - 1} />)}</Card>}
    </Section>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, paddingVertical: 8 },
  sep: { borderBottomWidth: 1, borderBottomColor: colors.line },
  dot: { width: 9, height: 9, borderRadius: 5 },
  t: { fontFamily: fonts.body700, fontSize: 14.5, color: colors.ink },
  s: { fontFamily: fonts.body400, fontSize: 12.5, color: colors.muted },
  count: { fontFamily: fonts.mono600, fontSize: 12, color: colors.muted2 },
});
