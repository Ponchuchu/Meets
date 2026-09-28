// Календарь с погодой на 7 дней — выпадающая карточка на карте (MapCalendar).
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import type { EventItem } from '../../data/types';
import { SKY_PATHS, tempLabel, type DayWeather } from '../../data/weather';
import { colors, fonts } from '../../theme';
import { calendarCells, dayName, monthsTitle, weekend } from '../calendar';

const WEEK = ['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'ВС'];

export function CalendarCard({ now, events, forecast, from, to, pending, onPick, onPreset, onShow, showText }: {
  now: Date; events: EventItem[]; forecast: DayWeather[]; from: number; to: number; pending: boolean;
  onPick: (offset: number) => void; onPreset: (from: number, to: number) => void; onShow: () => void; showText: string;
}) {
  const cells = calendarCells(now, events);
  const [sat, sun] = weekend(now);
  const presets: [string, number, number][] = [['Сегодня', 0, 0], ['Завтра', 1, 1], ['Выходные', sat, sun], ['7 дней', 0, 6]];
  const hi = pending ? from : to;
  return (
    <View style={styles.card}>
      <View style={styles.presets} accessibilityLabel="Быстрый выбор">
        {presets.map(([label, a, b]) => {
          const on = from === a && hi === b;
          return (
            <Pressable key={label} onPress={() => onPreset(a, b)} accessibilityRole="button" accessibilityState={{ selected: on }}
              style={[styles.preset, { backgroundColor: on ? colors.ink : colors.card, borderColor: on ? colors.ink : colors.line2 }]}>
              <Text style={[styles.presetText, { color: on ? colors.paper : colors.ink }]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.head}>
        <Text style={styles.month}>{monthsTitle(cells)}</Text>
        <Text style={styles.wxTitle}>ПОГОДА НА 7 ДНЕЙ</Text>
      </View>
      <View style={styles.grid}>
        {WEEK.map((d, i) => <Text key={d} style={[styles.wd, i >= 5 && { color: colors.accentText }]}>{d}</Text>)}
      </View>
      <View style={[styles.grid, { rowGap: 4 }]}>
        {cells.map((c) => {
          const lo = Math.min(from, hi);
          const top = Math.max(from, hi);
          const isEnd = c.offset === lo || c.offset === top;
          const inR = c.offset >= lo && c.offset <= top;
          const band = inR && lo !== top;
          const w = c.offset >= 0 ? forecast[c.offset] : undefined;
          const fg = isEnd ? colors.paper : c.past ? '#B3AC9E' : c.weekday >= 5 ? colors.accentText : colors.ink;
          const dot = isEnd ? colors.accent : colors.ink;
          return (
            <View key={c.offset} style={[styles.cellWrap, band && {
              backgroundColor: colors.sand,
              borderTopLeftRadius: c.offset === lo ? 12 : 0, borderBottomLeftRadius: c.offset === lo ? 12 : 0,
              borderTopRightRadius: c.offset === top ? 12 : 0, borderBottomRightRadius: c.offset === top ? 12 : 0,
            }]}>
              <Pressable
                disabled={c.past}
                onPress={() => onPick(c.offset)}
                accessibilityRole="button"
                accessibilityState={{ selected: inR, disabled: c.past }}
                accessibilityLabel={`${dayName(c.offset, now)}${c.offset === 0 ? ', сегодня' : ''}${w ? `, ${tempLabel(w.temp)}, ${w.text}` : ''}`}
                style={[styles.cell, isEnd && { backgroundColor: colors.ink }, c.offset === 0 && !isEnd && styles.todayRing]}
              >
                <Text style={[styles.num, { color: fg, fontFamily: isEnd || c.offset === 0 ? fonts.display700 : fonts.display600 }]}>{c.day}</Text>
                {w ? (
                  <View style={styles.wxRow}>
                    <Svg width={11} height={11} viewBox="0 0 24 24">
                      <Path d={SKY_PATHS[w.sky]} stroke={fg} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
                    </Svg>
                    <Text style={[styles.wxT, { color: fg }]}>{tempLabel(w.temp)}</Text>
                  </View>
                ) : !c.past ? (
                  <View style={styles.dots}>
                    {[1, 2, 3].map((k) => <View key={k} style={[styles.dot, { backgroundColor: dot, opacity: c.density >= k ? 1 : 0.15 }]} />)}
                  </View>
                ) : <View style={{ height: 4 }} />}
              </Pressable>
            </View>
          );
        })}
      </View>
      <Pressable onPress={onShow} style={styles.show} accessibilityRole="button">
        <Text style={styles.showText}>{showText}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { paddingTop: 14, paddingHorizontal: 12, paddingBottom: 12, borderRadius: 24, backgroundColor: colors.cardAlt, gap: 12, shadowColor: colors.ink, shadowOpacity: 0.22, shadowRadius: 20, shadowOffset: { width: 0, height: 18 }, elevation: 12 },
  presets: { flexDirection: 'row', gap: 6 },
  preset: { flex: 1, height: 38, borderWidth: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  presetText: { fontFamily: fonts.body600, fontSize: 13 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingHorizontal: 4 },
  month: { fontFamily: fonts.display600, fontSize: 16, color: colors.ink },
  wxTitle: { fontFamily: fonts.mono600, fontSize: 10, letterSpacing: 0.4, color: colors.muted },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  wd: { width: `${100 / 7}%`, textAlign: 'center', fontFamily: fonts.mono600, fontSize: 10, letterSpacing: 0.5, color: colors.muted },
  cellWrap: { width: `${100 / 7}%`, height: 50 },
  cell: { height: 50, borderRadius: 12, alignItems: 'center', justifyContent: 'center', gap: 2 },
  todayRing: { borderWidth: 1.5, borderColor: colors.ink },
  num: { fontSize: 15 },
  wxRow: { flexDirection: 'row', alignItems: 'center', gap: 1 },
  wxT: { fontFamily: fonts.mono600, fontSize: 9 },
  dots: { flexDirection: 'row', gap: 2, height: 4 },
  dot: { width: 4, height: 4, borderRadius: 2 },
  show: { height: 50, borderRadius: 16, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  showText: { fontFamily: fonts.body600, fontSize: 15, color: colors.paper },
});
