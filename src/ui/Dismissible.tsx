// Карточка поверх карты: смахнуть вниз (или влево/вправо, если horizontal) — закрыть, крестик — закрыть,
// потянуть вверх — раскрыть целиком (onExpand). Отпустил не дотянув — пружина возвращает на место.
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { colors } from '../theme';
import { Ic, IC } from './Ic';

const THRESHOLD = 70;
const SIDE = 90;
const UP = 60;
const BACK = { damping: 18, stiffness: 220 };

export function Dismissible({ children, onDismiss, onExpand, horizontal, label }: {
  children: ReactNode; onDismiss: () => void; onExpand?: () => void; horizontal?: boolean; label: string;
}) {
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const close = () => {
    y.set(withTiming(320, { duration: 200 }, (done) => { if (done) scheduleOnRN(onDismiss); }));
  };
  const pan = Gesture.Pan()
    .activeOffsetY([-12, 12])
    .activeOffsetX(horizontal ? [-14, 14] : [-1000, 1000])
    .failOffsetX(horizontal ? [-1000, 1000] : [-20, 20])
    .onChange((e) => {
      if (horizontal) x.set(e.translationX);
      // Вверх тянется туго (резинка), вниз — свободно.
      y.set(e.translationY > 0 ? e.translationY : onExpand ? e.translationY * 0.45 : 0);
    })
    .onEnd((e) => {
      if (horizontal && (Math.abs(e.translationX) > SIDE || Math.abs(e.velocityX) > 900)) {
        const dir = e.translationX + e.velocityX * 0.1 > 0 ? 1 : -1;
        x.set(withTiming(dir * 520, { duration: 200 }, (done) => { if (done) scheduleOnRN(onDismiss); }));
        return;
      }
      if (onExpand && (e.translationY < -UP || e.velocityY < -700)) {
        y.set(withTiming(-40, { duration: 120 }, () => { y.set(withSpring(0, BACK)); }));
        x.set(withSpring(0, BACK));
        scheduleOnRN(onExpand);
        return;
      }
      if (e.translationY > THRESHOLD || e.velocityY > 800) {
        y.set(withTiming(320, { duration: 180 }, (done) => { if (done) scheduleOnRN(onDismiss); }));
        return;
      }
      x.set(withSpring(0, BACK));
      y.set(withSpring(0, BACK));
    });
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: x.get() }, { translateY: y.get() }, { rotate: `${x.get() / 40}deg` }],
    opacity: 1 - Math.min(0.6, Math.max(Math.abs(x.get()) / 500, Math.max(0, y.get()) / 400)),
  }));
  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={style}>
        <View style={styles.handleZone} pointerEvents="none"><View style={styles.handle} /></View>
        {children}
        <Pressable onPress={close} style={styles.x} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Закрыть: ${label}`}>
          <Ic d={IC.close} size={14} color={colors.ink} w={2.4} />
        </Pressable>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  handleZone: { position: 'absolute', top: 6, left: 0, right: 0, alignItems: 'center', zIndex: 2 },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.line2 },
  x: { position: 'absolute', top: -14, right: 10, width: 30, height: 30, borderRadius: 15, backgroundColor: colors.cardAlt, alignItems: 'center', justifyContent: 'center', zIndex: 3, shadowColor: colors.ink, shadowOpacity: 0.16, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 4 },
});
