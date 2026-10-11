// Кнопки под карточкой: ✕ «Мимо», ⌃ «Подробнее», ♥ «Пойду». Их можно нажимать, и они же объясняют жесты:
// когда тянешь карточку, нужная кнопка подсвечивается (Мимо чернеет, Пойду оранжевая, Подробнее синяя).
import { ChevronUp, Heart, X } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Extrapolation, interpolate, interpolateColor, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { colors, fonts } from '../theme';

const THRESHOLD = 90;

function Btn({ label, src, range, neg, tint, size, icon, iconOn, onPress }: {
  label: string; src: SharedValue<number>; range: [number, number]; neg?: boolean; tint: string; size: number;
  icon: ReactNode; iconOn: ReactNode; onPress: () => void;
}) {
  // neg — тянем в минус (влево / вверх): значение переворачиваем, диапазон для interpolate должен возрастать.
  const a = (v: number) => { 'worklet'; return interpolate(neg ? -v : v, range, [0, 1], Extrapolation.CLAMP); };
  const circle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(a(src.get()), [0, 1], [colors.card, tint]),
    transform: [{ scale: 1 + 0.14 * a(src.get()) }],
  }));
  const off = useAnimatedStyle(() => ({ opacity: 1 - a(src.get()) }));
  const on = useAnimatedStyle(() => ({ opacity: a(src.get()) }));
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={styles.item} hitSlop={6}>
      <Animated.View style={[styles.circle, { width: size, height: size, borderRadius: size / 2 }, circle]}>
        <Animated.View style={[styles.icon, off]}>{icon}</Animated.View>
        <Animated.View style={[styles.icon, on]}>{iconOn}</Animated.View>
      </Animated.View>
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

export function QuickButtons({ x, y, onNo, onUp, onGo }: { x: SharedValue<number>; y: SharedValue<number>; onNo: () => void; onUp: () => void; onGo: () => void }) {
  const p = { size: 24, strokeWidth: 2.2 };
  return (
    <View style={styles.row}>
      <Btn label="Мимо" src={x} range={[12, THRESHOLD]} neg tint={colors.ink} size={54} onPress={onNo}
        icon={<X {...p} color={colors.ink} />} iconOn={<X {...p} color="#FFFFFF" />} />
      <Btn label="Подробнее" src={y} range={[10, 60]} neg tint={colors.friend} size={54} onPress={onUp}
        icon={<ChevronUp {...p} color={colors.ink} />} iconOn={<ChevronUp {...p} color="#FFFFFF" />} />
      <Btn label="Пойду" src={x} range={[12, THRESHOLD]} tint={colors.accent} size={54} onPress={onGo}
        icon={<Heart {...p} color={colors.accent} />} iconOn={<Heart {...p} color={colors.ink} />} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-around' },
  item: { width: 90, alignItems: 'center', gap: 5 },
  circle: { alignItems: 'center', justifyContent: 'center', shadowColor: colors.ink, shadowOpacity: 0.14, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  icon: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  label: { fontFamily: fonts.body600, fontSize: 11, color: colors.muted },
});
