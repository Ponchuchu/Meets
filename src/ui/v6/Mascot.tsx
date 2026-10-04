// Наклейки-колобки из входа и «добро пожаловать» (V5Login): оранжевый шарик с глазками, улыбкой, подписью.
// Плавают на месте (дрейф ±6 px и поворот), при «уменьшить движение» — стоят.
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Defs, Ellipse, Path, RadialGradient, Stop } from 'react-native-svg';
import { colors, fonts } from '../../theme';

type Kind = 'blob' | 'drop' | 'cup' | 'heart';
const BODY: Record<Kind, string> = {
  blob: 'M60 14c26 0 44 18 44 44s-18 44-44 44-44-18-44-44 18-44 44-44z',
  drop: 'M60 6c18 22 40 40 40 62 0 22-18 36-40 36s-40-14-40-36c0-22 22-40 40-62z',
  cup: 'M22 40h64v34c0 16-12 28-28 28h-8c-16 0-28-12-28-28z M86 50h8a12 12 0 010 24h-8',
  heart: 'M60 100C24 76 12 58 12 42c0-14 10-24 23-24 10 0 18 6 25 16 7-10 15-16 25-16 13 0 23 10 23 24 0 16-12 34-48 58z',
};
const TONE: Record<Kind, [string, string, string]> = {
  blob: ['#FFB08F', '#F0521F', '#C53A12'],
  drop: ['#FFB08F', '#F0521F', '#C53A12'],
  cup: ['#F2D3A0', '#C68A3A', '#8A5A1E'],
  heart: ['#FFE0D2', '#F7B9A3', '#E58B6E'],
};

export function Mascot({ kind = 'blob', size = 72, label, x, y, delay = 0, rot = 0 }: {
  kind?: Kind; size?: number; label?: string; x: number; y: number; delay?: number; rot?: number;
}) {
  const reduce = useReducedMotion();
  const t = useSharedValue(0);
  useEffect(() => {
    if (reduce) return;
    t.set(withDelay(delay, withRepeat(withTiming(1, { duration: 2600 + delay, easing: Easing.inOut(Easing.sin) }), -1, true)));
  }, [reduce, delay, t]);
  const st = useAnimatedStyle(() => ({ transform: [{ translateY: -6 + t.get() * 12 }, { rotate: `${rot - 4 + t.get() * 8}deg` }] }));
  const [hi, base, lo] = TONE[kind];
  const id = `g-${kind}`;
  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: x, top: y, width: size, height: size }, st]} accessibilityElementsHidden>
      <Svg width={size} height={size} viewBox="-6 -10 132 132">
        <Defs>
          <RadialGradient id={id} cx="38%" cy="30%" r="80%">
            <Stop offset="0" stopColor={hi} /><Stop offset="0.6" stopColor={base} /><Stop offset="1" stopColor={lo} />
          </RadialGradient>
        </Defs>
        <Ellipse cx="60" cy="114" rx="34" ry="5" fill="rgba(23,22,26,0.18)" />
        <Path d={BODY[kind]} fill={`url(#${id})`} stroke="#FFFFFF" strokeWidth={7} strokeLinejoin="round" />
        <Path d={BODY[kind]} fill="none" stroke={colors.ink} strokeWidth={3} strokeLinejoin="round" />
        <Ellipse cx="42" cy="40" rx="9" ry="5" fill="rgba(255,255,255,0.55)" transform="rotate(-30 42 40)" />
        <Circle cx="48" cy="58" r="5" fill={colors.ink} /><Circle cx="72" cy="58" r="5" fill={colors.ink} />
        <Circle cx="49.5" cy="56.5" r="1.6" fill="#FFF" /><Circle cx="73.5" cy="56.5" r="1.6" fill="#FFF" />
        <Path d="M50 72c6 7 14 7 20 0" stroke={colors.ink} strokeWidth={4} strokeLinecap="round" fill="none" />
        <Ellipse cx="40" cy="70" rx="5" ry="3" fill="rgba(255,120,120,0.5)" /><Ellipse cx="80" cy="70" rx="5" ry="3" fill="rgba(255,120,120,0.5)" />
      </Svg>
      {!!label && <Text style={[styles.label, { fontSize: size * 0.2 }]}>{label}</Text>}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  label: {
    position: 'absolute', bottom: -2, left: -10, right: -10, textAlign: 'center', fontFamily: fonts.display800, color: '#FFFFFF',
    textShadowColor: colors.ink, textShadowRadius: 2, textShadowOffset: { width: 1, height: 1 }, transform: [{ rotate: '-8deg' }],
  },
});

/** Набор колобков, как в макете входа: «ИДУ!», «КОФЕ?», «ОГОНЬ» и помахивающий. */
export function MascotField({ variant = 'hello' }: { variant?: 'hello' | 'welcome' }) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Mascot kind="drop" x={40} y={76} size={68} label="ИДУ!" rot={-6} />
      <Mascot kind="cup" x={258} y={58} size={60} label="КОФЕ?" delay={300} rot={8} />
      <Mascot kind="blob" x={168} y={110} size={74} delay={600} />
      <Mascot kind="drop" x={46} y={206} size={66} label="ОГОНЬ" delay={900} rot={-4} />
      {variant === 'welcome' && <Mascot kind="heart" x={316} y={640} size={60} delay={450} rot={10} />}
      {variant === 'welcome' && <Mascot kind="blob" x={320} y={130} size={56} delay={1200} />}
    </View>
  );
}
