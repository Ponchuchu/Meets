// Планы в календаре: месяц, у каждого дня — цветные точки планов; тап по дню — что, где и с кем.
// Иду, зовут, сохранено и мои встречи — всё в одном месте, чтобы видеть неделю целиком.
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { EventItem } from '../src/data';
import { almaty, dayIndex, dayStart, now as clockNow } from '../src/lib/clock';
import { CAT_COLOR, CAT_ICON, catFg } from '../src/map/icons';
import type { PlanRow } from '../src/profile/ui/Plans';
import { usePlanRows } from '../src/profile/usePlanRows';
import { colors, fonts } from '../src/theme';
import { Avatar } from '../src/ui/Avatar';
import { Ic } from '../src/ui/Ic';
import { BackButton } from '../src/ui/kit';

const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const MON_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const WEEK = ['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'ВС'];
const WD_FULL = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];

type Kind = 'go' | 'invite' | 'saved' | 'host';
interface Entry { row: PlanRow; kind: Kind }
const KIND: Record<Kind, { text: string; bg: string; fg: string }> = {
  go: { text: 'ИДУ', bg: colors.ink, fg: colors.paper },
  host: { text: 'МОЯ ВСТРЕЧА', bg: colors.accent, fg: colors.ink },
  invite: { text: 'ЗОВУТ', bg: colors.friend, fg: '#FFFFFF' },
  saved: { text: 'МОЖЕТ БЫТЬ', bg: colors.sand2, fg: colors.ink },
};

const hm = (iso: string) => { const d = almaty(iso); return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`; };

/** Дни, в которые идёт событие: длинное (выставка) — каждый день до конца, но не больше двух недель. */
function daysOf(e: EventItem): number[] {
  const a = dayIndex(e.startsAt);
  const b = e.isLong && e.endsAt ? Math.min(dayIndex(e.endsAt), a + 14) : a;
  return Array.from({ length: b - a + 1 }, (_, i) => a + i);
}

export default function PlansCalendar() {
  const insets = useSafeAreaInsets();
  const now = useMemo(() => clockNow(), []);
  const { goingRows, inviteRows, savedRows } = usePlanRows(now);
  const today = dayIndex(now);
  const [offset, setOffset] = useState(0); // 0 — текущий месяц
  const [picked, setPicked] = useState<number | null>(null);

  const byDay = useMemo(() => {
    const m = new Map<number, Entry[]>();
    const add = (row: PlanRow, kind: Kind) => { for (const d of daysOf(row.e)) m.set(d, [...(m.get(d) ?? []), { row, kind }]); };
    goingRows.forEach((r) => add(r, r.e.meetup ? 'host' : 'go'));
    inviteRows.forEach((r) => add(r, 'invite'));
    savedRows.forEach((r) => add(r, 'saved'));
    for (const list of m.values()) list.sort((a, b) => a.row.e.startsAt.localeCompare(b.row.e.startsAt));
    return m;
  }, [goingRows, inviteRows, savedRows]);

  // Сетка — пять недель подряд с понедельника текущей недели (месяц не обрывается в конце), стрелки листают по 5 недель.
  const wd = (almaty(now).getUTCDay() + 6) % 7;
  const start = today - wd + offset * 35;
  const cells = Array.from({ length: 35 }, (_, i) => start + i);
  const m0 = almaty(dayStart(start));
  const m1 = almaty(dayStart(start + 34));
  const rangeTitle = m0.getUTCMonth() === m1.getUTCMonth() ? `${MONTHS[m0.getUTCMonth()]} ${m0.getUTCFullYear()}` : `${MONTHS[m0.getUTCMonth()]} – ${MONTHS[m1.getUTCMonth()].toLowerCase()}`;

  const firstPlanDay = [...byDay.keys()].filter((d) => d >= today).sort((a, b) => a - b)[0];
  const sel = picked ?? (byDay.has(today) ? today : firstPlanDay ?? today);
  const selDate = almaty(dayStart(sel));
  const list = byDay.get(sel) ?? [];

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingTop: Math.max(50, insets.top + 6), paddingHorizontal: 16, paddingBottom: 40 + insets.bottom, gap: 16 }}>
      <View style={styles.head}>
        <BackButton onPress={() => (router.canGoBack() ? router.back() : router.replace('/me'))} />
        <Text style={styles.h1} accessibilityRole="header">Календарь планов</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.monthRow}>
          <Pressable disabled={offset === 0} onPress={() => { setOffset(offset - 1); setPicked(null); }} style={[styles.arrow, offset === 0 && { opacity: 0.3 }]} accessibilityRole="button" accessibilityLabel="Раньше">
            <Ic d="M15 6l-6 6 6 6" size={18} color={colors.ink} w={2.2} />
          </Pressable>
          <Text style={styles.month}>{rangeTitle}</Text>
          <Pressable disabled={offset >= 2} onPress={() => { setOffset(offset + 1); setPicked(null); }} style={[styles.arrow, offset >= 2 && { opacity: 0.3 }]} accessibilityRole="button" accessibilityLabel="Дальше">
            <Ic d="M9 6l6 6-6 6" size={18} color={colors.ink} w={2.2} />
          </Pressable>
        </View>
        <View style={styles.grid}>
          {WEEK.map((w, i) => <Text key={w} style={[styles.wd, i >= 5 && { color: colors.accentText }]}>{w}</Text>)}
        </View>
        <Animated.View key={offset} entering={FadeIn.duration(200)} style={[styles.grid, { rowGap: 4 }]}>
          {cells.map((d) => {
            const entries = byDay.get(d) ?? [];
            const on = d === sel;
            const past = d < today;
            const cats = [...new Set(entries.map((x) => x.row.e.category))].slice(0, 3);
            const hasFriends = entries.some((x) => x.row.faces?.length);
            return (
              <Pressable key={d} onPress={() => setPicked(d)} style={[styles.cell, on && styles.cellOn, d === today && !on && styles.today]}
                accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={`${almaty(dayStart(d)).getUTCDate()}${entries.length ? `, планов: ${entries.length}` : ''}`}>
                <Text style={[styles.num, { color: on ? colors.paper : past ? colors.muted3 : colors.ink }]}>{almaty(dayStart(d)).getUTCDate()}</Text>
                {almaty(dayStart(d)).getUTCDate() === 1 && <Text style={[styles.mon1, on && { color: colors.paper }]}>{MON_GEN[almaty(dayStart(d)).getUTCMonth()].slice(0, 3)}</Text>}
                <View style={styles.dots}>
                  {cats.map((c) => <View key={c} style={[styles.dot, { backgroundColor: CAT_COLOR[c] }]} />)}
                </View>
                {hasFriends && <View style={[styles.friendMark, on && { borderColor: colors.ink }]} />}
              </Pressable>
            );
          })}
        </Animated.View>
        <View style={styles.legend}>
          <View style={styles.legendItem}><View style={[styles.dot, { backgroundColor: colors.accent }]} /><Text style={styles.legendText}>планы по цвету события</Text></View>
          <View style={styles.legendItem}><View style={[styles.friendMark, { position: 'relative', right: 0, top: 0 }]} /><Text style={styles.legendText}>с друзьями</Text></View>
        </View>
      </View>

      <Text style={styles.dayTitle}>{sel === today ? 'Сегодня' : `${selDate.getUTCDate()} ${MON_GEN[selDate.getUTCMonth()]}`}<Text style={styles.dayWd}>  {WD_FULL[selDate.getUTCDay()]}</Text></Text>
      {list.length === 0 ? (
        <Pressable onPress={() => router.push('/create')} style={({ pressed }) => [styles.empty, pressed && { opacity: 0.7 }]} accessibilityRole="button">
          <View style={styles.emptyIcon}><Ic d="M12 5v14M5 12h14" size={20} color={colors.ink} w={2.2} /></View>
          <Text style={styles.emptyText}>Свободный день — позвать друзей</Text>
        </Pressable>
      ) : list.map(({ row, kind }, i) => {
        const e = row.e;
        const k = KIND[kind];
        return (
          <Animated.View key={`${e.id}-${sel}`} entering={FadeInDown.delay(i * 50).duration(220)}>
            <Pressable onPress={() => router.push({ pathname: '/event/[id]', params: { id: e.id } })} style={({ pressed }) => [styles.item, pressed && { transform: [{ scale: 0.985 }] }]} accessibilityRole="button" accessibilityLabel={`${e.title}, ${hm(e.startsAt)}`}>
              <View style={styles.time}>
                <Text style={styles.timeText}>{e.isLong ? 'весь' : hm(e.startsAt)}</Text>
                {!e.isLong && e.endsAt && <Text style={styles.timeEnd}>{hm(e.endsAt)}</Text>}
              </View>
              <View style={[styles.stripe, { backgroundColor: CAT_COLOR[e.category] }]} />
              <View style={{ flex: 1, gap: 4 }}>
                <View style={[styles.kind, { backgroundColor: k.bg }]}><Text style={[styles.kindText, { color: k.fg }]}>{k.text}</Text></View>
                <Text style={styles.title} numberOfLines={2}>{e.title}</Text>
                <Text style={styles.sub} numberOfLines={1}>{e.venueName ?? e.address.split(',')[0]}</Text>
                {!!row.faces?.length && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <View style={{ flexDirection: 'row' }}>{row.faces.slice(0, 4).map((p, j) => <Avatar key={p.id} p={p} size={22} ring={colors.friend} style={{ marginLeft: j ? -7 : 0 }} />)}</View>
                    <Text style={styles.sub} numberOfLines={1}>{row.sub}</Text>
                  </View>
                )}
              </View>
              <View style={[styles.catIcon, { backgroundColor: CAT_COLOR[e.category] }]}><Ic d={CAT_ICON[e.category]} size={16} color={catFg(e.category)} w={2} /></View>
            </Pressable>
          </Animated.View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  h1: { fontFamily: fonts.display700, fontSize: 24, letterSpacing: -0.5, color: colors.ink },
  card: { padding: 12, borderRadius: 24, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, gap: 8 },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  arrow: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  month: { fontFamily: fonts.display700, fontSize: 17, color: colors.ink },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  wd: { width: `${100 / 7}%`, textAlign: 'center', fontFamily: fonts.mono600, fontSize: 10, letterSpacing: 0.5, color: colors.muted },
  cell: { width: `${100 / 7}%`, height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center', gap: 4 },
  cellOn: { backgroundColor: colors.ink },
  today: { borderWidth: 1.5, borderColor: colors.ink },
  num: { fontFamily: fonts.display600, fontSize: 15 },
  mon1: { position: 'absolute', top: 3, fontFamily: fonts.mono600, fontSize: 8.5, color: colors.accentText },
  dots: { flexDirection: 'row', gap: 3, height: 6 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  friendMark: { position: 'absolute', top: 5, right: 7, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.friend, borderWidth: 1.5, borderColor: colors.card },
  legend: { flexDirection: 'row', gap: 16, paddingHorizontal: 6, paddingTop: 2 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendText: { fontFamily: fonts.body400, fontSize: 12, color: colors.muted },
  dayTitle: { fontFamily: fonts.display700, fontSize: 20, color: colors.ink, paddingHorizontal: 4 },
  dayWd: { fontFamily: fonts.body400, fontSize: 14, color: colors.muted },
  empty: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 20, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.line2 },
  emptyIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.sand2, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontFamily: fonts.body600, fontSize: 14.5, color: colors.ink },
  item: { flexDirection: 'row', gap: 12, padding: 12, borderRadius: 20, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  time: { width: 44, alignItems: 'flex-end', paddingTop: 2 },
  timeText: { fontFamily: fonts.mono600, fontSize: 12.5, color: colors.ink },
  timeEnd: { fontFamily: fonts.mono500, fontSize: 11, color: colors.muted },
  stripe: { width: 4, borderRadius: 2 },
  kind: { alignSelf: 'flex-start', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 },
  kindText: { fontFamily: fonts.mono600, fontSize: 9, letterSpacing: 0.4 },
  title: { fontFamily: fonts.body700, fontSize: 15.5, color: colors.ink },
  sub: { flexShrink: 1, fontFamily: fonts.body400, fontSize: 12.5, color: colors.muted },
  catIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
});
