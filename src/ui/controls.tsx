// Переключатель и ползунок по макету MapFilters.
import { Pressable } from 'react-native';
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
