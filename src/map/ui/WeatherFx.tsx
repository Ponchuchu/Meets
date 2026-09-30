// Лёгкая погода поверх карты: дождь, снег или падающие листья — чуть-чуть, для ощущения живого города.
// Не мешает нажатиям, выключается при «уменьшить движение».
import { useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withTiming } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import type { DayWeather } from '../../data/weather';

export type Fx = 'rain' | 'snow' | 'leaves' | null;

/** Какой эффект показать: дождь — в дождь, снег — в дождь при нуле и ниже, листья — осенью в ясную погоду. */
export function fxFor(w: DayWeather | null, month: number): Fx {
  if (!w) return null;
  if (w.text === 'снег' || (w.sky === 'rain' && w.temp <= 0)) return 'snow';
  if (w.sky === 'rain') return 'rain';
  if ((w.sky === 'sun' || w.sky === 'part') && month >= 8 && month <= 10) return 'leaves';
  return null;
}

const COUNT: Record<Exclude<Fx, null>, number> = { rain: 26, snow: 22, leaves: 9 };
const LEAF = 'M12 2C7 6 5 11 7 16c1.5 3.5 5 5 5 5s3.5-1.5 5-5c2-5 0-10-5-14zM12 6v14';
const LEAF_COLORS = ['#E07A2C', '#D8362A', '#F2B632', '#B5652A'];

function Particle({ kind, i, w, h }: { kind: Exclude<Fx, null>; i: number; w: number; h: number }) {
  // Псевдослучайно, но стабильно между рендерами.
  const r = (n: number) => ((Math.sin(i * 91.7 + n * 13.3) + 1) / 2);
  const x0 = r(1) * w;
  const dur = kind === 'rain' ? 900 + r(2) * 500 : kind === 'snow' ? 7000 + r(2) * 5000 : 9000 + r(2) * 6000;
  const t = useSharedValue(0);
  useEffect(() => {
    t.set(withDelay(r(3) * dur, withRepeat(withTiming(1, { duration: dur, easing: Easing.linear }), -1, false)));
  }, [t, dur]); // eslint-disable-line react-hooks/exhaustive-deps
  const sway = kind === 'rain' ? 0 : kind === 'snow' ? 18 : 46;
  const style = useAnimatedStyle(() => {
    const p = t.get();
    return {
      transform: [
        { translateX: x0 + Math.sin(p * Math.PI * 2 + i) * sway - (kind === 'rain' ? p * 40 : 0) },
        { translateY: -40 + p * (h + 80) },
        { rotate: kind === 'leaves' ? `${p * 540 + i * 40}deg` : kind === 'rain' ? '12deg' : '0deg' },
      ],
    };
  });
  if (kind === 'rain') return <Animated.View style={[styles.p, styles.rain, style]} />;
  if (kind === 'snow') return <Animated.View style={[styles.p, styles.snow, { width: 4 + r(4) * 4, height: 4 + r(4) * 4 }, style]} />;
  return (
    <Animated.View style={[styles.p, style]}>
      <Svg width={16} height={16} viewBox="0 0 24 24"><Path d={LEAF} fill={LEAF_COLORS[i % LEAF_COLORS.length]} opacity={0.8} /></Svg>
    </Animated.View>
  );
}

export function WeatherFx({ fx }: { fx: Fx }) {
  const { width, height } = useWindowDimensions();
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduce).catch(() => undefined);
  }, []);
  const list = useMemo(() => (fx ? Array.from({ length: COUNT[fx] }, (_, i) => i) : []), [fx]);
  if (!fx || reduce) return null;
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: fx === 'rain' ? 0.45 : 0.75 }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {list.map((i) => <Particle key={`${fx}-${i}`} kind={fx} i={i} w={width} h={height} />)}
    </View>
  );
}

const styles = StyleSheet.create({
  p: { position: 'absolute', left: 0, top: 0 },
  rain: { width: 1.5, height: 16, borderRadius: 1, backgroundColor: '#5B7FA6' },
  snow: { borderRadius: 4, backgroundColor: '#FFFFFF', shadowColor: '#6B675F', shadowOpacity: 0.3, shadowRadius: 1.5, shadowOffset: { width: 0, height: 0 } },
});
