// Шаги (FIX3 Ф7): кольцо на 10 000 за сегодня, неделя столбиками, награды за шаги. Считаются всегда — кнопки «стоп» нет.
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getProfileExtras, saveProfileExtras } from '../../live/profileExtras';
import { Group, ToggleRow } from '../../ui/v6/Settings';
import { StepsChallenges, StepsLeaderboard } from './StepsSocial';
import { useEffect, useState } from 'react';
import { Image, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { config } from '../../lib/config';
import { askSteps, openStepSettings, STEP_GOAL, STEP_GOALS, stepHistory, stepsToday, useSteps } from '../../live/steps';
import { lastWeek, stepAwards } from '../../profile/stepAwards';
import { colors, fonts, radii } from '../../theme';
import { ART } from '../../ui/art';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { plate } from '../../ui/glass';

const DAY = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
const FULL = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
const MON = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const todayKey = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Almaty' });
const demoHistory = () => Array.from({ length: 12 }, (_, i) => ({ day: new Date(Date.now() - (i + 1) * 86400e3).toLocaleDateString('en-CA', { timeZone: 'Asia/Almaty' }), steps: [8200, 11400, 6400, 3100, 12800, 9100, 7300, 10400, 5200, 6900, 4100, 9800][i] }));

/** Картинка к награде за шаги. */
const AWARD_ART: Record<string, number> = { 'steps-first': ART.sneaker, 'steps-streak': ART.fire, 'steps-week': ART.medalGold, 'steps-marathon': ART.trophy, 'steps-month': ART.route };

/** Кроссовок «шагает»: покачивается и подпрыгивает; цель выполнена — вместо него кубок. */
function Walker({ done }: { done: boolean }) {
  const t = useSharedValue(0);
  useEffect(() => { t.set(withRepeat(withSequence(withTiming(1, { duration: 360, easing: Easing.out(Easing.quad) }), withTiming(0, { duration: 360, easing: Easing.in(Easing.quad) })), -1, false)); }, [t]);
  const st = useAnimatedStyle(() => ({ transform: [{ translateY: -t.get() * 6 }, { rotate: `${-6 + t.get() * 10}deg` }] }));
  return <View style={{ height: 84, alignItems: 'center', justifyContent: 'flex-end', overflow: 'hidden' }}><Animated.View style={st}><Image source={done ? ART.trophy : ART.sneaker} style={{ width: 76, height: 76 }} accessibilityIgnoresInvertColors /></Animated.View></View>;
}

export function StepsCard() {
  const live = config.dataMode !== 'demo';
  const steps = useSteps(s => (live ? stepsToday(s) : 6240));
  const status = useSteps((s) => s.status);
  const source = useSteps((s) => s.source);
  const qc = useQueryClient();
  const extras = useQuery({ queryKey: ['me', 'extras'], queryFn: getProfileExtras });
  const history = useQuery({ queryKey: ['me', 'steps'], queryFn: stepHistory, enabled: live, staleTime: 60e3 });
  const days = live ? history.data ?? [] : demoHistory();
  const week = lastWeek(days, todayKey(), steps);
  const max = Math.max(STEP_GOAL, ...week.map(d => d.steps));
  const awards = stepAwards(days, { day: todayKey(), steps });
  const next = STEP_GOALS.find(g => steps < g.steps);
  const r = 64, len = 2 * Math.PI * r;
  const sum = week.reduce((a, d) => a + d.steps, 0);
  const avg = Math.round(sum / 7);
  // Нажатый столбик (FIX5): сколько шагов в этот день; по умолчанию — сегодня.
  const [pick, setPick] = useState(6);
  const picked = week[pick] ?? week[6];
  const pickedName = picked ? (pick === 6 ? 'Сегодня' : `${FULL[new Date(`${picked.day}T12:00:00Z`).getUTCDay()]}, ${Number(picked.day.slice(8))} ${MON[Number(picked.day.slice(5, 7)) - 1]}`) : '';

  return (
    <View style={{ gap: 12 }}>
      {/* Главное за сегодня (26 окт., картинки из Figma): зелёная карточка, кольцо до цели, шагающий кроссовок, километры и калории. */}
      <View style={styles.hero}>
        <View style={{ width: 150, height: 150, flexShrink: 0, alignItems: 'center', justifyContent: 'center' }}>
          <Svg width={150} height={150} style={StyleSheet.absoluteFill}>
            <Circle cx={75} cy={75} r={r} stroke="rgba(255,255,255,0.18)" strokeWidth={12} fill="none" />
            <Circle cx={75} cy={75} r={r} stroke="#C8F56A" strokeWidth={12} fill="none" strokeLinecap="round" strokeDasharray={`${Math.max(1, len * Math.min(1, steps / STEP_GOAL))} ${len}`} transform="rotate(-90 75 75)" />
          </Svg>
          <Text style={styles.big}>{steps.toLocaleString('ru-RU')}</Text>
          <Text style={styles.of}>из 10 000</Text>
        </View>
        <View style={{ flex: 1, gap: 10 }}>
          <Walker done={steps >= STEP_GOAL} />
          <View style={styles.stats}>
            <View><Text style={styles.statN}>{(steps * 0.00075).toFixed(1).replace('.', ',')}</Text><Text style={styles.statL}>км</Text></View>
            <View><Text style={styles.statN}>{Math.round(steps * 0.04)}</Text><Text style={styles.statL}>ккал</Text></View>
          </View>
        </View>
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

      <View style={styles.card}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <Text style={styles.title}>Неделя</Text>
          <Text style={styles.sub}>{sum.toLocaleString('ru-RU')} за 7 дней · в среднем {avg.toLocaleString('ru-RU')}</Text>
        </View>
        {picked && (
          <View style={styles.pickRow}>
            <Text style={styles.pickDay}>{pickedName}</Text>
            <Text style={styles.pickSteps}>{picked.steps.toLocaleString('ru-RU')} <Text style={styles.sub}>шагов</Text></Text>
          </View>
        )}
        <View style={styles.bars}>
          {week.map((d, i) => {
            const h = Math.max(4, Math.round((d.steps / max) * 96));
            const on = d.steps >= STEP_GOAL;
            return (
              <Pressable key={d.day} onPress={() => setPick(i)} style={styles.barCol} accessibilityRole="button" accessibilityState={{ selected: pick === i }} accessibilityLabel={`${DAY[new Date(`${d.day}T12:00:00Z`).getUTCDay()]}: ${d.steps} шагов`}>
                <View style={[styles.bar, { height: h, backgroundColor: pick === i ? colors.accent : on ? colors.ok : '#BFB8A7' }]} />
                <Text style={[styles.barDay, pick === i && { color: colors.ink, fontFamily: fonts.mono600 }]}>{i === 6 ? 'сег' : DAY[new Date(`${d.day}T12:00:00Z`).getUTCDay()]}</Text>
              </Pressable>
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
            <View style={[styles.awardArt, !a.got && { opacity: 0.45 }]}><Image source={AWARD_ART[a.id] ?? ART.sneaker} style={{ width: 48, height: 48 }} /></View>
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
  hero: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: radii.xl - 4, backgroundColor: '#1F6B45', overflow: 'hidden', boxShadow: '0 14px 24px -14px rgba(31,107,69,0.7)' },
  big: { fontFamily: fonts.display800, fontSize: 32, letterSpacing: -1, color: '#FFFFFF' },
  of: { fontFamily: fonts.body500, fontSize: 12.5, color: 'rgba(255,255,255,0.7)' },
  stats: { flexDirection: 'row', justifyContent: 'space-around' },
  statN: { fontFamily: fonts.display800, fontSize: 20, color: '#FFFFFF', textAlign: 'center' },
  statL: { fontFamily: fonts.mono600, fontSize: 10.5, color: 'rgba(255,255,255,0.7)', textAlign: 'center', textTransform: 'uppercase' },
  awardArt: { width: 52, height: 52, borderRadius: 18, backgroundColor: '#F7F3EB', alignItems: 'center', justifyContent: 'center' },
  hint: { fontFamily: fonts.body500, fontSize: 14, color: colors.muted2, textAlign: 'center' },
  btn: { minHeight: 46, paddingHorizontal: 20, borderRadius: 15, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  btnText: { fontFamily: fonts.body700, fontSize: 14.5, color: colors.paper },
  title: { fontFamily: fonts.display700, fontSize: 18, color: colors.ink },
  sub: { fontFamily: fonts.body400, fontSize: 12.5, lineHeight: 17, color: colors.muted },
  pickRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 14, backgroundColor: 'rgba(240,82,31,0.08)' },
  pickDay: { fontFamily: fonts.body700, fontSize: 14, color: colors.ink },
  pickSteps: { fontFamily: fonts.display800, fontSize: 20, color: colors.ink },
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
