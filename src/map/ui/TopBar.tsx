// Верхняя панель карты: пилюля «Сегодня ▾ + погода», поиск, фильтр со счётчиком.
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { SKY_PATHS, tempLabel, type DayWeather } from '../../data/weather';
import { colors, fonts } from '../../theme';

const SHADOW = { shadowColor: colors.ink, shadowOpacity: 0.08, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 3 };

export function TopBar({ date, weather, calOpen, active, onDate, onSearch, onFilters }: {
  date: string; weather: DayWeather | null; calOpen: boolean; active: number; onDate: () => void; onSearch: () => void; onFilters: () => void;
}) {
  return (
    <View style={styles.row}>
      <Pressable onPress={onDate} style={[styles.pill, SHADOW]} accessibilityRole="button" accessibilityState={{ expanded: calOpen }}
        accessibilityLabel={`Дата: ${date}${weather ? `, ${tempLabel(weather.temp)}, ${weather.text}` : ''}. Открыть календарь`}>
        <View style={styles.dateRow}>
          <Text style={styles.date} numberOfLines={1}>{date}</Text>
          <Svg width={14} height={14} viewBox="0 0 24 24" style={{ transform: [{ rotate: calOpen ? '180deg' : '0deg' }] }}>
            <Path d="M6 9l6 6 6-6" stroke={colors.ink} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </Svg>
        </View>
        <View style={styles.wx}>
          <Svg width={20} height={20} viewBox="0 0 24 24">
            <Path d={SKY_PATHS[weather?.sky ?? 'cloud']} stroke={colors.ink} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </Svg>
          <Text style={styles.temp}>{weather ? tempLabel(weather.temp) : '—'}</Text>
        </View>
      </Pressable>
      <Pressable onPress={onSearch} style={[styles.round, SHADOW]} accessibilityRole="button" accessibilityLabel="Поиск по событиям и местам">
        <Svg width={21} height={21} viewBox="0 0 24 24">
          <Circle cx={11} cy={11} r={7} stroke={colors.ink} strokeWidth={1.9} fill="none" />
          <Path d="M20 20l-3.5-3.5" stroke={colors.ink} strokeWidth={1.9} strokeLinecap="round" />
        </Svg>
      </Pressable>
      <Pressable onPress={onFilters} style={[styles.round, SHADOW, active > 0 && { backgroundColor: colors.ink }]} accessibilityRole="button"
        accessibilityLabel={active ? `Фильтры, включено: ${active}` : 'Фильтры'}>
        <Svg width={21} height={21} viewBox="0 0 24 24">
          <Path d="M4 7h10M18 7h2M4 17h4M12 17h8" stroke={active ? colors.paper : colors.ink} strokeWidth={1.9} strokeLinecap="round" />
          <Circle cx={16} cy={7} r={2} stroke={active ? colors.paper : colors.ink} strokeWidth={1.9} fill="none" />
          <Circle cx={10} cy={17} r={2} stroke={active ? colors.paper : colors.ink} strokeWidth={1.9} fill="none" />
        </Svg>
        {active > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{active}</Text></View>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  pill: { flex: 1, minWidth: 0, height: 52, paddingLeft: 16, paddingRight: 6, borderRadius: 26, backgroundColor: colors.cardAlt, flexDirection: 'row', alignItems: 'center', gap: 10 },
  dateRow: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 4 },
  date: { fontFamily: fonts.body600, fontSize: 15, color: colors.ink, flexShrink: 1 },
  wx: { height: 40, paddingLeft: 10, paddingRight: 12, borderRadius: 20, backgroundColor: '#EFEBE2', flexDirection: 'row', alignItems: 'center', gap: 6 },
  temp: { fontFamily: fonts.body600, fontSize: 15, color: colors.ink },
  round: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.cardAlt, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', right: 0, top: 0, width: 21, height: 21, borderRadius: 10.5, borderWidth: 2, borderColor: colors.cardAlt, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontFamily: fonts.mono600, fontSize: 9.5, color: colors.ink },
});
