// Живая заставка V6Splash (V6.md §2.1): один раз за холодный запуск, ≤ 3,4 с, тап — пропустить.
// Фон — тот же #F0521F, что у системной заставки. «рядом» пишется от руки → точка падает и отскакивает, кольцо → карта открывается кругом из точки.
// Сразу после «Добро пожаловать» не показываем (приветствие уже было) — флаг skipSplash().
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, FadeOut, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSequence, withTiming } from 'react-native-reanimated';
import { create } from 'zustand';
import { colors } from '../../theme';
import { Hand } from './Hand';

let played = false;
export const skipSplash = () => { played = true; useIntro.getState().set(false); };

/** Идёт ли заставка — обучение ждёт, пока она закончится. */
export const useIntro = create<{ splash: boolean; set: (v: boolean) => void }>((set) => ({ splash: !played, set: (splash) => set({ splash }) }));

const B = 1400; // толщина «рамки» вокруг растущего круга

export function Splash() {
  const reduce = useReducedMotion();
  const { width, height } = useWindowDimensions();
  const [on, setOn] = useState(!played);
  const drop = useSharedValue(-height / 2);
  const squash = useSharedValue(1);
  const ring = useSharedValue(0);
  const hole = useSharedValue(0);
  const word = useSharedValue(1);

  const end = () => { played = true; setOn(false); useIntro.getState().set(false); };

  useEffect(() => {
    if (!on) return;
    if (reduce) { const t = setTimeout(end, 700); return () => clearTimeout(t); }
    const ease = Easing.bezier(0.3, 0, 0.2, 1);
    drop.set(withDelay(1450, withTiming(0, { duration: 200, easing: Easing.in(Easing.quad) })));
    squash.set(withDelay(1650, withSequence(withTiming(0.62, { duration: 90 }), withTiming(1.12, { duration: 140 }), withTiming(1, { duration: 120 }))));
    ring.set(withDelay(1650, withTiming(1, { duration: 650, easing: Easing.out(Easing.quad) })));
    word.set(withDelay(1900, withTiming(0, { duration: 300 })));
    hole.set(withDelay(2200, withTiming(1, { duration: 650, easing: ease })));
    const t = setTimeout(end, 2950);
    return () => clearTimeout(t);
  }, [on]); // eslint-disable-line react-hooks/exhaustive-deps

  const maxR = Math.hypot(width, height) / 2 + 20;
  const frame = useAnimatedStyle(() => {
    const r = hole.get() * maxR;
    const s = 2 * (r + B);
    return { width: s, height: s, borderRadius: s / 2, left: width / 2 - s / 2, top: height / 2 - s / 2 };
  });
  const dot = useAnimatedStyle(() => ({
    opacity: 1 - hole.get(),
    transform: [{ translateY: drop.get() }, { scaleY: squash.get() }, { scaleX: 2 - squash.get() }],
  }));
  const ringSt = useAnimatedStyle(() => ({ opacity: (1 - ring.get()) * (ring.get() > 0 ? 1 : 0), transform: [{ scale: 0.4 + ring.get() * 3 }] }));
  const wordSt = useAnimatedStyle(() => ({ opacity: word.get() }));

  if (!on) return null;
  return (
    <Animated.View style={StyleSheet.absoluteFill} exiting={FadeOut.duration(200)}>
      <Pressable style={StyleSheet.absoluteFill} onPress={end} accessibilityRole="button" accessibilityLabel="Пропустить заставку">
        <Animated.View style={[styles.frame, frame]} />
        <Animated.View style={[styles.word, { top: height / 2 - 150 }, wordSt]} pointerEvents="none">
          <Hand text="рядом" size={72} delay={200} ms={1250} />
        </Animated.View>
        <View style={[styles.dotWrap, { left: width / 2 - 13, top: height / 2 - 13 }]} pointerEvents="none">
          <Animated.View style={[styles.ring, ringSt]} />
          <Animated.View style={[styles.dot, dot]} />
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  frame: { position: 'absolute', borderWidth: B, borderColor: colors.accent },
  word: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  dotWrap: { position: 'absolute', width: 26, height: 26, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.ink, borderWidth: 4, borderColor: '#FBFAF6' },
  ring: { position: 'absolute', width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: '#FBFAF6' },
});
