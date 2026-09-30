// Карточка поверх карты, которую можно смахнуть вниз или закрыть крестиком — остаётся чистая карта.
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { colors } from '../theme';
import { Ic, IC } from './Ic';

const THRESHOLD = 70;

export function Dismissible({ children, onDismiss, label }: { children: ReactNode; onDismiss: () => void; label: string }) {
  const y = useSharedValue(0);
  const close = () => {
    y.set(withTiming(320, { duration: 200 }, (done) => { if (done) scheduleOnRN(onDismiss); }));
  };
  const pan = Gesture.Pan()
    .activeOffsetY(12)
    .failOffsetX([-20, 20])
    .onChange((e) => { y.set(Math.max(0, e.translationY)); })
    .onEnd((e) => {
      if (e.translationY > THRESHOLD || e.velocityY > 800) y.set(withTiming(320, { duration: 180 }, (done) => { if (done) scheduleOnRN(onDismiss); }));
      else y.set(withSpring(0, { damping: 18, stiffness: 220 }));
    });
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.get() }], opacity: 1 - Math.min(0.6, y.get() / 400) }));
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
