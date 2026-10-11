// «Мимо · название · Вернуть»: тонкая тёмная плашка над нижней панелью, как «отменить» в Telegram: кружок с отсчётом секунд,
// тающая полоска внизу. Сама уходит через `ms`. Новая плашка (другой key) запускает отсчёт заново.
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, FadeOut, SlideInDown, useAnimatedProps, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { colors, fonts } from '../theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const R = 9;
const C = 2 * Math.PI * R;

export function UndoBar({ text, onUndo, onGone, bottom, ms = 5000 }: { text: string; onUndo: () => void; onGone: () => void; bottom: number; ms?: number }) {
  const p = useSharedValue(0);
  const [left, setLeft] = useState(Math.ceil(ms / 1000));
  useEffect(() => {
    p.set(withTiming(1, { duration: ms, easing: Easing.linear }));
    const tick = setInterval(() => setLeft((n) => Math.max(1, n - 1)), 1000);
    const gone = setTimeout(onGone, ms);
    return () => { clearInterval(tick); clearTimeout(gone); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const ring = useAnimatedProps(() => ({ strokeDashoffset: C * p.get() }));
  const bar = useAnimatedStyle(() => ({ transform: [{ scaleX: 1 - p.get() }] }));
  return (
    <Animated.View entering={SlideInDown.duration(280)} exiting={FadeOut.duration(160)} style={[styles.root, { bottom }]} accessibilityLiveRegion="polite">
      <View style={styles.rg}>
        <Svg width={22} height={22} viewBox="0 0 22 22" style={{ transform: [{ rotate: '-90deg' }] }}>
          <Circle cx={11} cy={11} r={R} stroke="rgba(238,233,222,0.18)" strokeWidth={2} fill="none" />
          <AnimatedCircle cx={11} cy={11} r={R} stroke={colors.card} strokeWidth={2} fill="none" strokeLinecap="round" strokeDasharray={[C, C]} animatedProps={ring} />
        </Svg>
        <Text style={styles.n}>{left}</Text>
      </View>
      <Text style={styles.tx} numberOfLines={1}>{text}</Text>
      <Pressable onPress={onUndo} hitSlop={10} accessibilityRole="button" accessibilityLabel="Вернуть карточку" style={styles.btn}>
        <Text style={styles.btnText}>Вернуть</Text>
      </Pressable>
      <Animated.View style={[styles.bar, bar]} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'absolute', left: 22, right: 22, height: 38, borderRadius: 13, backgroundColor: 'rgba(23,22,26,0.94)', flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 8, paddingRight: 12, overflow: 'hidden', zIndex: 60 },
  rg: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
  n: { position: 'absolute', fontFamily: fonts.body700, fontSize: 10, color: colors.card },
  tx: { flex: 1, fontFamily: fonts.body600, fontSize: 12.5, color: 'rgba(238,233,222,0.85)' },
  btn: { minHeight: 34, justifyContent: 'center' },
  btnText: { fontFamily: fonts.body700, fontSize: 13, color: '#FF8A5E' },
  bar: { position: 'absolute', left: 0, bottom: 0, height: 2, width: '100%', backgroundColor: '#FF8A5E', transformOrigin: 'left' },
});
