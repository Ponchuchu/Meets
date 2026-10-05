// Живая заставка V6Splash / V6SplashNight (V6.md §2.1, FIX1 И1): один раз за холодный запуск, ≤ 3,4 с, тап — пропустить.
// 0–0,8 с улицы · 0,2–1,45 с «рядом» пишется кистью (штрихи из макета) · 1,45–1,65 с точка падает туда, где ты стоишь
// (карта под заставкой уже стоит на тебе — это центр экрана) · 2,2–2,8 с карта открывается кругом из точки ·
// 2,8 с камера приближает (MapScreen слушает settled) · 3,1–3,4 с заставка уходит, видны верх и панель.
// Сразу после «Добро пожаловать» не показываем (приветствие уже было) — флаг skipSplash().
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  Easing, FadeOut, interpolate, useAnimatedProps, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSequence, withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Defs, Mask, Path } from 'react-native-svg';
import { create } from 'zustand';
import { almaty } from '../../lib/clock';
import { WORD_GLYPH, WORD_STROKES, WORD_VIEWBOX } from './splashStrokes';

let played = false;
export const skipSplash = () => { played = true; useIntro.getState().set(false); useIntro.getState().settle(); };

/** splash — идёт ли заставка (обучение ждёт её конца); settled — пора приблизить камеру к тебе. */
export const useIntro = create<{ splash: boolean; settled: boolean; set: (v: boolean) => void; settle: () => void }>((set) => ({
  splash: !played, settled: played, set: (splash) => set({ splash }), settle: () => set({ settled: true }),
}));

const B = 1400; // толщина «рамки» вокруг растущего круга
const AnimatedPath = Animated.createAnimatedComponent(Path);
const WORD_W = 280;
const WORD_H = (WORD_W * WORD_VIEWBOX.h) / WORD_VIEWBOX.w;
// Улицы фоном (те же, что в макете, на экране 390×844).
const STREETS: [string, number][] = [
  ['M0 150H390', 5], ['M0 286H390', 2.5], ['M0 560H390', 5], ['M0 660H390', 2.5],
  ['M58 0V700', 5], ['M150 0V700', 2.5], ['M302 0V700', 5], ['M-40 720L430 110', 7],
  ['M232 0C226 180 256 320 240 520C230 620 262 700 250 844', 3.5],
  ['M0 740C70 712 120 748 190 722C260 698 320 730 390 704', 3], ['M0 792C80 768 140 800 214 776C290 752 340 782 390 760', 3],
  ['M318 200h48v70h-48z', 2.5], ['M86 600h50v40h-50z', 2.5], ['M20 40C90 70 120 30 180 52', 2],
];

function Stroke({ d, len, t0, t1, t }: { d: string; len: number; t0: number; t1: number; t: SharedValue<number> }) {
  const props = useAnimatedProps(() => ({ strokeDashoffset: interpolate(t.get(), [t0, t1], [len, 0], 'clamp') }));
  return <AnimatedPath d={d} stroke="#fff" strokeWidth={18.5} fill="none" strokeLinecap="round" strokeLinejoin="round" strokeDasharray={[len, len]} animatedProps={props} />;
}

function Street({ d, w, color, t }: { d: string; w: number; color: string; t: SharedValue<number> }) {
  const props = useAnimatedProps(() => ({ strokeDashoffset: interpolate(t.get(), [0, 800], [900, 0], 'clamp') }));
  return <AnimatedPath d={d} stroke={color} strokeWidth={w} fill="none" strokeLinecap="round" strokeDasharray={[900, 900]} animatedProps={props} />;
}

export function Splash() {
  const reduce = useReducedMotion();
  // Размер берём из onLayout: в web при первой отрисовке окно ещё 0×0.
  const win = useWindowDimensions();
  const [size, setSize] = useState(win.width > 0 ? { width: win.width, height: win.height } : null);
  const { width, height } = size ?? { width: 390, height: 844 };
  const onLayout = (e: LayoutChangeEvent) => {
    const { width: w, height: h } = e.nativeEvent.layout;
    if (w > 0 && (w !== size?.width || h !== size?.height)) setSize({ width: w, height: h });
  };
  const [on, setOn] = useState(!played);
  const [night] = useState(() => { const h = almaty(new Date()).getUTCHours(); return h >= 20 || h < 6; });
  const t = useSharedValue(reduce ? 1450 : 0);
  const drop = useSharedValue(win.height ? -win.height / 2 - 40 : -500);
  const squash = useSharedValue(1);
  const ring = useSharedValue(0);
  const hole = useSharedValue(0);
  const word = useSharedValue(1);

  const end = () => { played = true; setOn(false); useIntro.getState().set(false); useIntro.getState().settle(); };

  useEffect(() => {
    if (!on) return;
    if (reduce) { const r = setTimeout(end, 700); return () => clearTimeout(r); }
    const ease = Easing.bezier(0.6, 0, 0.2, 1);
    t.set(withTiming(1450, { duration: 1450, easing: Easing.linear }));
    drop.set(withDelay(1450, withTiming(0, { duration: 200, easing: Easing.in(Easing.quad) })));
    squash.set(withDelay(1650, withSequence(withTiming(0.72, { duration: 90 }), withTiming(1.1, { duration: 120 }), withTiming(1, { duration: 110 }))));
    ring.set(withDelay(1650, withTiming(1, { duration: 550, easing: Easing.out(Easing.quad) })));
    word.set(withDelay(1900, withTiming(0, { duration: 300 })));
    hole.set(withDelay(2200, withTiming(1, { duration: 600, easing: ease })));
    const s = setTimeout(() => useIntro.getState().settle(), 2800);
    const e = setTimeout(end, 3100);
    return () => { clearTimeout(s); clearTimeout(e); };
  }, [on]); // eslint-disable-line react-hooks/exhaustive-deps

  const bg = night ? '#17161A' : '#F0521F';
  const ink = night ? '#F3F0E8' : '#17161A';
  const dotC = night ? '#F0521F' : '#FBFAF6';
  const line = night ? 'rgba(243,240,232,0.09)' : 'rgba(23,22,26,0.13)';
  const maxR = Math.hypot(width, height) / 2 + 20;
  const frame = useAnimatedStyle(() => {
    const r = hole.get() * maxR;
    const s = 2 * (r + B);
    return { width: s, height: s, borderRadius: s / 2, left: width / 2 - s / 2, top: height / 2 - s / 2 };
  });
  const fill = useAnimatedStyle(() => ({ opacity: hole.get() > 0 ? 0 : 1 }));
  const dot = useAnimatedStyle(() => ({
    opacity: drop.get() < -height / 2 + 20 ? 0 : 1 - hole.get(),
    transform: [{ translateY: drop.get() }, { scaleY: squash.get() }, { scaleX: 2 - squash.get() }],
  }));
  const ringSt = useAnimatedStyle(() => ({ opacity: ring.get() > 0 ? (1 - ring.get()) * 0.8 : 0, transform: [{ scale: 0.3 + ring.get() * 3.1 }] }));
  const wordSt = useAnimatedStyle(() => ({ opacity: word.get() }));

  if (!on) return null;
  return (
    <Animated.View style={StyleSheet.absoluteFill} exiting={FadeOut.duration(300)} onLayout={onLayout}>
      <Pressable style={StyleSheet.absoluteFill} onPress={end} accessibilityRole="button" accessibilityLabel="Пропустить заставку">
        {/* До раскрытия — сплошной фон; потом его заменяет рамка с растущей дыркой. */}
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: bg }, fill]} />
        <Animated.View style={[styles.frame, { borderColor: bg }, frame]} />
        <Animated.View style={[StyleSheet.absoluteFill, wordSt]} pointerEvents="none">
          <Svg width={width} height={height} viewBox={`0 0 390 ${(390 * height) / width}`} preserveAspectRatio="xMidYMid slice">
            {STREETS.map(([d, w]) => <Street key={d} d={d} w={w} color={line} t={t} />)}
          </Svg>
          <View style={[styles.word, { left: (width - WORD_W) / 2, top: height / 2 - WORD_H - 40 }]} accessibilityRole="header" accessibilityLabel="рядом.">
            <Svg width={WORD_W} height={WORD_H} viewBox={`0 0 ${WORD_VIEWBOX.w} ${WORD_VIEWBOX.h}`}>
              <Defs>
                <Mask id="splashWord" maskUnits="userSpaceOnUse" x={-20} y={-20} width={WORD_VIEWBOX.w + 40} height={WORD_VIEWBOX.h + 40}>
                  {WORD_STROKES.map((s, i) => <Stroke key={i} {...s} t={t} />)}
                </Mask>
              </Defs>
              <Path d={WORD_GLYPH} fill={ink} mask="url(#splashWord)" />
            </Svg>
          </View>
        </Animated.View>
        <View style={[styles.dotWrap, { left: width / 2 - 9, top: height / 2 - 9 }]} pointerEvents="none">
          <Animated.View style={[styles.ring, { borderColor: dotC }, ringSt]} />
          <Animated.View style={[styles.dot, { backgroundColor: dotC }, dot]} />
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  frame: { position: 'absolute', borderWidth: B },
  word: { position: 'absolute', width: WORD_W, height: WORD_H },
  dotWrap: { position: 'absolute', width: 18, height: 18, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 18, height: 18, borderRadius: 9 },
  ring: { position: 'absolute', width: 18, height: 18, borderRadius: 9, borderWidth: 2.5 },
});
