// Статус своего сообщения, как в Telegram: часики крутятся, пока сообщение ждёт сети или уходит
// (очередь сама отправит его, когда появится интернет), одна галочка — дошло до сервера, две — прочитано.
import { Check, CheckCheck, CircleAlert, Clock3 } from 'lucide-react-native';
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

function Spinner({ color, size }: { color: string; size: number }) {
  const eco = useEco();
  const turn = useSharedValue(0);
  useEffect(() => {
    if (eco) return;
    turn.set(withRepeat(withTiming(1, { duration: 1400, easing: Easing.linear }), -1, false));
    return () => cancelAnimation(turn);
  }, [eco, turn]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.get() * 360}deg` }] }));
  return <Animated.View style={style} accessibilityLabel={TICK_LABEL.wait}><Clock3 size={size} color={color} strokeWidth={2.2} /></Animated.View>;
}
