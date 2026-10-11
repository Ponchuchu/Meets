// Живая заставка (V6.md §2.1, переделана 11 октября): один раз за холодный запуск, ≤ 3,3 с, тап — пропустить.
// 0–0,8 с улицы · 0,2–1,5 с «Meets» пишется · 1,5–1,95 с точка падает в конец названия ·
// затем ждём, пока карта под заставкой реально загрузится (не дольше 4,5 с), и она раскрывается кругом из этой точки (0,7 с) ·
// потом карта плавно приближается к тебе (MapScreen слушает settled) · заставка уходит. Сразу после «Добро пожаловать» не показываем — флаг skipSplash().
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  Easing, FadeOut, interpolate, useAnimatedProps, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Defs, Mask, Path, Rect } from 'react-native-svg';
import { create } from 'zustand';
import { WORD_DOT, WORD_GLYPH, WORD_VIEWBOX } from './splashWord';

let played = false;
export const skipSplash = () => { played = true; useIntro.getState().set(false); useIntro.getState().settle(); };

/** splash — идёт ли заставка (обучение ждёт её конца); settled — пора приблизить камеру к тебе. */
export const useIntro = create<{ splash: boolean; settled: boolean; mapReady: boolean; set: (v: boolean) => void; settle: () => void; ready: () => void }>((set) => ({
  splash: !played, settled: played, mapReady: played, set: (splash) => set({ splash }), settle: () => set({ settled: true }), ready: () => set({ mapReady: true }),
}));

const B = 1400; // толщина «рамки» вокруг растущего круга
const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedRect = Animated.createAnimatedComponent(Rect);
const WORD_W = 300;
const SCALE = WORD_W / WORD_VIEWBOX.w;
const WORD_H = WORD_VIEWBOX.h * SCALE;
/** Где в слове стоит точка (в пикселях от левого верха слова). */
const DOT_X = (WORD_DOT.x - WORD_VIEWBOX.x) * SCALE;
const DOT_Y = (WORD_DOT.y - WORD_VIEWBOX.y) * SCALE;
const DOT_D = 18;
// Улицы фоном (те же, что в макете, на экране 390×844).
const STREETS: [string, number][] = [
  ['M0 150H390', 5], ['M0 286H390', 2.5], ['M0 560H390', 5], ['M0 660H390', 2.5],
  ['M58 0V700', 5], ['M150 0V700', 2.5], ['M302 0V700', 5], ['M-40 720L430 110', 7],
  ['M232 0C226 180 256 320 240 520C230 620 262 700 250 844', 3.5],
  ['M0 740C70 712 120 748 190 722C260 698 320 730 390 704', 3], ['M0 792C80 768 140 800 214 776C290 752 340 782 390 760', 3],
  ['M318 200h48v70h-48z', 2.5], ['M86 600h50v40h-50z', 2.5], ['M20 40C90 70 120 30 180 52', 2],
];

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
  const t = useSharedValue(reduce ? 1450 : 0); // улицы
  const write = useSharedValue(reduce ? 1 : 0); // «письмо» слева направо
  const drop = useSharedValue(reduce ? 0 : -170); // точка падает в конец слова
  const dotOpacity = useSharedValue(reduce ? 1 : 0);
  const ring = useSharedValue(0);
  const hole = useSharedValue(0); // карта раскрывается из точки
  const word = useSharedValue(1);

  const end = () => { played = true; setOn(false); useIntro.getState().set(false); useIntro.getState().settle(); };

  useEffect(() => {
    if (!on) return;
    if (reduce) { const r = setTimeout(end, 700); return () => clearTimeout(r); }
    const t0 = Date.now();
    t.set(withTiming(1450, { duration: 1450, easing: Easing.linear }));
    write.set(withDelay(200, withTiming(1, { duration: 1300, easing: Easing.bezier(0.45, 0, 0.35, 1) })));
    dotOpacity.set(withDelay(1480, withTiming(1, { duration: 80 })));
    drop.set(withDelay(1500, withTiming(0, { duration: 460, easing: Easing.bounce })));
    ring.set(withDelay(1930, withTiming(1, { duration: 520, easing: Easing.out(Easing.quad) })));
    // Раскрытие — только когда слово дописано, точка упала и карта загрузилась; иначе под заставкой была бы пустая подложка.
    let opened = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const open = () => {
      if (opened) return;
      opened = true;
      hole.set(withTiming(1, { duration: 700, easing: Easing.bezier(0.6, 0, 0.2, 1) }));
      word.set(withDelay(100, withTiming(0, { duration: 260 })));
      timers.push(setTimeout(() => useIntro.getState().settle(), 700), setTimeout(end, 1250));
    };
    const tryOpen = () => { if (Date.now() - t0 >= 2050 && useIntro.getState().mapReady) timers.push(setTimeout(open, 250)); };
    timers.push(setTimeout(tryOpen, 2050), setTimeout(open, 4500));
    const unsub = useIntro.subscribe(tryOpen);
    return () => { timers.forEach(clearTimeout); unsub(); };
  }, [on]); // eslint-disable-line react-hooks/exhaustive-deps

  const bg = '#F0521F';
  const ink = '#17161A';
  const dotC = '#EEE9DE';
  const line = 'rgba(23,22,26,0.13)';
  // Слово по центру экрана; точка — в его конце. Из этой точки раскрывается карта.
  const wordLeft = (width - WORD_W) / 2;
  const wordTop = height / 2 - WORD_H / 2 - 30;
  const cx = wordLeft + DOT_X;
  const cy = wordTop + DOT_Y;
  const maxR = Math.max(Math.hypot(cx, cy), Math.hypot(width - cx, cy), Math.hypot(cx, height - cy), Math.hypot(width - cx, height - cy)) + 20;
  const frame = useAnimatedStyle(() => {
    const r = hole.get() * maxR;
    const s = 2 * (r + B);
    return { width: s, height: s, borderRadius: s / 2, left: cx - s / 2, top: cy - s / 2 };
  });
  const fill = useAnimatedStyle(() => ({ opacity: hole.get() > 0 ? 0 : 1 }));
  const dot = useAnimatedStyle(() => ({
    opacity: dotOpacity.get() * (1 - hole.get()),
    transform: [{ translateY: drop.get() }],
  }));
  const ringSt = useAnimatedStyle(() => ({ opacity: ring.get() > 0 ? (1 - ring.get()) * 0.8 : 0, transform: [{ scale: 0.3 + ring.get() * 3.1 }] }));
  const wordSt = useAnimatedStyle(() => ({ opacity: word.get() }));
  const wipe = useAnimatedProps(() => ({ width: interpolate(write.get(), [0, 1], [0, WORD_VIEWBOX.w], 'clamp') }));

  if (!on) return null;
  return (
    <Animated.View style={[StyleSheet.absoluteFill, { zIndex: 90, elevation: 25 }]} exiting={FadeOut.duration(300)} onLayout={onLayout}>
      <Pressable style={StyleSheet.absoluteFill} onPress={end} accessibilityRole="button" accessibilityLabel="Пропустить заставку">
        {/* До раскрытия — сплошной фон; потом его заменяет рамка с растущей дыркой. */}
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: bg }, fill]} />
        <Animated.View style={[styles.frame, { borderColor: bg }, frame]} />
        <Animated.View style={[StyleSheet.absoluteFill, wordSt]} pointerEvents="none">
          <Svg width={width} height={height} viewBox={`0 0 390 ${(390 * height) / width}`} preserveAspectRatio="xMidYMid slice">
            {STREETS.map(([d, w]) => <Street key={d} d={d} w={w} color={line} t={t} />)}
          </Svg>
          <View style={[styles.word, { left: wordLeft, top: wordTop }]} accessibilityRole="header" accessibilityLabel="Meets">
            <Svg width={WORD_W} height={WORD_H} viewBox={`${WORD_VIEWBOX.x} ${WORD_VIEWBOX.y} ${WORD_VIEWBOX.w} ${WORD_VIEWBOX.h}`}>
              <Defs>
                <Mask id="splashWord" maskUnits="userSpaceOnUse" x={WORD_VIEWBOX.x} y={WORD_VIEWBOX.y} width={WORD_VIEWBOX.w} height={WORD_VIEWBOX.h}>
                  <AnimatedRect x={WORD_VIEWBOX.x} y={WORD_VIEWBOX.y} height={WORD_VIEWBOX.h} fill="#fff" animatedProps={wipe} />
                </Mask>
              </Defs>
              <Path d={WORD_GLYPH} fill={ink} mask="url(#splashWord)" />
            </Svg>
          </View>
        </Animated.View>
        <View style={[styles.dotWrap, { left: cx - DOT_D / 2, top: cy - DOT_D / 2 }]} pointerEvents="none">
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
  dotWrap: { position: 'absolute', width: DOT_D, height: DOT_D, alignItems: 'center', justifyContent: 'center' },
  dot: { width: DOT_D, height: DOT_D, borderRadius: DOT_D / 2 },
  ring: { position: 'absolute', width: DOT_D, height: DOT_D, borderRadius: DOT_D / 2, borderWidth: 2.5 },
});
