import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

/** Горизонтальный свайп не забирает вертикальную прокрутку списка. */
export function SwipeActions({ children, onActions }: { children: ReactNode; onActions: () => void }) {
  const x = useSharedValue(0);
  const pan = Gesture.Pan().activeOffsetX([-24, 24]).failOffsetY([-12, 12])
    .onUpdate((e) => x.set(Math.max(-60, Math.min(60, e.translationX * 0.45))))
    .onEnd((e) => { if (Math.abs(e.translationX) > 55) scheduleOnRN(onActions); })
    .onFinalize(() => x.set(withTiming(0, { duration: 180 })));
  const hold=Gesture.LongPress().minDuration(450).maxDistance(12).onStart(()=>scheduleOnRN(onActions));
  const moving = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));
  return <View><GestureDetector gesture={Gesture.Race(pan,hold)}><Animated.View style={moving}>{children}</Animated.View></GestureDetector></View>;
}
