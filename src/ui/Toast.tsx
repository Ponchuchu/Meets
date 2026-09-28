// Подсказка снизу: тёмная плашка с текстом и кнопкой. У «Вернуть» — полоска-таймер, которая сжимается за 5 с.
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, FadeOutDown, Keyframe, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { colors, fonts } from '../theme';

const enter = new Keyframe({ 0: { opacity: 0, transform: [{ translateY: 14 }] }, 100: { opacity: 1, transform: [{ translateY: 0 }] } }).duration(250);

export interface ToastData {
  text: string;
  cta?: string;
  onCta?: () => void;
  /** Акцентная кнопка и таймер (для «Вернуть»). */
  timerMs?: number;
}

export function Toast({ t, style }: { t: ToastData; style?: StyleProp<ViewStyle> }) {
  const timed = !!t.timerMs;
  const progress = useSharedValue(1);
  useEffect(() => {
    if (!t.timerMs) return;
    progress.value = 1;
    progress.value = withTiming(0, { duration: t.timerMs, easing: Easing.linear });
  }, [t, progress]);
  const bar = useAnimatedStyle(() => ({ transform: [{ scaleX: progress.value }] }));
  return (
    <Animated.View entering={enter} exiting={FadeOutDown.duration(180)} accessibilityRole="alert" accessibilityLiveRegion="polite" style={[styles.toast, style]}>
      <Text style={styles.text}>{t.text}</Text>
      {t.cta && (
        <Pressable onPress={t.onCta} accessibilityRole="button" hitSlop={4}
          style={[styles.cta, timed || t.cta !== 'Отменить' ? { backgroundColor: colors.accent } : { backgroundColor: 'transparent' }]}>
          <Text style={[styles.ctaText, { color: timed || t.cta !== 'Отменить' ? colors.ink : colors.paper }]}>{t.cta}</Text>
        </Pressable>
      )}
      {timed && (
        <View style={styles.track} pointerEvents="none">
          <Animated.View style={[styles.bar, bar, { transformOrigin: 'left' }]} />
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    minHeight: 54, paddingVertical: 8, paddingRight: 8, paddingLeft: 16, borderRadius: 18, backgroundColor: colors.ink,
    flexDirection: 'row', alignItems: 'center', gap: 10, overflow: 'hidden',
    shadowColor: colors.ink, shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 10 }, elevation: 10,
  },
  text: { flex: 1, fontFamily: fonts.body400, fontSize: 13.5, lineHeight: 18.2, color: colors.paper },
  cta: { height: 38, paddingHorizontal: 12, borderRadius: 12, justifyContent: 'center' },
  ctaText: { fontFamily: fonts.body600, fontSize: 13 },
  track: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 3 },
  bar: { height: 3, backgroundColor: colors.accent },
});
