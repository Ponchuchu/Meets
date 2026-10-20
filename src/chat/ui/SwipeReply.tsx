// Ответ на сообщение как в Telegram: потяни сообщение влево — появится стрелка, отпусти — ответ.
// Долгое нажатие — меню «Ответить · Скопировать». Жесты на UI-потоке, прокрутку ленты не перехватывают.
import * as Haptics from 'expo-haptics';
import { Reply } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { Extrapolation, interpolate, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { colors } from '../../theme';

const LIMIT = 76;
const FIRE = 54;

export function SwipeReply({ children, onReply, onMenu, enabled = true }: { children: ReactNode; onReply: () => void; onMenu: () => void; enabled?: boolean }) {
  const x = useSharedValue(0);
  const fired = useSharedValue(false);
  const buzz = () => { if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined); };
  const pan = Gesture.Pan().enabled(enabled).activeOffsetX(-14).failOffsetX(18).failOffsetY([-12, 12])
    .onUpdate(e => {
      x.set(Math.max(-LIMIT, Math.min(0, e.translationX)));
      if (!fired.get() && e.translationX < -FIRE) { fired.set(true); scheduleOnRN(buzz); }
      if (fired.get() && e.translationX > -FIRE) fired.set(false);
    })
    .onEnd(() => { if (fired.get()) scheduleOnRN(onReply); fired.set(false); x.set(withSpring(0, { damping: 20, stiffness: 260 })); });
  const press = Gesture.LongPress().enabled(enabled).minDuration(380).onStart(() => { scheduleOnRN(buzz); scheduleOnRN(onMenu); });
  const move = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));
  const icon = useAnimatedStyle(() => ({
    opacity: interpolate(x.get(), [-FIRE, -16, 0], [1, 0.2, 0], Extrapolation.CLAMP),
    transform: [{ scale: interpolate(x.get(), [-FIRE, 0], [1, 0.6], Extrapolation.CLAMP) }],
  }));
  return (
    <GestureDetector gesture={Gesture.Race(pan, press)}>
      <View collapsable={false}>
        <Animated.View pointerEvents="none" style={[styles.icon, icon]}><View style={styles.circle}><Reply size={16} color={colors.paper} strokeWidth={2.2} /></View></Animated.View>
        <Animated.View style={move}>{children}</Animated.View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  icon: { position: 'absolute', right: 6, top: 0, bottom: 0, justifyContent: 'center' },
  circle: { width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(23,22,26,0.55)', alignItems: 'center', justifyContent: 'center' },
});
