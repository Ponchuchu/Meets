// Моя точка (V6MapMove, FIX1 И2 п.6): оранжевая #F0521F с белым кольцом, мягкий пульс и оранжевый конус — куда смотрит телефон.
// Направление — компас телефона (watchHeadingAsync), сглаживание 150 мс; конус учитывает поворот карты.
import * as Location from 'expo-location';
import { useEffect } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming, type SharedValue } from 'react-native-reanimated';
import Svg, { Defs, Path, RadialGradient, Stop } from 'react-native-svg';

/** Направление телефона в градусах (0 — север), плавно и без прыжка через 360°. */
export function useHeading(): SharedValue<number> {
  const h = useSharedValue(0);
  useEffect(() => {
    if (Platform.OS === 'web') return;
    let sub: Location.LocationSubscription | null = null;
    let cancelled = false;
    void Location.watchHeadingAsync((e) => {
      const deg = e.trueHeading >= 0 ? e.trueHeading : e.magHeading;
      const cur = h.get();
      const d = ((deg - (cur % 360) + 540) % 360) - 180; // кратчайший поворот
      h.set(withTiming(cur + d, { duration: 150, easing: Easing.linear }));
    }).then((s) => { if (cancelled) s.remove(); else sub = s; }).catch(() => undefined);
    return () => { cancelled = true; sub?.remove(); };
  }, [h]);
  return h;
}

export function MeDot({ heading, bearing, dim }: { heading?: SharedValue<number>; bearing?: SharedValue<number>; dim?: boolean }) {
  const pulse = useSharedValue(0);
  useEffect(() => { pulse.set(withRepeat(withTiming(1, { duration: 2000, easing: Easing.out(Easing.quad) }), -1, false)); }, [pulse]);
  const cone = useAnimatedStyle(() => ({ transform: [{ rotate: `${(heading?.get() ?? 0) - (bearing?.get() ?? 0)}deg` }] }));
  const ring = useAnimatedStyle(() => ({ opacity: 0.35 * (1 - pulse.get()), transform: [{ scale: 0.6 + pulse.get() * 1.6 }] }));
  return (
    <View style={[styles.anchor, dim && { opacity: 0.35 }]} pointerEvents="none" accessibilityLabel="Это ты">
      {heading && (
        <Animated.View style={[styles.cone, cone]}>
          <Svg width={72} height={72} viewBox="0 0 120 120">
            <Defs>
              <RadialGradient id="meCone" cx="60" cy="60" r="56" gradientUnits="userSpaceOnUse">
                <Stop offset="0" stopColor="#F0521F" stopOpacity={0.55} />
                <Stop offset="1" stopColor="#F0521F" stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Path d="M60 60L37 8A56 56 0 0 1 83 8Z" fill="url(#meCone)" />
          </Svg>
        </Animated.View>
      )}
      <Animated.View style={[styles.pulse, ring]} />
      <View style={styles.dot} />
    </View>
  );
}

const styles = StyleSheet.create({
  anchor: { width: 72, height: 72, alignItems: 'center', justifyContent: 'center', overflow: 'visible' },
  cone: { position: 'absolute', width: 72, height: 72 },
  pulse: { position: 'absolute', width: 40, height: 40, borderRadius: 20, backgroundColor: '#F0521F' },
  dot: { position: 'absolute', width: 24, height: 24, borderRadius: 12, backgroundColor: '#F0521F', borderWidth: 4, borderColor: '#EEE9DE', shadowColor: '#17161A', shadowOpacity: 0.3, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 4 },
});
