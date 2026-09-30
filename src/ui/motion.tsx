// Анимации регистрации: блоки появляются снизу с лёгким смещением, пины «плавают».
import { useEffect, type ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { Easing, FadeInDown, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

export function Appear({ index = 0, children, style }: { index?: number; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <Animated.View entering={FadeInDown.delay(60 + index * 70).duration(380).springify().damping(18)} style={style}>
      {children}
    </Animated.View>
  );
}

/** Медленное покачивание вверх-вниз на 6 px (suFloat в макете). */
export function Float({ children, duration = 4000, style, delay = 0 }: { children: ReactNode; duration?: number; style?: StyleProp<ViewStyle>; delay?: number }) {
  const y = useSharedValue(0);
  useEffect(() => {
    const t = setTimeout(() => {
      y.value = withRepeat(withTiming(-6, { duration: duration / 2, easing: Easing.inOut(Easing.sin) }), -1, true);
    }, delay);
    return () => clearTimeout(t);
  }, [y, duration, delay]);
  const s = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  return <Animated.View style={[style, s]}>{children}</Animated.View>;
}
