// Шаги (FIX3 Ф7): кольцо на 10 000 за сегодня, неделя столбиками, награды за шаги. Считаются всегда — кнопки «стоп» нет.
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getProfileExtras, saveProfileExtras } from '../../live/profileExtras';
import { Group, ToggleRow } from '../../ui/v6/Settings';
import { StepsChallenges, StepsLeaderboard } from './StepsSocial';
import { Footprints } from 'lucide-react-native';
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { config } from '../../lib/config';
import { askSteps, openStepSettings, STEP_GOAL, STEP_GOALS, stepHistory, stepsToday, useSteps } from '../../live/steps';
import { lastWeek, stepAwards } from '../../profile/stepAwards';
import { colors, fonts, radii } from '../../theme';
import { BadgeMedal } from '../../ui/BadgeMedal';
import { BADGE_ICONS } from '../../profile/badges';
import { plate } from '../../ui/glass';

const DAY = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
const todayKey = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Almaty' });
const demoHistory = () => Array.from({ length: 12 }, (_, i) => ({ day: new Date(Date.now() - (i + 1) * 86400e3).toLocaleDateString('en-CA', { timeZone: 'Asia/Almaty' }), steps: [8200, 11400, 6400, 3100, 12800, 9100, 7300, 10400, 5200, 6900, 4100, 9800][i] }));

export function StepsCard() {
  const live = config.dataMode !== 'demo';
  const steps = useSteps(s => (live ? stepsToday(s) : 6240));
  const { status, source } = useSteps();
  const qc = useQueryClient();
  const extras = useQuery({ queryKey: ['me', 'extras'], queryFn: getProfileExtras });
  const history = useQuery({ queryKey: ['me', 'steps'], queryFn: stepHistory, enabled: live, staleTime: 60e3 });
  const days = live ? history.data ?? [] : demoHistory();
  const week = lastWeek(days, todayKey(), steps);
  const max = Math.max(STEP_GOAL, ...week.map(d => d.steps));
  const awards = stepAwards(days, { day: todayKey(), steps });
  const next = STEP_GOALS.find(g => steps < g.steps);
  const r = 64, len = 2 * Math.PI * r;
  const avg = Math.round(week.reduce((a, d) => a + d.steps, 0) / 7);

  return (
    <View style={{ gap: 12 }}>
      <View style={[styles.card, { alignItems: 'center', gap: 6 }]}>
        <View style={{ width: 150, height: 150, alignItems: 'center', justifyContent: 'center' }}>
          <Svg width={150} height={150} style={StyleSheet.absoluteFill}>
            <Circle cx={75} cy={75} r={r} stroke="#D6CFC0" strokeWidth={11} fill="none" />
            <Circle cx={75} cy={75} r={r} stroke={colors.ok} strokeWidth={11} fill="none" strokeLinecap="round" strokeDasharray={`${Math.max(1, len * Math.min(1, steps / STEP_GOAL))} ${len}`} transform="rotate(-90 75 75)" />
          </Svg>
          <Footprints size={20} color={colors.ok} strokeWidth={2} />
          <Text style={styles.big}>{steps.toLocaleString('ru-RU')}</Text>
          <Text style={styles.of}>из 10 000</Text>
        </View>
        <Text style={styles.hint}>{steps >= STEP_GOAL ? 'Цель на сегодня выполнена — ты молодец' : next ? `Ещё ${(next.steps - steps).toLocaleString('ru-RU')} шагов — и +${next.points} очков` : ''}</Text>
        {status === 'denied' && (
          <Pressable onPress={() => void askSteps()} onLongPress={() => (source === 'health' ? openStepSettings() : void Linking.openSettings())} style={styles.btn} accessibilityRole="button">
            <Text style={styles.btnText}>Разрешить шаги</Text>
          </Pressable>
        )}
        {status === 'install' && (
          <Pressable onPress={() => void Linking.openURL('market://details?id=com.google.android.apps.healthdata')} style={styles.btn} accessibilityRole="button">
            <Text style={styles.btnText}>Обновить Health Connect</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.card}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={styles.title}>Неделя</Text>
          <Text style={styles.sub}>в среднем {avg.toLocaleString('ru-RU')} в день</Text>
        </View>
        <View style={styles.bars}>
          {week.map((d, i) => {
            const h = Math.max(4, Math.round((d.steps / max) * 96));
            const on = d.steps >= STEP_GOAL;
            return (
              <View key={d.day} style={styles.barCol} accessibilityLabel={`${DAY[new Date(`${d.day}T12:00:00Z`).getUTCDay()]}: ${d.steps} шагов`}>
                <View style={[styles.bar, { height: h, backgroundColor: on ? colors.ok : i === 6 ? colors.ink : '#BFB8A7' }]} />
                <Text style={[styles.barDay, i === 6 && { color: colors.ink }]}>{DAY[new Date(`${d.day}T12:00:00Z`).getUTCDay()]}</Text>
              </View>
            );
          })}
          <View pointerEvents="none" style={[styles.goalLine, { bottom: 22 + Math.round((STEP_GOAL / max) * 96) }]} />
        </View>
      </View>

      <StepsLeaderboard />
      <StepsChallenges />

      <View style={styles.card}>
        <Text style={styles.title}>Награды за шаги</Text>
        {awards.map(a => (
          <View key={a.id} style={styles.award}>
            <BadgeMedal id={a.id} icon={BADGE_ICONS.boot} got={a.got} progress={a.progress / a.goal} size={46} />
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={styles.awardName}>{a.name}</Text>
              <Text style={styles.sub}>{a.how}</Text>
              {!a.got && <View style={styles.track}><View style={[styles.fill, { width: `${Math.min(100, (a.progress / a.goal) * 100)}%` }]} /></View>}
            </View>
            <Text style={styles.awardVal}>{a.got ? 'Есть' : `${Math.round((a.progress / a.goal) * 100)}%`}</Text>
          </View>
        ))}
      </View>

      <Group>
        <ToggleRow title="Показывать мои шаги друзьям" sub="Для рейтинга и соревнований" on={extras.data?.stepsVisible !== false}
          onChange={v => { void saveProfileExtras({ stepsVisible: v }).then(() => qc.invalidateQueries({ queryKey: ['me', 'extras'] })).catch(() => undefined); }} last />
      </Group>
      <Text style={styles.note}>
        {Platform.OS === 'web' ? 'Шаги считаются в приложении на телефоне.'
          : source === 'health' ? 'Шаги за весь день берём из Health Connect — их считает сам телефон, даже когда Meets закрыт.'
          : source === 'ios' ? 'Шаги за весь день из датчика iPhone.'
          : 'Health Connect не найден — считаем шаги датчиком, пока Meets открыт. Поставь Health Connect, чтобы считались весь день.'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radii.xl - 4, ...plate, padding: 16, gap: 12 },
  big: { fontFamily: fonts.display800, fontSize: 32, letterSpacing: -1, color: colors.ink },
  of: { fontFamily: fonts.body500, fontSize: 12.5, color: colors.muted },
  hint: { fontFamily: fonts.body500, fontSize: 14, color: colors.muted2, textAlign: 'center' },
  btn: { minHeight: 46, paddingHorizontal: 20, borderRadius: 15, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  btnText: { fontFamily: fonts.body700, fontSize: 14.5, color: colors.paper },
  title: { fontFamily: fonts.display700, fontSize: 18, color: colors.ink },
  sub: { fontFamily: fonts.body400, fontSize: 12.5, lineHeight: 17, color: colors.muted },
  bars: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 122, paddingTop: 4 },
  barCol: { flex: 1, alignItems: 'center', gap: 6 },
  bar: { width: 22, borderRadius: 8 },
  barDay: { fontFamily: fonts.mono600, fontSize: 10.5, color: colors.muted },
  goalLine: { position: 'absolute', left: 0, right: 0, height: 1, borderTopWidth: 1, borderStyle: 'dashed', borderColor: colors.ok, opacity: 0.6 },
  award: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  awardName: { fontFamily: fonts.body700, fontSize: 15, color: colors.ink },
  awardVal: { fontFamily: fonts.mono600, fontSize: 12, color: colors.muted2 },
  track: { height: 5, borderRadius: 3, backgroundColor: colors.sand, overflow: 'hidden', marginTop: 2 },
  fill: { height: 5, backgroundColor: colors.ok },
  note: { fontFamily: fonts.body400, fontSize: 13, lineHeight: 19, color: colors.muted, paddingHorizontal: 4 },
});
