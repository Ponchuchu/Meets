// Мой значок: кольцо с живым эффектом (пламя, вращение, пульс, искры, радуга) и панк-наклейки статуса,
// нарисованные SVG: лента-этикетка, рваная бумага, вырезанная наклейка, скотч, взрыв, штамп.
// При «уменьшить движение» анимации стоят на месте, рисунок остаётся.
import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import Svg, { Circle, G, Path, Polygon, Rect } from 'react-native-svg';
import { statusSticker, type RingStyle } from '../../state/profile';
import { colors, fonts } from '../../theme';

const RAINBOW = ['#F0521F', '#F2B632', '#B6F23A', '#179C87', '#2447B8', '#8B4FD8'];

function useLoop(ms: number, on: boolean) {
  const t = useSharedValue(0);
  useEffect(() => {
    if (!on) return;
    t.set(withRepeat(withTiming(1, { duration: ms, easing: Easing.linear }), -1, false));
  }, [on, ms, t]);
  return t;
}

/** Языки пламени вокруг кольца: два слоя (рыжий снаружи, жёлтый внутри) мерцают вразнобой и медленно ползут по кругу. */
function Flames({ size, r, still }: { size: number; r: RingStyle; still: boolean }) {
  const box = size * 1.5;
  const c = box / 2;
  const R = size / 2 - 1;
  const t = useLoop(5200, !still);
  const f = useSharedValue(1);
  useEffect(() => {
    if (still) return;
    f.set(withRepeat(withSequence(withTiming(1.08, { duration: 180 }), withTiming(0.96, { duration: 220 }), withTiming(1.04, { duration: 160 })), -1, true));
  }, [still, f]);
  const outer = useAnimatedStyle(() => ({ transform: [{ rotate: `${t.get() * 360}deg` }, { scale: f.get() }] }));
  const inner = useAnimatedStyle(() => ({ transform: [{ rotate: `${-t.get() * 240}deg` }, { scale: 2 - f.get() }] }));
  const tongue = (h: number, w: number) => `M0 0 C${-w} 0 ${-w * 0.7} ${-h * 0.45} 0 ${-h} C${w * 0.7} ${-h * 0.45} ${w} 0 0 0Z`;
  const layer = (n: number, h: number, w: number, fill: string, shift: number) => (
    <Svg width={box} height={box}>
      {Array.from({ length: n }, (_, i) => {
        const a = (360 / n) * i + shift;
        const hh = h * (0.75 + 0.25 * Math.abs(Math.sin(i * 1.7)));
        return <G key={i} transform={`rotate(${a} ${c} ${c}) translate(${c} ${c - R + 2})`}><Path d={tongue(hh, w)} fill={fill} /></G>;
      })}
    </Svg>
  );
  return (
    <View pointerEvents="none" style={[styles.fx, { width: box, height: box, left: (size - box) / 2, top: (size - box) / 2 }]}>
      <Animated.View style={[StyleSheet.absoluteFill, outer]}>{layer(12, size * 0.22, size * 0.09, r.color, 0)}</Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, inner]}>{layer(10, size * 0.14, size * 0.07, r.second ?? '#F2B632', 18)}</Animated.View>
    </View>
  );
}

/** Искры-звёздочки вокруг кольца по очереди вспыхивают. */
function Sparkles({ size, color, still }: { size: number; color: string; still: boolean }) {
  const spots = [[-0.05, 0.12], [0.92, 0.02], [1.02, 0.78], [0.08, 0.95]];
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {spots.map(([x, y], i) => <Spark key={i} x={x * size} y={y * size} s={Math.max(8, size * 0.2)} color={color} delay={i * 420} still={still} />)}
    </View>
  );
}
function Spark({ x, y, s, color, delay, still }: { x: number; y: number; s: number; color: string; delay: number; still: boolean }) {
  const t = useSharedValue(still ? 1 : 0);
  useEffect(() => {
    if (still) return;
    t.set(withDelay(delay, withRepeat(withSequence(withTiming(1, { duration: 420 }), withTiming(0, { duration: 900 })), -1, false)));
  }, [still, delay, t]);
  const st = useAnimatedStyle(() => ({ opacity: 0.25 + 0.75 * t.get(), transform: [{ scale: 0.5 + 0.6 * t.get() }, { rotate: `${t.get() * 45}deg` }] }));
  return (
    <Animated.View style={[{ position: 'absolute', left: x - s / 2, top: y - s / 2, width: s, height: s }, st]}>
      <Svg width={s} height={s} viewBox="0 0 24 24"><Path d="M12 0c1 7 5 11 12 12-7 1-11 5-12 12-1-7-5-11-12-12 7-1 11-5 12-12z" fill={color} /></Svg>
    </Animated.View>
  );
}

/** Кольцо с узором и живым эффектом. Внутри — фото. */
export function RingView({ r, size, children, still: stillProp }: { r: RingStyle; size: number; children?: ReactNode; still?: boolean }) {
  const reduce = useReducedMotion();
  const still = !!stillProp || reduce;
  const w = Math.max(3, Math.round(size / 13));
  const R = (size - w) / 2;
  const spin = useLoop(r.fx === 'rainbow' ? 4000 : 7000, !still && (r.fx === 'spin' || r.fx === 'rainbow'));
  const pulse = useLoop(1600, !still && r.fx === 'pulse');
  const spinSt = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.get() * 360}deg` }] }));
  const haloSt = useAnimatedStyle(() => ({ opacity: 0.55 * (1 - pulse.get()), transform: [{ scale: 1 + 0.28 * pulse.get() }] }));
  const circ = 2 * Math.PI * R;
  return (
    <View style={{ width: size, height: size }}>
      {r.fx === 'flame' && <Flames size={size} r={r} still={still} />}
      {r.fx === 'pulse' && <Animated.View pointerEvents="none" style={[styles.halo, { width: size, height: size, borderRadius: size / 2, borderColor: r.color, borderWidth: w }, haloSt]} />}
      <View style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: r.second ?? '#FFFFFF' },
        r.glow && { shadowColor: r.color, shadowOpacity: 0.9, shadowRadius: size / 5, shadowOffset: { width: 0, height: 0 }, elevation: 8 }]} />
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, spinSt]}>
        <Svg width={size} height={size}>
          {r.fx === 'rainbow'
            ? RAINBOW.map((c, i) => (
              <Circle key={c} cx={size / 2} cy={size / 2} r={R} stroke={c} strokeWidth={w} fill="none"
                strokeDasharray={`${circ / RAINBOW.length} ${circ}`} strokeDashoffset={-(circ / RAINBOW.length) * i} />
            ))
            : <Circle cx={size / 2} cy={size / 2} r={R} stroke={r.color} strokeWidth={w} fill="none" strokeDasharray={r.dashed ? `${w * 1.6} ${w * 1.2}` : undefined} />}
        </Svg>
      </Animated.View>
      <View style={[styles.inner, { left: w + (r.second ? 2 : 1), top: w + (r.second ? 2 : 1), width: size - w * 2 - (r.second ? 4 : 2), height: size - w * 2 - (r.second ? 4 : 2), borderRadius: size }]}>
        {children}
      </View>
      {r.fx === 'sparkle' && <Sparkles size={size} color={r.color} still={still} />}
    </View>
  );
}

/** Рваный край: зубцы по верху и низу, псевдослучайные, но стабильные. */
function tornPoints(w: number, h: number, o: number): string {
  const pts: string[] = [];
  const step = 6;
  for (let x = 0; x <= w; x += step) pts.push(`${o + x},${o + 2.5 * Math.abs(Math.sin(x * 1.3))}`);
  pts.push(`${o + w},${o + h * 0.5}`);
  for (let x = w; x >= 0; x -= step) pts.push(`${o + x},${o + h - 2.5 * Math.abs(Math.cos(x * 0.9))}`);
  pts.push(`${o + 1.5},${o + h * 0.5}`);
  return pts.join(' ');
}
function burstPoints(w: number, h: number, o: number): string {
  const n = 16;
  const cx = o + w / 2;
  const cy = o + h / 2;
  const pts: string[] = [];
  for (let i = 0; i < n * 2; i++) {
    const a = (Math.PI * i) / n;
    const out = i % 2 === 0;
    const rx = out ? w / 2 + 7 : w / 2 - 3;
    const ry = out ? h / 2 + 8 : h / 2 - 1;
    pts.push(`${(cx + Math.cos(a) * rx).toFixed(1)},${(cy + Math.sin(a) * ry).toFixed(1)}`);
  }
  return pts.join(' ');
}

/** Панк-наклейка статуса. small — над значком на карте, big — в превью. */
export function StatusTag({ label, small, big }: { label: string; small?: boolean; big?: boolean }) {
  const st = statusSticker(label);
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  const fs = small ? 9.5 : big ? 15 : 12.5;
  const O = 12; // запас под тень, зубцы и скотч
  const burst = st.shape === 'burst';
  const px = (small ? 7 : 11) + (burst ? (small ? 6 : 10) : 0);
  const py = (small ? 3 : 6) + (burst ? (small ? 3 : 5) : 0);
  const shape = (dx: number, fill: string, stroke?: string, sw = 0) => {
    if (!box) return null;
    const { w, h } = box;
    const o = O + dx;
    switch (st.shape) {
      case 'torn': return <Polygon points={tornPoints(w, h, o)} fill={fill} />;
      case 'burst': return <Polygon points={burstPoints(w, h, o)} fill={fill} stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />;
      case 'dymo': return <Rect x={o} y={o} width={w} height={h} rx={3} fill={fill} />;
      case 'die': return <Rect x={o} y={o} width={w} height={h} rx={h / 2} fill={fill} stroke={dx ? undefined : '#FFFFFF'} strokeWidth={dx ? 0 : small ? 2.5 : 4} />;
      case 'stamp': return null;
      default: return <Rect x={o} y={o} width={w} height={h} rx={2} fill={fill} />;
    }
  };
  return (
    <View style={{ transform: [{ rotate: `${st.rot}deg` }] }}>
      {box && (
        <Svg pointerEvents="none" width={box.w + O * 2} height={box.h + O * 2} style={{ position: 'absolute', left: -O, top: -O }}>
          {st.shape !== 'stamp' && <G opacity={0.28}>{shape(small ? 1.5 : 2.5, colors.ink)}</G>}
          {shape(0, st.bg, colors.ink, burst ? (small ? 1.2 : 2) : 0)}
          {st.shape === 'dymo' && (
            <>
              <Circle cx={O + 5} cy={O + box.h / 2} r={small ? 1.2 : 1.8} fill="rgba(255,255,255,0.35)" />
              <Circle cx={O + box.w - 5} cy={O + box.h / 2} r={small ? 1.2 : 1.8} fill="rgba(255,255,255,0.35)" />
            </>
          )}
          {st.shape === 'stamp' && (
            <>
              <Rect x={O} y={O} width={box.w} height={box.h} rx={5} fill="rgba(255,255,255,0.75)" stroke={st.fg} strokeWidth={small ? 1.6 : 2.6} />
              <Rect x={O + 3} y={O + 3} width={box.w - 6} height={box.h - 6} rx={3} fill="none" stroke={st.fg} strokeWidth={small ? 0.7 : 1.1} strokeDasharray="5 1.5" />
            </>
          )}
          {st.shape === 'tape' && (
            <>
              <Rect x={O - 6} y={O - 5} width={small ? 14 : 22} height={small ? 6 : 9} fill="rgba(255,255,255,0.6)" stroke="rgba(23,22,26,0.12)" strokeWidth={0.8} transform={`rotate(-28 ${O} ${O})`} />
              <Rect x={O + box.w - (small ? 8 : 16)} y={O - 5} width={small ? 14 : 22} height={small ? 6 : 9} fill="rgba(255,255,255,0.6)" stroke="rgba(23,22,26,0.12)" strokeWidth={0.8} transform={`rotate(24 ${O + box.w} ${O})`} />
            </>
          )}
        </Svg>
      )}
      <View onLayout={(e) => { const { width, height } = e.nativeEvent.layout; if (!box || Math.abs(box.w - width) > 0.5 || Math.abs(box.h - height) > 0.5) setBox({ w: width, h: height }); }}
        style={{ paddingHorizontal: px + (st.shape === 'stamp' ? 3 : 0), paddingVertical: py + (st.shape === 'stamp' ? 2 : 0), opacity: box ? 1 : 0 }}>
        <Text style={[st.shape === 'dymo' ? styles.dymo : styles.tagText, { fontSize: fs, color: st.fg }]} numberOfLines={1}>{st.label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fx: { position: 'absolute' },
  halo: { position: 'absolute', left: 0, top: 0 },
  inner: { position: 'absolute', overflow: 'hidden', backgroundColor: colors.softGreen, alignItems: 'center', justifyContent: 'center' },
  tagText: { fontFamily: fonts.display800, letterSpacing: 0.6 },
  dymo: { fontFamily: fonts.mono600, letterSpacing: 1.6 },
});
