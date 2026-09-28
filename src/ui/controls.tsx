// Переключатель и ползунок по макету MapFilters.
import { useRef, useState } from 'react';
import { Pressable, View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { colors } from '../theme';

export function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  const knob = useAnimatedStyle(() => ({ transform: [{ translateX: withTiming(on ? 20 : 0, { duration: 150 }) }] }));
  return (
    <Pressable onPress={() => onChange(!on)} accessibilityRole="switch" accessibilityState={{ checked: on }} accessibilityLabel={label}
      hitSlop={6} style={{ width: 52, height: 32, borderRadius: 16, backgroundColor: on ? colors.ink : colors.line2 }}>
      <Animated.View style={[{ position: 'absolute', top: 4, left: 4, width: 24, height: 24, borderRadius: 12, backgroundColor: '#FFFFFF', shadowColor: colors.ink, shadowOpacity: 0.3, shadowRadius: 1.5, shadowOffset: { width: 0, height: 1 }, elevation: 2 }, knob]} />
    </Pressable>
  );
}

export function Slider({ value, min, max, step, onChange, disabled, label }: {
  value: number; min: number; max: number; step: number; onChange: (v: number) => void; disabled?: boolean; label: string;
}) {
  const [w, setW] = useState(0);
  const left = useRef(0);
  const frac = (value - min) / (max - min);
  const setFrom = (x: number) => {
    if (disabled || !w) return;
    const f = Math.min(1, Math.max(0, x / w));
    onChange(Math.round((min + f * (max - min)) / step) * step);
  };
  const onLayout = (e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width);
  const handle = (e: GestureResponderEvent) => setFrom(e.nativeEvent.pageX - left.current);
  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ min, max, now: value }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => onChange(Math.min(max, Math.max(min, value + (e.nativeEvent.actionName === 'increment' ? step : -step))))}
      onLayout={onLayout}
      style={{ height: 28, justifyContent: 'center' }}
      onStartShouldSetResponder={() => !disabled}
      onMoveShouldSetResponder={() => !disabled}
      onResponderTerminationRequest={() => false}
      onResponderGrant={(e) => {
        // pageX трека запоминаем в момент касания: locationX прыгает, если палец над кружком.
        left.current = e.nativeEvent.pageX - e.nativeEvent.locationX;
        (e.currentTarget as unknown as { measure?: (cb: (...a: number[]) => void) => void }).measure?.((_x, _y, _w, _h, px) => { left.current = px; });
        handle(e);
      }}
      onResponderMove={handle}
    >
      <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.sand }}>
        <View style={{ width: `${frac * 100}%`, height: 6, borderRadius: 3, backgroundColor: colors.ink }} />
      </View>
      <View pointerEvents="none" style={{ position: 'absolute', left: Math.max(0, frac * w - 8), width: 16, height: 16, borderRadius: 8, backgroundColor: colors.ink }} />
    </View>
  );
}
