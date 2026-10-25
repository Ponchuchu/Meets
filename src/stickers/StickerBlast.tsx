// Стикер долетел до друга на карте (FIX5): у каждой реакции своё действие поверх его аватарки.
// Перчатки — три удара с двух сторон, «БАМ!» и сильная отдача в руку; сердце — бьётся «тук-тук» с вибрацией в такт
// и пускает сердечки; баклажан — пружинит; салют — разлетается; мем-стикер — выпрыгивает и покачивается.
import * as Haptics from 'expo-haptics';
import { useEffect, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withSpring, withTiming, type SharedValue } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { fonts } from '../theme';
import type { Sticker } from './catalog';
import { playSound } from './reactions';
import { StickerView } from './StickerView';

const hit = (style: Haptics.ImpactFeedbackStyle) => { void Haptics.impactAsync(style).catch(() => undefined); };
const at = (ms: number, fn: () => void, timers: ReturnType<typeof setTimeout>[]) => { timers.push(setTimeout(fn, ms)); };

/** Сколько длится действие — после него слой убирается. */
export const BLAST_MS: Record<string, number> = { punch: 1500, heart: 2900, squeak: 1700, confetti: 1900, sticker: 2600 };

export function StickerBlast({ st, x, y, onDone }: { st: Sticker; x: number; y: number; onDone: () => void }) {
  const kind = st.effect ?? 'sticker';
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    if (st.effect) playSound(st.effect);
    // Вибрация в такт действию.
    if (kind === 'punch') [260, 640, 1020].forEach((ms, i) => at(ms, () => hit(i === 2 ? Haptics.ImpactFeedbackStyle.Heavy : Haptics.ImpactFeedbackStyle.Medium), timers));
    else if (kind === 'heart') [0, 900, 1800].forEach((ms) => { at(ms + 120, () => hit(Haptics.ImpactFeedbackStyle.Heavy), timers); at(ms + 300, () => hit(Haptics.ImpactFeedbackStyle.Light), timers); });
    else if (kind === 'squeak') [80, 220, 360, 500].forEach((ms) => at(ms, () => hit(Haptics.ImpactFeedbackStyle.Light), timers));
    else if (kind === 'confetti') { at(60, () => hit(Haptics.ImpactFeedbackStyle.Heavy), timers); at(200, () => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined), timers); }
    else at(120, () => hit(Haptics.ImpactFeedbackStyle.Light), timers);
    at(BLAST_MS[kind], onDone, timers);
    return () => timers.forEach(clearTimeout);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={[styles.anchor, { left: x, top: y }]}>
        {kind === 'punch' ? <Punch /> : kind === 'heart' ? <Heartbeat /> : kind === 'squeak' ? <Wobble st={st} /> : kind === 'confetti' ? <Confetti /> : <Pop st={st} />}
      </View>
    </View>
  );
}

const GLOVE = 'M21 73L24 49Q12 29 28 21Q40 11 49 21Q69 10 80 26Q86 38 78 55L73 78Z';
function Glove({ flip }: { flip?: boolean }) {
  return (
    <Svg width={84} height={84} viewBox="0 0 100 100" style={flip ? { transform: [{ scaleX: -1 }] } : undefined}>
      <Path d={GLOVE} fill="#EF4A38" stroke="#962824" strokeWidth={3} />
      <Path d="M20 72H74V88H20Z" fill="#FBFAF6" stroke="#962824" strokeWidth={3} />
      <Path d="M38 25Q32 44 44 52M50 24L51 45" fill="none" stroke="#FCA496" strokeWidth={4} />
    </Svg>
  );
}

/** Три удара: левой, правой, снова левой — перчатка влетает сбоку, отскакивает, на месте удара — «БАМ!». */
function Punch() {
  const l = useSharedValue(-220); const r = useSharedValue(220); const shake = useSharedValue(0);
  const boom = useSharedValue(0); const boomN = useSharedValue(0);
  useEffect(() => {
    const jab = (sv: SharedValue<number>, from: number, delay: number) => sv.set(withDelay(delay, withSequence(withTiming(from * 0.12, { duration: 200, easing: Easing.in(Easing.cubic) }), withTiming(from * 0.55, { duration: 230, easing: Easing.out(Easing.quad) }))));
    jab(l, -220, 60); jab(r, 220, 440);
    l.set(withDelay(820, withSequence(withTiming(-26, { duration: 200, easing: Easing.in(Easing.cubic) }), withTiming(-300, { duration: 380, easing: Easing.in(Easing.quad) }))));
    r.set(withDelay(900, withTiming(320, { duration: 400 })));
    shake.set(withDelay(260, withRepeat(withSequence(withTiming(7, { duration: 45 }), withTiming(-7, { duration: 45 }), withTiming(0, { duration: 45 })), 3, false)));
    boom.set(withSequence(withDelay(250, withTiming(1, { duration: 90 })), withTiming(0.6, { duration: 200 }), withTiming(1, { duration: 90 }), withTiming(0.6, { duration: 200 }), withTiming(1.25, { duration: 90 }), withDelay(260, withTiming(0, { duration: 200 }))));
    boomN.set(withSequence(withDelay(260, withTiming(0, { duration: 1 })), withDelay(380, withTiming(1, { duration: 1 })), withDelay(380, withTiming(2, { duration: 1 }))));
  }, [l, r, shake, boom, boomN]);
  const ls = useAnimatedStyle(() => ({ transform: [{ translateX: l.get() - 40 }, { rotate: '-12deg' }] }));
  const rs = useAnimatedStyle(() => ({ transform: [{ translateX: r.get() + 40 }, { rotate: '12deg' }] }));
  const bs = useAnimatedStyle(() => ({ opacity: Math.min(1, boom.get() * 1.4), transform: [{ translateX: shake.get() }, { scale: 0.4 + boom.get() * 0.8 }, { rotate: `${(boomN.get() - 1) * 14}deg` }] }));
  return <>
    <Animated.View style={[styles.boom, bs]}>
      <Svg width={130} height={110} viewBox="0 0 130 110" style={StyleSheet.absoluteFill}>
        <Path d="M65 4l12 24 28-12-8 28 30 10-28 12 14 26-30-8-6 26-14-24-20 20-2-28-28 4 18-22L2 44l30-6-8-28 26 14z" fill="#FFD23F" stroke="#2A2230" strokeWidth={3} strokeLinejoin="round" />
      </Svg>
      <Text style={styles.boomText}>БАМ!</Text>
    </Animated.View>
    <Animated.View style={[styles.glove, ls]}><Glove /></Animated.View>
    <Animated.View style={[styles.glove, rs]}><Glove flip /></Animated.View>
  </>;
}

/** Сердце бьётся: «тук» — большой толчок, «тук» — поменьше, пауза; три раза. Вокруг всплывают маленькие сердечки. */
function Heartbeat() {
  const s = useSharedValue(0); const glow = useSharedValue(0);
  useEffect(() => {
    const beat = withSequence(withTiming(1.28, { duration: 120, easing: Easing.out(Easing.quad) }), withTiming(1.02, { duration: 110 }), withTiming(1.18, { duration: 100 }), withTiming(1, { duration: 300, easing: Easing.out(Easing.cubic) }), withTiming(1, { duration: 270 }));
    s.set(withSequence(withSpring(1, { damping: 9, stiffness: 180 }), beat, beat, beat, withTiming(0, { duration: 260 })));
    glow.set(withRepeat(withSequence(withTiming(1, { duration: 140 }), withTiming(0, { duration: 760 })), 3, false));
  }, [s, glow]);
  const hs = useAnimatedStyle(() => ({ transform: [{ scale: s.get() }] }));
  const gs = useAnimatedStyle(() => ({ opacity: glow.get() * 0.55, transform: [{ scale: 1 + glow.get() * 0.5 }] }));
  const small = useMemo(() => Array.from({ length: 7 }, (_, i) => ({ dx: (i - 3) * 22 + (i % 2 ? 6 : -6), delay: 200 + i * 260, size: 18 + (i % 3) * 6 })), []);
  return <>
    <Animated.View style={[styles.glow, gs]} />
    {small.map((h, i) => <Floater key={i} {...h} />)}
    <Animated.View style={[styles.center, hs]}>
      <Svg width={120} height={120} viewBox="0 0 100 100">
        <Path d="M50 88Q4 60 12 32Q22 8 50 28Q78 8 88 32Q96 60 50 88Z" fill="#F0384F" stroke="#FFFFFF" strokeWidth={5} />
        <Path d="M28 30q8-6 14 2" stroke="#FFFFFF" strokeWidth={5} strokeLinecap="round" fill="none" opacity={0.7} />
      </Svg>
    </Animated.View>
  </>;
}

function Floater({ dx, delay, size }: { dx: number; delay: number; size: number }) {
  const t = useSharedValue(0);
  useEffect(() => { t.set(withDelay(delay, withTiming(1, { duration: 1300, easing: Easing.out(Easing.quad) }))); }, [t, delay]);
  const st = useAnimatedStyle(() => ({ opacity: t.get() === 0 ? 0 : 1 - t.get(), transform: [{ translateX: dx + Math.sin(t.get() * 6) * 6 }, { translateY: -40 - t.get() * 110 }, { scale: 0.6 + t.get() * 0.5 }] }));
  return (
    <Animated.View style={[styles.center, st]}>
      <Svg width={size} height={size} viewBox="0 0 100 100"><Path d="M50 88Q4 60 12 32Q22 8 50 28Q78 8 88 32Q96 60 50 88Z" fill="#FF6B81" /></Svg>
    </Animated.View>
  );
}

/** Баклажан: падает сверху, пружинит и раскачивается. */
function Wobble({ st }: { st: Sticker }) {
  const y = useSharedValue(-160); const r = useSharedValue(0); const s = useSharedValue(1);
  useEffect(() => {
    y.set(withSpring(-10, { damping: 6, stiffness: 160 }));
    r.set(withDelay(200, withSequence(withTiming(-22, { duration: 110 }), withTiming(20, { duration: 120 }), withTiming(-14, { duration: 120 }), withTiming(10, { duration: 120 }), withTiming(0, { duration: 160 }))));
    s.set(withDelay(150, withSequence(withTiming(1.2, { duration: 90 }), withTiming(0.88, { duration: 90 }), withTiming(1.1, { duration: 90 }), withTiming(1, { duration: 120 }), withDelay(700, withTiming(0, { duration: 220 })))));
  }, [y, r, s]);
  const ws = useAnimatedStyle(() => ({ transform: [{ translateY: y.get() }, { rotate: `${r.get()}deg` }, { scale: s.get() }] }));
  return <Animated.View style={[styles.center, ws]}><StickerView st={st} size="lg" /></Animated.View>;
}

/** Салют: конфетти разлетаются из точки друга и падают. */
function Confetti() {
  const bits = useMemo(() => Array.from({ length: 22 }, (_, i) => ({ a: (i / 22) * Math.PI * 2, v: 90 + (i * 37) % 70, c: ['#F0521F', '#FFC93C', '#3BA3E5', '#9167CE', '#2FA35A', '#F0384F'][i % 6], w: 7 + (i % 3) * 3 })), []);
  return <>{bits.map((b, i) => <Bit key={i} {...b} />)}</>;
}
function Bit({ a, v, c, w }: { a: number; v: number; c: string; w: number }) {
  const t = useSharedValue(0);
  useEffect(() => { t.set(withTiming(1, { duration: 1700, easing: Easing.out(Easing.quad) })); }, [t]);
  const st = useAnimatedStyle(() => {
    const k = t.get();
    return { opacity: 1 - Math.max(0, k - 0.6) / 0.4, transform: [{ translateX: Math.cos(a) * v * k }, { translateY: Math.sin(a) * v * k + 160 * k * k }, { rotate: `${k * 540}deg` }] };
  });
  return <Animated.View style={[styles.center, { width: w, height: w * 1.6, borderRadius: 2, backgroundColor: c }, st]} />;
}

/** Мем-стикер выпрыгивает над другом, покачивается и тает. */
function Pop({ st }: { st: Sticker }) {
  const s = useSharedValue(0); const r = useSharedValue(0); const o = useSharedValue(1);
  useEffect(() => {
    s.set(withSpring(1, { damping: 7, stiffness: 170 }));
    r.set(withDelay(250, withRepeat(withSequence(withTiming(-7, { duration: 180 }), withTiming(7, { duration: 180 })), 4, true)));
    o.set(withDelay(2200, withTiming(0, { duration: 300 })));
  }, [s, r, o]);
  const ps = useAnimatedStyle(() => ({ opacity: o.get(), transform: [{ translateY: -70 * s.get() }, { scale: s.get() }, { rotate: `${r.get()}deg` }] }));
  return <Animated.View style={[styles.center, ps]}><StickerView st={st} size="lg" /></Animated.View>;
}

const styles = StyleSheet.create({
  anchor: { position: 'absolute', width: 0, height: 0, alignItems: 'center', justifyContent: 'center', overflow: 'visible' },
  center: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  glove: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  boom: { position: 'absolute', width: 130, height: 110, alignItems: 'center', justifyContent: 'center', top: -100 },
  boomText: { fontFamily: fonts.display800, fontSize: 26, color: '#E5383B', letterSpacing: -0.5, transform: [{ rotate: '-8deg' }], textShadowColor: '#FFFFFF', textShadowRadius: 1, textShadowOffset: { width: 2, height: 2 } },
  glow: { position: 'absolute', width: 150, height: 150, borderRadius: 75, backgroundColor: '#FF6B81' },
});
