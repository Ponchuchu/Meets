// Шторка снизу и выпадающая карточка: подложка затемняется, контент выезжает ~280 мс с ease-out.
// Шторку с onClose можно смахнуть вниз пальцем — как в iOS.
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { FadeIn, FadeOut, Keyframe, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useBackClose, useCoverTabBar } from '../state/app';
import { colors } from '../theme';

const sheetIn = new Keyframe({
  0: { opacity: 0, transform: [{ translateY: 60 }] },
  100: { opacity: 1, transform: [{ translateY: 0 }] },
}).duration(280);
const sheetOut = new Keyframe({
  0: { opacity: 1, transform: [{ translateY: 0 }] },
  100: { opacity: 0, transform: [{ translateY: 60 }] },
}).duration(200);
export function Backdrop({ onPress, opacity = 0.4, label }: { onPress: () => void; opacity?: number; label: string }) {
  return (
    <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(160)} style={[StyleSheet.absoluteFill, { backgroundColor: `rgba(23,22,26,${opacity})` }]}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onPress} accessibilityRole="button" accessibilityLabel={label} />
    </Animated.View>
  );
}

/** Обёртка «смахни вниз — закроется»: тянется за пальцем, отпустил дальше 90 px или резко — onClose, иначе пружина назад. */
export function SwipeDown({ children, onClose, style }: { children: ReactNode; onClose?: () => void; style?: StyleProp<ViewStyle> }) {
  const y = useSharedValue(0);
  const pan = Gesture.Pan()
    .enabled(!!onClose)
    .activeOffsetY(12)
    .failOffsetY(-10)
    .failOffsetX([-24, 24])
    .onChange((e) => { y.set(Math.max(0, e.translationY)); })
    .onEnd((e) => {
      if (onClose && (e.translationY > 90 || e.velocityY > 900)) {
        y.set(withTiming(700, { duration: 200 }, (done) => { if (done) scheduleOnRN(onClose); }));
      } else y.set(withSpring(0, { damping: 20, stiffness: 240 }));
    });
  const st = useAnimatedStyle(() => ({ transform: [{ translateY: y.get() }] }));
  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[style, st]}>{children}</Animated.View>
    </GestureDetector>
  );
}

export function BottomSheet({ children, style, label, onClose }: { children: ReactNode; style?: StyleProp<ViewStyle>; label: string; onClose?: () => void }) {
  useCoverTabBar();
  useBackClose(onClose);
  return (
    <Animated.View entering={sheetIn} exiting={sheetOut} accessibilityViewIsModal accessibilityLabel={label} style={styles.host}>
      <SwipeDown onClose={onClose} style={[styles.sheet, style]}>
        <View style={styles.handle} />
        {children}
      </SwipeDown>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  host: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  sheet: { paddingTop: 10, paddingHorizontal: 16, paddingBottom: 30,
    backgroundColor: colors.paper, borderTopLeftRadius: 28, borderTopRightRadius: 28, gap: 16,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.line2 },
});
