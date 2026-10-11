// Надпись «от руки» (Pacifico), которая пишется слева направо: маска раскрывается за `ms`.
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View, type TextStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { fonts } from '../../theme';

export function Hand({ text, size = 64, color = '#EEE9DE', delay = 200, ms = 1250, style }: {
  text: string; size?: number; color?: string; delay?: number; ms?: number; style?: TextStyle;
}) {
  const reduce = useReducedMotion();
  const [w, setW] = useState(0);
  const p = useSharedValue(reduce ? 1 : 0);
  useEffect(() => {
    if (!w || reduce) return;
    p.set(withDelay(delay, withTiming(1, { duration: ms, easing: Easing.bezier(0.45, 0.05, 0.55, 0.95) })));
  }, [w, reduce, delay, ms, p]);
  const clip = useAnimatedStyle(() => ({ width: w ? w * p.get() + 4 : 0 }));
  const t = [styles.t, { fontSize: size, lineHeight: size * 1.6, color }, style];
  return (
    <View accessibilityRole="header" accessibilityLabel={text}>
      <Text style={[t, { opacity: 0 }]} onLayout={(e) => setW(e.nativeEvent.layout.width)}>{text}</Text>
      <Animated.View style={[StyleSheet.absoluteFill, { overflow: 'hidden' }, clip]}>
        <Text style={[t, { width: w + 8 }]} numberOfLines={1}>{text}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({ t: { fontFamily: fonts.hand, paddingHorizontal: 4 } });
