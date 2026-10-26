// Стикер долетел до друга на карте (26 октября, новый набор): у каждого своё действие поверх его аватарки.
// Перчатки бьют с двух сторон, сердце бьётся «тук-тук» и пускает сердечки, огонь разгорается и сыплет искрами,
// ладони хлопают, череп гремит, ракета улетает с дымом, луна сопит «z-z-z», мем-текст с размаху падает и трясёт экран.
// Вибрация — в такт звуку. Текст только у мемов: остальное говорит картинкой.
import * as Haptics from 'expo-haptics';
import { useEffect, useMemo } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withSpring, withTiming, type SharedValue } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { fonts } from '../theme';
import type { Sticker, StickerAnim } from './catalog';
import { STICKERS } from './catalog';
import { playSound } from './reactions';
import { StickerView } from './StickerView';

const hit = (style: Haptics.ImpactFeedbackStyle) => { void Haptics.impactAsync(style).catch(() => undefined); };
const { Light, Medium, Heavy } = Haptics.ImpactFeedbackStyle;
const at = (ms: number, fn: () => void, timers: ReturnType<typeof setTimeout>[]) => { timers.push(setTimeout(fn, ms)); };

/** Сколько длится действие — после него слой убирается. */
export const BLAST_MS: Record<StickerAnim, number> = {
  heartbeat: 2900, punch: 1500, wobble: 1700, confetti: 1900, flicker: 2200, clap: 1600, laugh: 1900, rattle: 1800, look: 2000, pop: 1800,
  launch: 1700, steam: 2400, sway: 2600, shine: 2000, float: 2400, hug: 2100, slam: 1700, sixseven: 2200,
};

/** Вибрация в такт: моменты (мс) и сила. */
const BEATS: Partial<Record<StickerAnim, [number, Haptics.ImpactFeedbackStyle][]>> = {
  punch: [[260, Medium], [640, Medium], [1020, Heavy]],
  heartbeat: [[120, Heavy], [300, Light], [1020, Heavy], [1200, Light], [1920, Heavy], [2100, Light]],
  wobble: [[80, Light], [220, Light], [360, Light], [500, Light]],
  confetti: [[60, Heavy]],
  clap: [[10, Medium], [250, Medium], [490, Heavy]],
  laugh: [[0, Light], [170, Light], [340, Light], [510, Light]],
  rattle: [[300, Heavy], ...Array.from({ length: 6 }, (_, i) => [420 + i * 70, Light] as [number, Haptics.ImpactFeedbackStyle])],
  slam: [[260, Heavy], [380, Medium]],
  sixseven: [[0, Light], [280, Light], [560, Light], [840, Light], [1120, Light], [1400, Medium]],
  launch: [[100, Medium]],
  hug: [[300, Medium], [900, Medium]],
};

export function StickerBlast({ st, x, y, onDone }: { st: Sticker; x: number; y: number; onDone: () => void }) {
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    playSound(st.sound);
    for (const [ms, s] of BEATS[st.anim] ?? [[120, Light]]) at(ms, () => hit(s), timers);
    if (st.anim === 'confetti') at(200, () => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined), timers);
    at(BLAST_MS[st.anim], onDone, timers);
    return () => timers.forEach(clearTimeout);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={[styles.anchor, { left: x, top: y }]}>
        {st.anim === 'punch' ? <Punch st={st} /> : <><Particles st={st} /><Motion st={st} /></>}
      </View>
    </View>
  );
}

/** Движение самого стикера: одна анимация на вид (сдвиг, поворот, масштаб, прозрачность). */
function Motion({ st }: { st: Sticker }) {
  const tx = useSharedValue(0); const ty = useSharedValue(0); const r = useSharedValue(0);
  const sx = useSharedValue(0); const sy = useSharedValue(0); const o = useSharedValue(1);
  useEffect(() => {
    const D = BLAST_MS[st.anim];
    const both = (v: number | ReturnType<typeof withTiming>) => { sx.set(v as number); sy.set(v as number); };
    const appear = () => both(withSpring(1, { damping: 8, stiffness: 180 }));
    const fadeOut = () => o.set(withDelay(D - 320, withTiming(0, { duration: 280 })));
    switch (st.anim) {
      case 'heartbeat': {
        const beat = withSequence(withTiming(1.28, { duration: 120, easing: Easing.out(Easing.quad) }), withTiming(1.02, { duration: 110 }), withTiming(1.18, { duration: 100 }), withTiming(1, { duration: 300 }), withTiming(1, { duration: 270 }));
        both(withSequence(withSpring(1, { damping: 9, stiffness: 180 }), beat, beat, beat));
        break;
      }
      case 'wobble':
        ty.set(-160); ty.set(withSpring(-10, { damping: 6, stiffness: 160 })); appear();
        r.set(withDelay(200, withSequence(withTiming(-22, { duration: 110 }), withTiming(20, { duration: 120 }), withTiming(-14, { duration: 120 }), withTiming(10, { duration: 120 }), withTiming(0, { duration: 160 }))));
        break;
      case 'confetti':
        both(withSequence(withTiming(1.35, { duration: 140 }), withSpring(1, { damping: 7 }))); r.set(withSequence(withTiming(-25, { duration: 140 }), withSpring(0)));
        break;
      case 'flicker':
        appear(); sy.set(withSequence(withSpring(1, { damping: 8 }), withRepeat(withSequence(withTiming(1.12, { duration: 140 }), withTiming(0.94, { duration: 160 })), 5, true)));
        r.set(withRepeat(withSequence(withTiming(-4, { duration: 150 }), withTiming(4, { duration: 150 })), 6, true));
        break;
      case 'clap':
        appear(); sx.set(withSequence(withSpring(1), ...[0, 1, 2].map(() => withSequence(withTiming(0.82, { duration: 70 }), withTiming(1.06, { duration: 90 }), withTiming(1, { duration: 80 })))));
        break;
      case 'laugh':
        appear(); r.set(withRepeat(withSequence(withTiming(-9, { duration: 70 }), withTiming(9, { duration: 70 })), 9, true));
        ty.set(withRepeat(withSequence(withTiming(-10, { duration: 140 }), withTiming(0, { duration: 140 })), 5, true));
        break;
      case 'rattle':
        both(1); ty.set(-220); ty.set(withSequence(withTiming(0, { duration: 300, easing: Easing.in(Easing.quad) }), withSpring(0, { damping: 5 })));
        tx.set(withDelay(400, withRepeat(withSequence(withTiming(-6, { duration: 35 }), withTiming(6, { duration: 35 })), 8, true)));
        break;
      case 'look':
        appear(); tx.set(withDelay(300, withSequence(withTiming(-18, { duration: 260 }), withDelay(250, withTiming(18, { duration: 300 })), withDelay(250, withTiming(0, { duration: 260 })))));
        break;
      case 'pop':
        both(withSequence(withTiming(1.4, { duration: 180, easing: Easing.out(Easing.back(2)) }), withSpring(1, { damping: 6 }))); ty.set(withSpring(-20));
        break;
      case 'launch':
        both(1); tx.set(-60); ty.set(60); tx.set(withSequence(withTiming(-50, { duration: 300 }), withTiming(260, { duration: 1100, easing: Easing.in(Easing.cubic) })));
        ty.set(withSequence(withTiming(50, { duration: 300 }), withTiming(-420, { duration: 1100, easing: Easing.in(Easing.cubic) })));
        r.set(withRepeat(withSequence(withTiming(-3, { duration: 50 }), withTiming(3, { duration: 50 })), 6, true));
        break;
      case 'steam':
        appear(); ty.set(withRepeat(withSequence(withTiming(-8, { duration: 500 }), withTiming(0, { duration: 500 })), 3, true));
        break;
      case 'sway':
        appear(); r.set(withRepeat(withSequence(withTiming(-10, { duration: 650, easing: Easing.inOut(Easing.sin) }), withTiming(10, { duration: 650, easing: Easing.inOut(Easing.sin) })), 2, true));
        break;
      case 'shine':
        both(1); tx.set(-260); tx.set(withSpring(0, { damping: 11, stiffness: 120 })); r.set(withSequence(withTiming(-14, { duration: 300 }), withSpring(0)));
        break;
      case 'float':
        o.set(0); o.set(withTiming(1, { duration: 300 })); both(1);
        tx.set(withRepeat(withSequence(withTiming(-24, { duration: 600, easing: Easing.inOut(Easing.sin) }), withTiming(24, { duration: 600, easing: Easing.inOut(Easing.sin) })), 2, true));
        ty.set(withSequence(withTiming(-30, { duration: 1200 }), withTiming(-60, { duration: 1100 })));
        break;
      case 'hug':
        appear(); sx.set(withDelay(250, withRepeat(withSequence(withTiming(1.22, { duration: 220 }), withTiming(1, { duration: 300 })), 2, false)));
        sy.set(withDelay(250, withRepeat(withSequence(withTiming(0.86, { duration: 220 }), withTiming(1, { duration: 300 })), 2, false)));
        break;
      case 'slam':
        o.set(0); o.set(withTiming(1, { duration: 120 })); both(3); both(withSequence(withTiming(0.92, { duration: 260, easing: Easing.in(Easing.cubic) }), withSpring(1, { damping: 5, stiffness: 220 })));
        tx.set(withDelay(260, withRepeat(withSequence(withTiming(-8, { duration: 40 }), withTiming(8, { duration: 40 })), 4, true)));
        break;
      case 'sixseven':
        appear(); r.set(withRepeat(withSequence(withTiming(-12, { duration: 140 }), withTiming(12, { duration: 140 })), 7, true));
        ty.set(withRepeat(withSequence(withTiming(-14, { duration: 140 }), withTiming(6, { duration: 140 })), 7, true));
        break;
      default: appear();
    }
    if (st.anim !== 'launch') fadeOut();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const ms = useAnimatedStyle(() => ({ opacity: o.get(), transform: [{ translateX: tx.get() }, { translateY: ty.get() - 60 }, { rotate: `${r.get()}deg` }, { scaleX: sx.get() }, { scaleY: sy.get() }] }));
  return <Animated.View style={[styles.center, ms]}><StickerView st={st} size="lg" /></Animated.View>;
}

/** Частицы вокруг: сердечки, искры, конфетти, «z-z-z», пар, дым, блеск, пыль от удара. */
function Particles({ st }: { st: Sticker }) {
  const heart = STICKERS.find((s) => s.id === 'heart')?.img;
  const list = useMemo(() => {
    switch (st.anim) {
      case 'heartbeat': case 'hug': return Array.from({ length: 7 }, (_, i) => ({ kind: 'heart' as const, dx: (i - 3) * 24, delay: 250 + i * 230, size: 20 + (i % 3) * 7 }));
      case 'flicker': return Array.from({ length: 10 }, (_, i) => ({ kind: 'ember' as const, dx: (i - 5) * 12, delay: 200 + i * 150, size: 6 + (i % 3) * 3 }));
      case 'steam': return Array.from({ length: 6 }, (_, i) => ({ kind: 'steam' as const, dx: (i % 3 - 1) * 14, delay: 200 + i * 300, size: 18 + (i % 2) * 8 }));
      case 'sway': return Array.from({ length: 3 }, (_, i) => ({ kind: 'z' as const, dx: 30 + i * 14, delay: 300 + i * 600, size: 18 + i * 6 }));
      case 'launch': return Array.from({ length: 8 }, (_, i) => ({ kind: 'smoke' as const, dx: -50 + i * 30, delay: 350 + i * 110, size: 22 + (i % 3) * 8 }));
      case 'shine': case 'pop': return Array.from({ length: 5 }, (_, i) => ({ kind: 'spark' as const, dx: (i - 2) * 34, delay: 450 + i * 120, size: 16 + (i % 2) * 8 }));
      default: return [];
    }
  }, [st.anim]);
  return <>
    {st.anim === 'confetti' && <Confetti />}
    {st.anim === 'slam' && <Dust />}
    {list.map((p, i) => <Bit key={i} {...p} heart={heart} />)}
  </>;
}

function Bit({ kind, dx, delay, size, heart }: { kind: 'heart' | 'ember' | 'steam' | 'z' | 'smoke' | 'spark'; dx: number; delay: number; size: number; heart?: Sticker['img'] }) {
  const t = useSharedValue(0);
  useEffect(() => { t.set(withDelay(delay, withTiming(1, { duration: kind === 'spark' ? 600 : 1300, easing: Easing.out(Easing.quad) }))); }, [t, delay, kind]);
  const rise = kind === 'smoke' ? 40 : kind === 'spark' ? 0 : 140;
  const st = useAnimatedStyle(() => {
    const k = t.get();
    const scale = kind === 'spark' ? Math.sin(k * Math.PI) * 1.2 : kind === 'smoke' ? 0.6 + k : 0.6 + k * 0.5;
    return { opacity: k === 0 ? 0 : kind === 'spark' ? 1 : 1 - k, transform: [{ translateX: dx + Math.sin(k * 6) * 6 }, { translateY: -60 - (kind === 'spark' ? 70 : 20) - k * rise }, { scale }] };
  });
  return (
    <Animated.View style={[styles.center, st]}>
      {kind === 'heart' && heart ? <Image source={heart} style={{ width: size, height: size }} />
        : kind === 'z' ? <Text style={[styles.z, { fontSize: size }]}>z</Text>
          : kind === 'spark' ? <Svg width={size} height={size} viewBox="0 0 20 20"><Path d="M10 0l2.4 7.6L20 10l-7.6 2.4L10 20l-2.4-7.6L0 10l7.6-2.4z" fill="#FFFFFF" stroke="#FFD23F" strokeWidth={1} /></Svg>
            : <View style={{ width: size, height: size, borderRadius: size, backgroundColor: kind === 'ember' ? '#FF9F1C' : kind === 'smoke' ? 'rgba(200,196,188,0.85)' : 'rgba(255,255,255,0.8)' }} />}
    </Animated.View>
  );
}

/** Удар мема о землю: кольцо пыли расходится и тает. */
function Dust() {
  const t = useSharedValue(0);
  useEffect(() => { t.set(withDelay(240, withTiming(1, { duration: 600, easing: Easing.out(Easing.quad) }))); }, [t]);
  const st = useAnimatedStyle(() => ({ opacity: t.get() === 0 ? 0 : 0.6 * (1 - t.get()), transform: [{ translateY: 10 }, { scaleX: 0.5 + t.get() * 1.8 }, { scaleY: 0.3 + t.get() * 0.5 }] }));
  return <Animated.View style={[styles.center, styles.dust, st]} />;
}

/** Две перчатки бьют по очереди: влетают сбоку, отскакивают; на месте удара — вспышка. */
function Punch({ st }: { st: Sticker }) {
  const l = useSharedValue(-220); const r = useSharedValue(220); const boom = useSharedValue(0); const shake = useSharedValue(0);
  useEffect(() => {
    const jab = (sv: SharedValue<number>, from: number, delay: number) => sv.set(withDelay(delay, withSequence(withTiming(from * 0.12, { duration: 200, easing: Easing.in(Easing.cubic) }), withTiming(from * 0.55, { duration: 230, easing: Easing.out(Easing.quad) }))));
    jab(l, -220, 60); jab(r, 220, 440);
    l.set(withDelay(820, withSequence(withTiming(-26, { duration: 200, easing: Easing.in(Easing.cubic) }), withTiming(-300, { duration: 380, easing: Easing.in(Easing.quad) }))));
    r.set(withDelay(900, withTiming(320, { duration: 400 })));
    shake.set(withDelay(260, withRepeat(withSequence(withTiming(7, { duration: 45 }), withTiming(-7, { duration: 45 }), withTiming(0, { duration: 45 })), 3, false)));
    boom.set(withSequence(withDelay(250, withTiming(1, { duration: 90 })), withTiming(0.6, { duration: 200 }), withTiming(1, { duration: 90 }), withTiming(0.6, { duration: 200 }), withTiming(1.25, { duration: 90 }), withDelay(260, withTiming(0, { duration: 200 }))));
  }, [l, r, boom, shake]);
  const ls = useAnimatedStyle(() => ({ transform: [{ translateX: l.get() - 40 }, { translateY: -60 }, { rotate: '-8deg' }, { scaleX: -1 }] }));
  const rs = useAnimatedStyle(() => ({ transform: [{ translateX: r.get() + 40 }, { translateY: -60 }, { rotate: '8deg' }] }));
  const bs = useAnimatedStyle(() => ({ opacity: Math.min(1, boom.get() * 1.4), transform: [{ translateX: shake.get() }, { translateY: -70 }, { scale: 0.4 + boom.get() * 0.8 }] }));
  return <>
    <Animated.View style={[styles.center, bs]}>
      <Svg width={120} height={110} viewBox="0 0 130 110">
        <Path d="M65 4l12 24 28-12-8 28 30 10-28 12 14 26-30-8-6 26-14-24-20 20-2-28-28 4 18-22L2 44l30-6-8-28 26 14z" fill="#FFD23F" stroke="#2A2230" strokeWidth={3} strokeLinejoin="round" />
      </Svg>
    </Animated.View>
    <Animated.View style={[styles.center, ls]}><StickerView st={{ ...st, rot: 0 }} size={96} /></Animated.View>
    <Animated.View style={[styles.center, rs]}><StickerView st={{ ...st, rot: 0 }} size={96} /></Animated.View>
  </>;
}

/** Хлопушка: конфетти разлетаются из точки друга и падают. */
function Confetti() {
  const bits = useMemo(() => Array.from({ length: 24 }, (_, i) => ({ a: (i / 24) * Math.PI * 2, v: 90 + (i * 37) % 70, c: ['#F0521F', '#FFC93C', '#3BA3E5', '#9167CE', '#2FA35A', '#F0384F'][i % 6], w: 7 + (i % 3) * 3 })), []);
  return <>{bits.map((b, i) => <Paper key={i} {...b} />)}</>;
}
function Paper({ a, v, c, w }: { a: number; v: number; c: string; w: number }) {
  const t = useSharedValue(0);
  useEffect(() => { t.set(withDelay(120, withTiming(1, { duration: 1700, easing: Easing.out(Easing.quad) }))); }, [t]);
  const st = useAnimatedStyle(() => {
    const k = t.get();
    return { opacity: k === 0 ? 0 : 1 - Math.max(0, k - 0.6) / 0.4, transform: [{ translateX: Math.cos(a) * v * k }, { translateY: -60 + Math.sin(a) * v * k + 160 * k * k }, { rotate: `${k * 540}deg` }] };
  });
  return <Animated.View style={[styles.center, { width: w, height: w * 1.6, borderRadius: 2, backgroundColor: c }, st]} />;
}

const styles = StyleSheet.create({
  anchor: { position: 'absolute', width: 0, height: 0, alignItems: 'center', justifyContent: 'center', overflow: 'visible' },
  center: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  z: { fontFamily: fonts.display800, color: '#5B5BD6', textShadowColor: '#FFFFFF', textShadowRadius: 3, textShadowOffset: { width: 0, height: 0 } },
  dust: { width: 140, height: 40, borderRadius: 70, backgroundColor: 'rgba(160,150,135,0.8)' },
});
