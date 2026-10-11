// Подсказки жестов ленты: три «кнопки» под карточкой — ← Мимо · ↑ Подробнее · Пойду →. Они не нажимаются, а показывают,
// куда тянуть: при движении карточки нужная подсвечивается, по краям экрана проступает цветная заливка.
import { StyleSheet, View } from 'react-native';
import Animated, { Extrapolation, interpolate, interpolateColor, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { colors, fonts } from '../theme';

const THRESHOLD = 90;

function Pill({ label, src, range, tint, side }: { label: string; src: SharedValue<number>; range: [number, number]; tint: string; side?: 'left' | 'right' | 'mid' }) {
  const st = useAnimatedStyle(() => {
    const a = interpolate(src.get(), range, [0, 1], Extrapolation.CLAMP);
    return { backgroundColor: interpolateColor(a, [0, 1], [colors.sand, tint]), transform: [{ scale: 1 + 0.08 * a }], opacity: 0.8 + 0.2 * a };
  });
  const tx = useAnimatedStyle(() => ({ color: interpolateColor(interpolate(src.get(), range, [0, 1], Extrapolation.CLAMP), [0, 1], [colors.muted2, '#FFFFFF']) as string }));
  return (
    <Animated.View style={[styles.pill, side === 'mid' && styles.mid, st]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Animated.Text style={[styles.label, tx]}>{label}</Animated.Text>
    </Animated.View>
  );
}

export function SwipeHints({ x, y }: { x: SharedValue<number>; y: SharedValue<number> }) {
  return (
    <View style={styles.row}>
      <Pill label="←  Мимо" src={x} range={[-12, -THRESHOLD]} tint={colors.ink} side="left" />
      <Pill label="↑  Подробнее" src={y} range={[-10, -60]} tint={colors.friend} side="mid" />
      <Pill label="Пойду  →" src={x} range={[12, THRESHOLD]} tint={colors.accent} side="right" />
    </View>
  );
}

/** Цветная заливка по краям экрана: слева тёмная («Мимо»), справа оранжевая («Пойду»). */
export function EdgeGlow({ x, width }: { x: SharedValue<number>; width: number }) {
  const l = useAnimatedStyle(() => ({ opacity: interpolate(x.get(), [-THRESHOLD * 1.4, -10], [0.28, 0], Extrapolation.CLAMP) }));
  const r = useAnimatedStyle(() => ({ opacity: interpolate(x.get(), [10, THRESHOLD * 1.4], [0, 0.4], Extrapolation.CLAMP) }));
  return (
    <>
      <Animated.View pointerEvents="none" style={[styles.glow, { left: 0, width: width * 0.35, backgroundColor: colors.ink }, l]} />
      <Animated.View pointerEvents="none" style={[styles.glow, { right: 0, width: width * 0.35, backgroundColor: colors.accent }, r]} />
    </>
  );
}


const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  pill: { height: 40, paddingHorizontal: 14, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 6 },
  mid: { paddingHorizontal: 12 },
  label: { fontFamily: fonts.body700, fontSize: 13.5 },
  glow: { position: 'absolute', top: 0, bottom: 0 },
});
