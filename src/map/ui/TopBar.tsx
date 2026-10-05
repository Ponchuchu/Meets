// Верх карты v6 — design/png/V6MapTop.png: поиск «Куда сходить?», «Линзы», «Фильтры» (точка — что-то включено), «+».
// Под поиском слева — погода: сейчас или прогноз на выбранный день.
import { Layers, Plus, Search, SlidersHorizontal } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { SKY_PATHS, tempLabel, type DayWeather } from '../../data/weather';
import { colors, fonts } from '../../theme';
import { glass } from '../../ui/glass';

export function TopBar({ weather, weatherNow, active, dark, lensOn, onSearch, onLens, onFilters, onCreate }: {
  weather: DayWeather | null; weatherNow: boolean; active: number; dark?: boolean; lensOn?: boolean;
  onSearch: () => void; onLens: () => void; onFilters: () => void; onCreate: () => void;
}) {
  const fg = dark ? '#F3F0E8' : colors.ink;
  return (
    <View style={{ gap: 10 }}>
      <View style={styles.row}>
        <Pressable onPress={onSearch} style={[styles.pill, glass]} accessibilityRole="search" accessibilityLabel="Куда сходить? Поиск событий, мест и друзей">
          <Search size={20} color={colors.ink} strokeWidth={1.9} />
          <Text style={styles.ph} numberOfLines={1}>Куда сходить?</Text>
        </Pressable>
        <Pressable onPress={onLens} style={({ pressed }) => [styles.round, glass, lensOn && styles.plus, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel={lensOn ? 'Линзы карты, включена линза' : 'Линзы карты'}>
          <Layers size={21} color={lensOn ? colors.paper : colors.ink} strokeWidth={1.8} />
        </Pressable>
        <Pressable onPress={onFilters} style={({ pressed }) => [styles.round, glass, pressed && styles.pressed]} accessibilityRole="button"
          accessibilityLabel={active ? `Фильтры, включено: ${active}` : 'Фильтры'}>
          <SlidersHorizontal size={21} color={colors.ink} strokeWidth={1.8} />
          {active > 0 && <View style={styles.dot} />}
        </Pressable>
        <Pressable onPress={onCreate} style={({ pressed }) => [styles.round, styles.plus, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel="Новая встреча: позвать друзей">
          <Plus size={24} color={colors.paper} strokeWidth={2} />
        </Pressable>
      </View>
      {weather && (
        <Animated.View entering={FadeIn.duration(220)} style={styles.wx} accessibilityLabel={`${weatherNow ? 'Сейчас' : 'Прогноз'}: ${tempLabel(weather.temp)}, ${weather.text}`}>
          <Svg width={20} height={20} viewBox="0 0 24 24">
            <Path d={SKY_PATHS[weather.sky]} stroke={fg} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </Svg>
          <Text style={[styles.temp, { color: fg }]}>{tempLabel(weather.temp)}</Text>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  pill: { flex: 1, minWidth: 0, height: 48, paddingHorizontal: 16, borderRadius: 24, flexDirection: 'row', alignItems: 'center', gap: 10 },
  ph: { fontFamily: fonts.body500, fontSize: 15.5, color: colors.muted, flexShrink: 1 },
  round: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  plus: { backgroundColor: colors.ink },
  pressed: { transform: [{ scale: 0.92 }] },
  dot: { position: 'absolute', right: 9, top: 9, width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: '#FBFAF6', backgroundColor: colors.accent },
  wx: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 10, height: 26 },
  temp: { fontFamily: fonts.body700, fontSize: 16 },
});
