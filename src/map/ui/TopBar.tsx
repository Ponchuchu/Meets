// Верхняя панель карты: пилюля даты, поиск, фильтр со счётчиком, «Новая встреча».
// Под пилюлей слева — маленький чип погоды: сейчас (если выбрано сегодня) или прогноз на выбранный день.
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';
import { SKY_COLOR, SKY_PATHS, tempLabel, type DayWeather } from '../../data/weather';
import { colors, fonts } from '../../theme';

const SHADOW = { shadowColor: colors.ink, shadowOpacity: 0.08, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 3 };

export function TopBar({ date, weather, weatherNow, calOpen, active, onDate, onSearch, onFilters, onCreate }: {
  date: string; weather: DayWeather | null; weatherNow: boolean; calOpen: boolean; active: number;
  onDate: () => void; onSearch: () => void; onFilters: () => void; onCreate: () => void;
}) {
  return (
    <View style={{ gap: 8 }}>
      <View style={styles.row}>
        <Pressable onPress={onDate} style={[styles.pill, SHADOW]} accessibilityRole="button" accessibilityState={{ expanded: calOpen }}
          accessibilityLabel={`Дата: ${date}. Открыть календарь`}>
          <Text style={styles.date} numberOfLines={1}>{date}</Text>
          <Svg width={14} height={14} viewBox="0 0 24 24" style={{ transform: [{ rotate: calOpen ? '180deg' : '0deg' }] }}>
            <Path d="M6 9l6 6 6-6" stroke={colors.ink} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </Svg>
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
        <Pressable onPress={onCreate} style={({ pressed }) => [styles.round, styles.create, { transform: [{ scale: pressed ? 0.92 : 1 }] }]} accessibilityRole="button" accessibilityLabel="Новая встреча: позвать друзей">
          <Svg width={22} height={22} viewBox="0 0 24 24"><Path d="M12 5v14M5 12h14" stroke={colors.ink} strokeWidth={2.3} strokeLinecap="round" /></Svg>
        </Pressable>
      </View>
      {weather && !calOpen && (
        <Animated.View entering={FadeIn.duration(220)} style={[styles.wx, SHADOW]} accessibilityLabel={`${weatherNow ? 'Сейчас' : 'Прогноз'}: ${tempLabel(weather.temp)}, ${weather.text}`}>
          <Svg width={18} height={18} viewBox="0 0 24 24">
            <Path d={SKY_PATHS[weather.sky]} stroke={SKY_COLOR[weather.sky]} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </Svg>
          <Text style={styles.temp}>{tempLabel(weather.temp)}</Text>
          <Text style={styles.wxText} numberOfLines={1}>{weatherNow ? 'сейчас' : weather.text}</Text>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  pill: { flex: 1, minWidth: 0, height: 50, paddingHorizontal: 16, borderRadius: 25, backgroundColor: colors.cardAlt, flexDirection: 'row', alignItems: 'center', gap: 6 },
  date: { fontFamily: fonts.body600, fontSize: 15, color: colors.ink, flexShrink: 1 },
  round: { width: 50, height: 50, borderRadius: 25, backgroundColor: colors.cardAlt, alignItems: 'center', justifyContent: 'center' },
  create: { backgroundColor: colors.accent, shadowColor: colors.accent, shadowOpacity: 0.35, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 5 },
  badge: { position: 'absolute', right: 0, top: 0, width: 21, height: 21, borderRadius: 10.5, borderWidth: 2, borderColor: colors.cardAlt, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontFamily: fonts.mono600, fontSize: 9.5, color: colors.ink },
  wx: { alignSelf: 'flex-start', height: 34, paddingLeft: 10, paddingRight: 12, borderRadius: 17, backgroundColor: colors.cardAlt, flexDirection: 'row', alignItems: 'center', gap: 5 },
  temp: { fontFamily: fonts.body700, fontSize: 14, color: colors.ink },
  wxText: { fontFamily: fonts.body500, fontSize: 12.5, color: colors.muted2 },
});
