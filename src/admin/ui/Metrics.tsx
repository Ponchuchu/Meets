// Метрики рекомендаций (RECOMMENDATIONS.md, раздел 6): доля «пойду», дошли, возвраты, отмены.
// Команде — все люди за 30 дней, в демо — это устройство.
import { useQuery } from '@tanstack/react-query';
import { Pressable,StyleSheet, Text, View } from 'react-native';
import { loadAnalytics, useAnalytics } from '../../analytics';
import { computeMetrics, pct } from '../../analytics/metrics';
import { now as clockNow } from '../../lib/clock';
import { colors, fonts } from '../../theme';

export function Metrics({ live }: { live: boolean }) {
  const local = useAnalytics((s) => s.events);
  const q = useQuery({ queryKey: ['admin', 'analytics'], queryFn: () => loadAnalytics(30), enabled: live });
  const m = computeMetrics(live ? (q.data ?? []) : local, clockNow());
  const rows: [string, string, string, boolean][] = [
    ['Доля «пойду» от показанных', pct(m.goRate), 'норма 20–35%', m.goRate == null || (m.goRate >= 0.2 && m.goRate <= 0.35)],
    ['Дошли из нажавших «пойду»', pct(m.arrivedRate), 'главная метрика', true],
    ['Вернулись в «Для тебя»', `${pct(m.d1)} / ${pct(m.d7)}`, 'D1 / D7', true],
    ['Отмены и «вернуть»', pct(m.undoRate), 'норма < 5%', m.undoRate == null || m.undoRate < 0.05],
  ];
  return (
    <View style={styles.root}>
      <Text style={styles.cap}>{live ? 'ВСЕ ЛЮДИ · 30 ДНЕЙ' : 'ЭТО УСТРОЙСТВО · ДЕМО'} · ПОКАЗАНО КАРТОЧЕК {m.shown}</Text>
      <View style={{flexDirection:'row',gap:12}}><Pressable onPress={()=>void q.refetch()}><Text style={styles.title}>Обновить</Text></Pressable><Pressable onPress={()=>useAnalytics.setState({events:[]})}><Text style={styles.title}>Очистить на этом устройстве</Text></Pressable></View>
      {q.isError&&<Text style={styles.note}>Не удалось загрузить аналитику. Повтори запрос.</Text>}
      <Text style={styles.h1} accessibilityRole="header">Как понять, что работает</Text>
      <View style={styles.grid}>
        {rows.map(([title, value, norm, ok]) => (
          <View key={title} style={styles.card}>
            <Text style={styles.title}>{title}</Text>
            <Text style={[styles.value, !ok && { color: colors.accentText }]}>{value}</Text>
            <Text style={styles.norm}>{norm}</Text>
          </View>
        ))}
      </View>
      {m.verdicts.map((v) => <View key={v} style={styles.flag}><Text style={styles.flagText}>{v}</Text></View>)}
      <Text style={styles.note}>Считаем по событиям без текста и координат: показ карточки, «пойду», «мимо», «вернуть», отмена плана, «Я на месте», открытие ленты. Выводы — от 20 показов.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { width: '100%', maxWidth: 820, alignSelf: 'center', paddingHorizontal: 16, paddingTop: 28, paddingBottom: 40, gap: 14 },
  cap: { fontFamily: fonts.mono600, fontSize: 11, color: colors.muted2, letterSpacing: 0.6 },
  h1: { fontFamily: fonts.display700, fontSize: 26, color: colors.ink, letterSpacing: -0.4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: { flexGrow: 1, flexBasis: 180, backgroundColor: colors.card, borderRadius: 18, borderWidth: 1, borderColor: colors.line, padding: 16, gap: 4 },
  title: { fontFamily: fonts.body500, fontSize: 13, color: colors.muted2 },
  value: { fontFamily: fonts.display700, fontSize: 30, color: colors.ink },
  norm: { fontFamily: fonts.mono500, fontSize: 10.5, color: colors.muted, letterSpacing: 0.4, textTransform: 'uppercase' },
  flag: { alignSelf: 'flex-start', backgroundColor: '#F8DCCD', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  flagText: { fontFamily: fonts.body600, fontSize: 13, color: colors.accentText },
  note: { fontFamily: fonts.body400, fontSize: 13, color: colors.muted, lineHeight: 19 },
});
