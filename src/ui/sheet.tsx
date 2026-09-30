// Шторка снизу и выпадающая карточка: подложка затемняется, контент выезжает ~280 мс с ease-out.
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { FadeIn, FadeOut, Keyframe } from 'react-native-reanimated';
import { colors } from '../theme';

const sheetIn = new Keyframe({
  0: { opacity: 0, transform: [{ translateY: 60 }] },
  100: { opacity: 1, transform: [{ translateY: 0 }] },
}).duration(280);
const sheetOut = new Keyframe({
  0: { opacity: 1, transform: [{ translateY: 0 }] },
  100: { opacity: 0, transform: [{ translateY: 60 }] },
}).duration(200);
const dropIn = new Keyframe({
  0: { opacity: 0, transform: [{ translateY: -14 }] },
  100: { opacity: 1, transform: [{ translateY: 0 }] },
}).duration(220);

export function Backdrop({ onPress, opacity = 0.4, label }: { onPress: () => void; opacity?: number; label: string }) {
  return (
    <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(160)} style={[StyleSheet.absoluteFill, { backgroundColor: `rgba(23,22,26,${opacity})` }]}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onPress} accessibilityRole="button" accessibilityLabel={label} />
    </Animated.View>
  );
}

export function BottomSheet({ children, style, label }: { children: ReactNode; style?: StyleProp<ViewStyle>; label: string }) {
  return (
    <Animated.View entering={sheetIn} exiting={sheetOut} accessibilityViewIsModal accessibilityLabel={label} style={[styles.sheet, style]}>
      <View style={styles.handle} />
      {children}
    </Animated.View>
  );
}

export function DropCard({ children, style, label }: { children: ReactNode; style?: StyleProp<ViewStyle>; label: string }) {
  return (
    <Animated.View entering={dropIn} exiting={FadeOut.duration(150)} accessibilityViewIsModal accessibilityLabel={label} style={style}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: 10, paddingHorizontal: 16, paddingBottom: 30,
    backgroundColor: colors.paper, borderTopLeftRadius: 28, borderTopRightRadius: 28, gap: 16,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.line2 },
});
