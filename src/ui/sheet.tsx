// Шторка снизу и выпадающая карточка: подложка затемняется, контент выезжает ~280 мс с ease-out.
// Шторку с onClose можно смахнуть вниз пальцем — как в iOS.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Keyboard, Pressable, ScrollView, StyleSheet, useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native';
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

/**
 * Насколько клавиатура перекрывает низ шторки: измеряем реально (в окне, которое Android не сжимает, клавиатура ложится
 * поверх), поэтому поле ввода не прячется под ней, а в сжимаемом окне лишнего подъёма нет.
 */
function useKeyboardLift(host: React.RefObject<View | null>): number {
  const [lift, setLift] = useState(0);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', (e) => {
      const top = e.endCoordinates.screenY;
      setTimeout(() => host.current?.measureInWindow((_x, y, _w, h) => setLift(Math.max(0, Math.round(y + h - top)))), 60);
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => setLift(0));
    return () => { show.remove(); hide.remove(); };
  }, [host]);
  return lift;
}

export function BottomSheet({ children, style, label, onClose, scroll = false }: {
  children: ReactNode; style?: StyleProp<ViewStyle>; label: string; onClose?: () => void;
  /** Содержимое прокручивается (длинные формы с полями ввода): с клавиатурой помещается и всё достижимо. */
  scroll?: boolean;
}) {
  useCoverTabBar();
  useBackClose(onClose);
  const y = useSharedValue(0);
  const hostRef = useRef<View>(null);
  const lift = useKeyboardLift(hostRef);
  const { height: winH } = useWindowDimensions();
  const pan = Gesture.Pan().enabled(!!onClose).activeOffsetY(12)
    .onUpdate((e) => y.set(Math.max(0, e.translationY)))
    .onEnd((e) => {
      if (onClose && (e.translationY > 90 || e.velocityY > 900)) scheduleOnRN(onClose);
      y.set(withSpring(0, { damping: 28, overshootClamping: true }));
    });
  const moving = useAnimatedStyle(() => ({ transform: [{ translateY: y.get() }] }));
  return (
    <Animated.View entering={sheetIn} exiting={sheetOut} accessibilityViewIsModal accessibilityLabel={label} style={[styles.host, { bottom: lift }]}>
      <View ref={hostRef} collapsable={false}>
        <Animated.View style={[styles.sheet, style, scroll && { maxHeight: Math.max(140, winH - lift - 40) }, moving]}>
          <GestureDetector gesture={pan}>
            <View style={{ height: 28, justifyContent: 'center' }} accessibilityLabel="Потяни вниз, чтобы закрыть"><View style={styles.handle} /></View>
          </GestureDetector>
          {scroll ? (
            <ScrollView style={{ maxHeight: Math.max(100, winH - lift - 120), flexShrink: 1 }} contentContainerStyle={{ gap: 16, paddingBottom: 8 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} nestedScrollEnabled>
              {children}
            </ScrollView>
          ) : children}
        </Animated.View>
      </View>
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
