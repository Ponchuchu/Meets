// «Живые рамки» (FIX3 Ф11, просьба владельца 20 октября): не только Алматы — пузырь, капля, неон, сияние, космос,
// «Тесла», лава, корона. Форма у каждой своя; в профиле и выборе — анимация на UI-потоке (орбита, дыхание, мерцание,
// у пузыря — пробегающий радужный блик),
// на карте и в маленьких аватарках — тот же рисунок без движения, чтобы не тратить батарею.
import { memo, useEffect, useId } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import Svg, { Circle, ClipPath, Defs, Ellipse, G, Image as SvgImage, LinearGradient, Path, RadialGradient, Stop, Text as SvgText } from 'react-native-svg';
import { photo } from '../data/photos';
import { colors, fonts } from '../theme';
import { shapePath, type ShapeId } from './shapes';

export type FxKind = 'bubble' | 'drop' | 'neon' | 'aurora' | 'cosmos' | 'tesla' | 'lava' | 'crown';

/** Замкнутый контур вокруг центра (32,32): r(t) = r·k(t). */
function contour(k: (t: number) => number, r: number, n = 120): string {
  const pts: string[] = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    pts.push(`${(32 + r * k(t) * Math.cos(t)).toFixed(2)} ${(32 + r * k(t) * Math.sin(t)).toFixed(2)}`);
  }
  return `M${pts.join('L')}Z`;
}
const CIRCLE = (r: number) => `M${32 - r} 32a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;
const BLOB = contour(t => 1 + 0.07 * Math.sin(3 * t) + 0.045 * Math.cos(5 * t + 1), 28.5);
const LAVA = contour(t => 1 + 0.08 * Math.sin(4 * t + 0.6) + 0.04 * Math.sin(7 * t), 28.5);
const WAVE = contour(t => 1 + 0.055 * Math.cos(9 * t), 28.5);
const SQUIRCLE = contour(t => 0.96 / Math.pow(Math.abs(Math.cos(t)) ** 4 + Math.abs(Math.sin(t)) ** 4, 0.25), 28);
/** Молния по кругу: ломаная с зубцами. */
const BOLT = (a0: number, len: number) => {
  const pts: string[] = [];
  for (let i = 0; i <= 8; i++) {
    const a = a0 + (len * i) / 8;
    const r = 28.5 + (i % 2 ? 3.2 : -1.2);
    pts.push(`${(32 + r * Math.cos(a)).toFixed(2)} ${(32 + r * Math.sin(a)).toFixed(2)}`);
  }
  return `M${pts.join('L')}`;
};

interface Look { aperture: number; base: string; outline: string; paper: string }
type Form = Exclude<ShapeId, 'auto'> | undefined;
/** Круглые детали кольца повторяют выбранную форму. */
const ringOf = (form: Form, r: number) => (form ? shapePath(form, r) : CIRCLE(r));
const lookOf = (kind: FxKind, form: Form): Look => (form ? { ...LOOK[kind], base: shapePath(form, 29), outline: shapePath(form, 28.5) } : LOOK[kind]);
const LOOK: Record<FxKind, Look> = {
  bubble: { aperture: 23, base: CIRCLE(29), outline: CIRCLE(29), paper: '#EAF4F7' },
  drop: { aperture: 22, base: BLOB, outline: BLOB, paper: '#DDEBF7' },
  neon: { aperture: 22.5, base: CIRCLE(29), outline: CIRCLE(29), paper: '#16121F' },
  aurora: { aperture: 22.5, base: WAVE, outline: WAVE, paper: '#10202A' },
  cosmos: { aperture: 21.5, base: CIRCLE(29.5), outline: CIRCLE(29.5), paper: '#0F1430' },
  tesla: { aperture: 22.5, base: CIRCLE(28.5), outline: CIRCLE(28.5), paper: '#0E1726' },
  lava: { aperture: 22, base: LAVA, outline: LAVA, paper: '#2A0F08' },
  crown: { aperture: 22, base: SQUIRCLE, outline: SQUIRCLE, paper: '#FFF3D6' },
};

/** Подложка под фото — неподвижная. */
function Base({ kind, gid, form }: { kind: FxKind; gid: string; form: Form }) {
  const L = lookOf(kind, form);
  return <>
    <Defs>
      <RadialGradient id={`${gid}bg`} cx="50%" cy="40%" r="60%">
        <Stop offset="0" stopColor={L.paper} stopOpacity={1} />
        <Stop offset="1" stopColor={kind === 'bubble' || kind === 'drop' || kind === 'crown' ? '#FFFFFF' : '#05060B'} stopOpacity={kind === 'bubble' ? 0.4 : 1} />
      </RadialGradient>
    </Defs>
    <Path d={L.base} fill={`url(#${gid}bg)`} stroke="#FFFCF4" strokeWidth={kind === 'neon' || kind === 'cosmos' || kind === 'tesla' || kind === 'aurora' || kind === 'lava' ? 1.2 : 3.5} strokeLinejoin="round" />
    {kind === 'cosmos' && [[10, 18, 0.9], [52, 12, 0.7], [57, 44, 1], [8, 46, 0.6], [44, 57, 0.8], [20, 56, 0.5], [32, 4.5, 0.7]].map(([x, y, r]) => <Circle key={`${x}${y}`} cx={x} cy={y} r={r} fill="#FFFFFF" opacity={0.85} />)}
    {kind === 'crown' && <Path d="M19 7L24 13L32 4L40 13L45 7L43 17H21Z" fill="#E8B73A" stroke="#9E7417" strokeWidth={1} strokeLinejoin="round" />}
    {kind === 'lava' && [[12, 50, 2.2], [52, 14, 1.6], [56, 48, 1.3]].map(([x, y, r]) => <Circle key={`${x}${y}`} cx={x} cy={y} r={r} fill="#FF9A3D" opacity={0.85} />)}
  </>;
}

/** Слой поверх: кольцо и детали, которые двигаются. */
function Ring({ kind, gid, form }: { kind: FxKind; gid: string; form: Form }) {
  const L = lookOf(kind, form);
  if (kind === 'bubble') return <>
    <Defs><LinearGradient id={`${gid}ir`} x1="0" y1="0" x2="1" y2="1">
      <Stop offset="0" stopColor="#FF9AD5" /><Stop offset="0.3" stopColor="#8EE7FF" /><Stop offset="0.55" stopColor="#FFF29A" /><Stop offset="0.8" stopColor="#B49BFF" /><Stop offset="1" stopColor="#FF9AD5" />
    </LinearGradient></Defs>
    <Path d={ringOf(form, 26)} fill="none" stroke={`url(#${gid}ir)`} strokeWidth={5} opacity={0.85} />
  </>;
  if (kind === 'drop') return <>
    <Defs><LinearGradient id={`${gid}dr`} x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#7CC3FF" /><Stop offset="1" stopColor="#2457C9" /></LinearGradient></Defs>
    <Path d={L.outline} fill="none" stroke={`url(#${gid}dr)`} strokeWidth={4.2} strokeLinejoin="round" />
    <Path d="M16 20Q20 13 27 11" fill="none" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" opacity={0.85} />
  </>;
  if (kind === 'neon') return <G fill="none">
    <Path d={ringOf(form, 26.5)} stroke="#FF3FA4" strokeWidth={6} opacity={0.18} />
    <Path d={ringOf(form, 26.5)} stroke="#FF3FA4" strokeWidth={2.4} />
    <Path d={ringOf(form, 23.6)} stroke="#38E1FF" strokeWidth={4} opacity={0.2} />
    <Path d={ringOf(form, 23.6)} stroke="#38E1FF" strokeWidth={1.3} />
  </G>;
  if (kind === 'aurora') return <>
    <Defs><LinearGradient id={`${gid}au`} x1="0" y1="0" x2="1" y2="0.6">
      <Stop offset="0" stopColor="#3DFFB0" /><Stop offset="0.45" stopColor="#3AA8FF" /><Stop offset="0.75" stopColor="#B26BFF" /><Stop offset="1" stopColor="#3DFFB0" />
    </LinearGradient></Defs>
    <Path d={L.outline} fill="none" stroke={`url(#${gid}au)`} strokeWidth={4.5} strokeLinejoin="round" />
    <Path d={L.outline} fill="none" stroke={`url(#${gid}au)`} strokeWidth={9} opacity={0.18} />
  </>;
  if (kind === 'cosmos') return <G>
    <Path d={ringOf(form, 26)} fill="none" stroke="#7E8CFF" strokeWidth={1} strokeDasharray="1.5 3" opacity={0.8} />
    <G transform="translate(32 6)">
      <Circle r={4.2} fill="#FFB86B" />
      <Ellipse rx={7} ry={2} fill="none" stroke="#FFE2B8" strokeWidth={1} transform="rotate(-18)" />
    </G>
    <Circle cx={58} cy={32} r={1.8} fill="#9FE8FF" />
  </G>;
  if (kind === 'tesla') return <G fill="none" strokeLinecap="round" strokeLinejoin="round">
    <Path d={ringOf(form, 26)} stroke="#5BC8FF" strokeWidth={1.4} opacity={0.6} />
    {[0, 1.6, 3.3, 4.8].map(a => <G key={a}><Path d={BOLT(a, 0.9)} stroke="#9BE7FF" strokeWidth={3.2} opacity={0.25} /><Path d={BOLT(a, 0.9)} stroke="#F2FBFF" strokeWidth={1.1} /></G>)}
  </G>;
  if (kind === 'lava') return <>
    <Defs><LinearGradient id={`${gid}lv`} x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#FFD24A" /><Stop offset="0.5" stopColor="#FF6A1A" /><Stop offset="1" stopColor="#C21E12" /></LinearGradient></Defs>
    <Path d={L.outline} fill="none" stroke={`url(#${gid}lv)`} strokeWidth={4.6} strokeLinejoin="round" />
  </>;
  return <>
    <Defs><LinearGradient id={`${gid}gd`} x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#FFE9A6" /><Stop offset="0.5" stopColor="#D9A22A" /><Stop offset="1" stopColor="#8F6512" /></LinearGradient></Defs>
    <Path d={L.outline} fill="none" stroke={`url(#${gid}gd)`} strokeWidth={4} strokeLinejoin="round" />
    <Path d="M53 14L54.2 17L57 18L54.2 19L53 22L51.8 19L49 18L51.8 17Z" fill="#FFF6D6" />
  </>;
}

/** Как двигается каждая рамка: поворот кольца, дыхание, мерцание. */
function useMotion(kind: FxKind, on: boolean) {
  const t = useSharedValue(0);
  const p = useSharedValue(0);
  useEffect(() => {
    // Выключили (прокрутка, экономия) — останавливаем на месте, а не просто перестаём запускать.
    if (!on) { cancelAnimation(t); cancelAnimation(p); return; }
    // Вертятся только орбита «Космоса» и поток «Лавы»; пузырь, капля и сияние стоят и переливаются (просьба владельца 21 окт.).
    const turn = { bubble: 0, drop: 0, neon: 0, aurora: 0, cosmos: 10000, tesla: 0, lava: 16000, crown: 0 }[kind];
    // Продолжаем с того же угла: повтор идёт от s до s+1 (полный оборот), без скачка после паузы.
    if (turn) { const s = t.get() % 1; t.set(s); t.set(withRepeat(withTiming(s + 1, { duration: turn, easing: Easing.linear }), -1, false)); }
    p.set(kind === 'tesla'
      ? withRepeat(withSequence(withTiming(1, { duration: 90 }), withTiming(0.35, { duration: 140 }), withTiming(1, { duration: 60 }), withTiming(0.8, { duration: 900 })), -1, false)
      : withRepeat(withTiming(1, { duration: kind === 'neon' ? 1400 : 2600, easing: Easing.inOut(Easing.sin) }), -1, true));
  }, [kind, on, t, p]);
  return useAnimatedStyle(() => {
    const dir = kind === 'lava' ? -1 : 1;
    const scale = kind === 'bubble' ? 1 + 0.025 * p.get() : kind === 'drop' || kind === 'lava' ? 1 + 0.015 * p.get() : 1;
    const opacity = kind === 'neon' ? 0.65 + 0.35 * p.get() : kind === 'tesla' ? p.get() : kind === 'crown' ? 0.85 + 0.15 * p.get() : kind === 'aurora' ? 0.7 + 0.3 * p.get() : 1;
    return { opacity: on ? opacity : 1, transform: [{ rotate: `${dir * 360 * t.get()}deg` }, { scale }] };
  });
}

/** Мыльная плёнка: раз в несколько секунд по пузырю пробегает радужный блик и вспыхивает отражение окна. */
function Sheen({ gid, on, size, form }: { gid: string; on: boolean; size: number; form: Form }) {
  const t = useSharedValue(0);
  useEffect(() => {
    if (!on) { cancelAnimation(t); t.set(0); return; }
    t.set(withRepeat(withSequence(withDelay(2400, withTiming(1, { duration: 1300, easing: Easing.inOut(Easing.quad) })), withTiming(0, { duration: 0 })), -1, false));
    return () => cancelAnimation(t);
  }, [on, t]);
  const st = useAnimatedStyle(() => ({ opacity: Math.sin(Math.PI * t.get()), transform: [{ translateX: (t.get() - 0.5) * size * 0.35 }, { translateY: (t.get() - 0.5) * size * 0.18 }] }));
  const glint = useAnimatedStyle(() => ({ opacity: 0.55 + 0.45 * Math.sin(Math.PI * t.get()) }));
  return <>
    {/* Постоянное отражение «окна» сверху слева — пузырь читается объёмным и без движения. */}
    <Animated.View style={[{ position: 'absolute', left: 0, top: 0, width: size, height: size }, glint]}>
      <Svg width={size} height={size} viewBox="0 0 64 64">
        <Path d="M15 21Q19 12 29 9" fill="none" stroke="#FFFFFF" strokeWidth={2.6} strokeLinecap="round" opacity={0.95} />
        <Path d="M17 26Q17.5 24 18.5 22.5" fill="none" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" opacity={0.8} />
        <Circle cx={47} cy={46} r={1.9} fill="#FFFFFF" opacity={0.85} />
      </Svg>
    </Animated.View>
    <Animated.View style={[{ position: 'absolute', left: 0, top: 0, width: size, height: size }, st]}>
      <Svg width={size} height={size} viewBox="0 0 64 64">
        <Defs>
          <ClipPath id={`${gid}sc`}><Path d={ringOf(form, 29)} /></ClipPath>
          <LinearGradient id={`${gid}sh`} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0.3" stopColor="#FFFFFF" stopOpacity={0} /><Stop offset="0.42" stopColor="#B9F3FF" stopOpacity={0.55} />
            <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity={0.8} /><Stop offset="0.58" stopColor="#FFC6EA" stopOpacity={0.55} /><Stop offset="0.7" stopColor="#FFFFFF" stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Path d={ringOf(form, 29)} fill={`url(#${gid}sh)`} clipPath={`url(#${gid}sc)`} />
      </Svg>
    </Animated.View>
  </>;
}

export const FxFrame = memo(function FxFrame({ kind, image, initial, tint, size, mapPin, animate, shape }: {
  kind: FxKind; image?: string | null; initial: string; tint: string; size: number; mapPin: boolean; animate: boolean; shape?: ShapeId;
}) {
  const form: Form = shape && shape !== 'auto' ? shape : undefined;
  const gid = `fx${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const L = LOOK[kind];
  const extent = mapPin ? 72 : 64;
  const motion = useMotion(kind, animate && !mapPin && size >= 72);
  const r = L.aperture;
  const accent = { bubble: '#8EE7FF', drop: '#2457C9', neon: '#FF3FA4', aurora: '#3AA8FF', cosmos: '#7E8CFF', tesla: '#5BC8FF', lava: '#FF6A1A', crown: '#D9A22A' }[kind];
  return <View pointerEvents="none" style={{ width: size, height: (size * extent) / 64 }}>
    <Svg width={size} height={(size * extent) / 64} viewBox={`0 0 64 ${extent}`} style={StyleSheet.absoluteFill}>
      <Defs><ClipPath id={`${gid}c`}><Path d={ringOf(form, r)} /></ClipPath></Defs>
      {mapPin && <><Ellipse cx={32} cy={67} rx={7} ry={2} fill={colors.ink} opacity={0.14} /><Path d="M25 55L32 66L39 55" fill={accent} stroke="#FFFCF4" strokeWidth={2.5} strokeLinejoin="round" /></>}
      <Base kind={kind} gid={gid} form={form} />
      <Path d={ringOf(form, r)} fill={tint} />
      {image ? <SvgImage href={photo(image)!} x={32 - r} y={32 - r} width={2 * r} height={2 * r} preserveAspectRatio="xMidYMid slice" clipPath={`url(#${gid}c)`} />
        : <SvgText x={32} y={39} textAnchor="middle" fontFamily={fonts.body700} fontSize={20} fill={colors.ink}>{initial}</SvgText>}
      <Path d={ringOf(form, r)} fill="none" stroke="#FFFCF4" strokeWidth={1.4} />
    </Svg>
    {/* Кольцо рисуется один раз в текстуру, дальше видеокарта только поворачивает её: без перерисовки SVG каждый кадр. */}
    <Animated.View renderToHardwareTextureAndroid shouldRasterizeIOS style={[{ position: 'absolute', left: 0, top: 0, width: size, height: size }, motion]}>
      <Svg width={size} height={size} viewBox="0 0 64 64"><Ring kind={kind} gid={gid} form={form} /></Svg>
    </Animated.View>
    {kind === 'bubble' && <Sheen gid={gid} on={animate && !mapPin && size >= 72} size={size} form={form} />}
  </View>;
});
