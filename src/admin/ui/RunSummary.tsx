// «Ивенты» → итог поиска простыми словами: сколько новых, какого они качества (фото, точка, цена), что отсеяли и что делать дальше.
// Данные — robot_runs.stats (пишет воркер); для старых запусков без итогов вместо этого блока остаётся короткая плашка.
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../../theme';
import { describeRun, type RunStats } from '../runStats';
import { Banner } from './kit';

export function RunSummary({ stats, when }: { stats: RunStats; when: string }) {
  const [open, setOpen] = useState(false);
  const v = describeRun(stats);
  if (!v) return null;
  const hasMore = v.steps.length > 0;
  return (
    <View style={styles.box} accessibilityLabel="Итог поиска">
      <Text style={styles.when}>{when}</Text>
      <Text style={styles.head}>{v.headline}</Text>
      {!!v.sub && <Text style={styles.sub}>{v.sub}</Text>}

      {v.tiles.length > 1 && (
        <View style={styles.grid}>
          {v.tiles.slice(1).map((t) => (
            <View key={t.label} style={[styles.tile, t.warn && styles.tileWarn]}>
              <Text style={[styles.tileN, t.warn && { color: colors.accentText }]}>{t.n}</Text>
              <Text style={styles.tileL}>{t.label}</Text>
            </View>
          ))}
        </View>
      )}

      {v.telegram.length > 0 && (
        <View style={styles.lines}>
          {v.telegram.map((l) => <Text key={l} style={styles.line}>{l}</Text>)}
        </View>
      )}

      {v.tips.length > 0 && (
        <View style={{ gap: 8 }}>
          {v.tips.map((t) => <Banner key={t.title} tone={t.tone === 'error' ? 'error' : t.tone === 'warn' ? 'warn' : 'info'} title={t.title} hint={t.hint} />)}
        </View>
      )}

      {hasMore && (
        <>
          <Pressable onPress={() => setOpen(!open)} accessibilityRole="button" accessibilityState={{ expanded: open }} hitSlop={8} style={styles.link}>
            <Text style={styles.linkText}>{open ? 'Скрыть подробности' : 'Как это получилось'}</Text>
          </Pressable>
          {open && (
            <View style={styles.lines}>
              {v.steps.map((l, i) => (
                <View key={l} style={styles.stepRow}>
                  <Text style={styles.stepN}>{i + 1}</Text>
                  <Text style={styles.line}>{l}</Text>
                </View>
              ))}
            </View>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: 10 },
  when: { fontFamily: fonts.mono500, fontSize: 11.5, color: colors.muted3, letterSpacing: 0.3, textTransform: 'uppercase' },
  head: { fontFamily: fonts.display700, fontSize: 24, color: colors.ink, letterSpacing: -0.4 },
  sub: { fontFamily: fonts.body400, fontSize: 14, lineHeight: 20, color: colors.muted2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: { flexGrow: 1, flexBasis: '30%', minWidth: 96, borderRadius: 14, backgroundColor: colors.cardAlt, borderWidth: 1, borderColor: colors.line, paddingVertical: 10, paddingHorizontal: 12, gap: 1 },
  tileWarn: { borderColor: colors.accent },
  tileN: { fontFamily: fonts.display700, fontSize: 19, color: colors.ink },
  tileL: { fontFamily: fonts.body500, fontSize: 12, color: colors.muted },
  lines: { gap: 6 },
  line: { flex: 1, fontFamily: fonts.body500, fontSize: 13.5, lineHeight: 19, color: colors.ink },
  stepRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  stepN: { width: 20, height: 20, borderRadius: 10, textAlign: 'center', textAlignVertical: 'center', overflow: 'hidden', backgroundColor: colors.sand, fontFamily: fonts.mono600, fontSize: 11, lineHeight: 20, color: colors.ink },
  link: { minHeight: 40, justifyContent: 'center' },
  linkText: { fontFamily: fonts.body700, fontSize: 13.5, color: colors.ink, textDecorationLine: 'underline' },
});
