// Статус своего сообщения, как в Telegram: у часиков идут стрелки, пока сообщение ждёт сети или уходит
// (очередь сама отправит его, когда появится интернет), одна галочка — дошло до сервера, две — прочитано.
import { Check, CheckCheck, CircleAlert } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';
import { useEffect } from 'react';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { colors } from '../../theme';
import { useEco } from '../../state/perf';

import { TICK_LABEL, type TickKind } from '../ticks';
export { tickOf, type TickKind } from '../ticks';

export function Tick({ kind, color = '#BDB8AD', size = 13 }: { kind: TickKind; color?: string; size?: number }) {
  if (kind === 'wait') return <Spinner color={color} size={size} />;
  if (kind === 'failed') return <CircleAlert size={size} color={colors.accentText} strokeWidth={2.2} accessibilityLabel={TICK_LABEL.failed} />;
  if (kind === 'read') return <CheckCheck size={size + 2} color={colors.ok} strokeWidth={2.2} accessibilityLabel={TICK_LABEL.read} />;
  return <Check size={size + 1} color={color} strokeWidth={2.2} accessibilityLabel={TICK_LABEL.sent} />;
}

/** Часики как в Telegram: циферблат стоит, стрелки идут — минутная быстро, часовая медленно. */
function Spinner({ color, size }: { color: string; size: number }) {
  const eco = useEco();
  const minute = useSharedValue(0);
  const hour = useSharedValue(0);
  useEffect(() => {
    if (eco) return;
    minute.set(withRepeat(withTiming(1, { duration: 1000, easing: Easing.linear }), -1, false));
    hour.set(withRepeat(withTiming(1, { duration: 12000, easing: Easing.linear }), -1, false));
    return () => { cancelAnimation(minute); cancelAnimation(hour); };
  }, [eco, minute, hour]);
  const minStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${minute.get() * 360}deg` }] }));
  const hourStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${90 + hour.get() * 360}deg` }] }));
  const c = size / 2, sw = Math.max(1.3, size * 0.12);
  const hand = (len: number) => (
    <Svg width={size} height={size}><Line x1={c} y1={c} x2={c} y2={c - len} stroke={color} strokeWidth={sw} strokeLinecap="round" /></Svg>
  );
  return (
    <View style={{ width: size, height: size }} accessibilityLabel={TICK_LABEL.wait}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}><Circle cx={c} cy={c} r={c - sw / 2} stroke={color} strokeWidth={sw} fill="none" /></Svg>
      <Animated.View style={[StyleSheet.absoluteFill, hourStyle]}>{hand(size * 0.22)}</Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, minStyle]}>{hand(size * 0.32)}</Animated.View>
    </View>
  );
}
