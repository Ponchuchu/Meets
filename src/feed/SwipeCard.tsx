// Карточка в стопке с жестами: перетаскивание (Y ×0.4, поворот dx/18), порог 90 px, тап < 6 px,
// «мимо» — улёт влево за 320 мс, «пойду» — дугой в иконку «Профиль» за 640 мс, «вернуть» — обратно с той стороны.
import { forwardRef, useEffect, useImperativeHandle } from 'react';
import { Platform, StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import type { EventItem, Person } from '../data/types';
import { colors } from '../theme';
import { FeedCard } from './FeedCard';

export const THRESHOLD = 90;
const TAP = 6;

export interface SwipeHandle {
  fly: (kind: 'go' | 'skip') => void;
}

export const SwipeCard = forwardRef<SwipeHandle, {
  e: EventItem; people: Person[]; now: Date; saved: boolean; onSave: () => void;
  k: number; top: boolean; width: number; height: number;
  /** Куда лететь «пойду»: смещение центра карточки до иконки «Профиль». */
  target: { x: number; y: number };
  enterFrom: 'go' | 'skip' | null;
  onDecide: (kind: 'go' | 'skip') => void;
  onTap: () => void;
}>(function SwipeCard({ e, people, now, saved, onSave, k, top, width, height, target, enterFrom, onDecide, onTap }, ref) {
  const dx = useSharedValue(0);
  const dy = useSharedValue(0);
  const rot = useSharedValue(0);
  const ox = useSharedValue(0); // внешний слой: X полёта
  const oy = useSharedValue(0); // внутренний: Y полёта
  const os = useSharedValue(1);
  const op = useSharedValue(1);
  const busy = useSharedValue(false);
  const stamp = useSharedValue(0); // во время полёта штамп остаётся: 1 — «ПОЙДУ», −1 — «МИМО»

  // «Вернуть»: карточка появляется с той стороны, куда ушла, и становится первой.
  useEffect(() => {
    if (enterFrom === 'skip') {
      dx.value = -560; dy.value = 60; rot.value = -22;
      dx.value = withTiming(0, { duration: 320, easing: Easing.out(Easing.cubic) });
      dy.value = withTiming(0, { duration: 320 });
      rot.value = withTiming(0, { duration: 320 });
    } else if (enterFrom === 'go') {
      ox.value = target.x; oy.value = target.y; os.value = 0.06; op.value = 0;
      ox.value = withTiming(0, { duration: 420, easing: Easing.out(Easing.cubic) });
      oy.value = withTiming(0, { duration: 420, easing: Easing.out(Easing.cubic) });
      os.value = withTiming(1, { duration: 420 });
      op.value = withTiming(1, { duration: 200 });
    }
    // Только при появлении.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fly = (kind: 'go' | 'skip') => {
    'worklet';
    if (busy.value) return;
    busy.value = true;
    stamp.value = kind === 'go' ? 1 : -1;
    if (kind === 'skip') {
      dx.value = withTiming(-560, { duration: 320, easing: Easing.in(Easing.quad) });
      dy.value = withTiming(60, { duration: 320, easing: Easing.in(Easing.quad) });
      rot.value = withTiming(-22, { duration: 320 }, () => scheduleOnRN(onDecide, 'skip'));
    } else {
      // Две вложенные анимации: X — ease-out, Y и масштаб — ease-in: получается дуга.
      dx.value = withTiming(0, { duration: 360, easing: Easing.out(Easing.quad) });
      dy.value = withTiming(0, { duration: 360, easing: Easing.out(Easing.quad) });
      rot.value = withTiming(0, { duration: 360 });
      ox.value = withTiming(target.x, { duration: 620, easing: Easing.bezier(0.25, 0.7, 0.4, 1) });
      oy.value = withTiming(target.y, { duration: 620, easing: Easing.bezier(0.6, 0, 0.85, 0.45) });
      os.value = withTiming(0.06, { duration: 620, easing: Easing.bezier(0.6, 0, 0.85, 0.45) });
      op.value = withDelay(460, withTiming(0, { duration: 160 }, () => scheduleOnRN(onDecide, 'go')));
    }
  };

  useImperativeHandle(ref, () => ({ fly: (kind) => fly(kind) }));

  const pan = Gesture.Pan()
    .enabled(top)
    .minDistance(0)
    .onChange((ev) => {
      if (busy.value) return;
      dx.value = ev.translationX;
      dy.value = ev.translationY * 0.4;
      rot.value = ev.translationX / 18;
    })
    .onEnd((ev) => {
      if (busy.value) return;
      if (Math.abs(ev.translationX) < TAP && Math.abs(ev.translationY) < TAP) {
        dx.value = 0; dy.value = 0; rot.value = 0;
        // Тап по закладке (правый верхний угол) — только «в избранное», карточку не открываем.
        if (ev.x > width - 72 && ev.y < 76) return;
        scheduleOnRN(onTap);
      } else if (ev.translationX > THRESHOLD) fly('go');
      else if (ev.translationX < -THRESHOLD) fly('skip');
      else {
        dx.value = withSpring(0, { damping: 16, stiffness: 180 });
        dy.value = withSpring(0, { damping: 16, stiffness: 180 });
        rot.value = withSpring(0, { damping: 16, stiffness: 180 });
      }
    });

  // Карточки под верхней: 8 px × n вниз и масштаб 1 − 0.05 × n; поднимаются плавно.
  const stack = useAnimatedStyle(() => ({
    transform: [{ translateY: withTiming(k * 8, { duration: 300 }) }, { scale: withTiming(1 - k * 0.05, { duration: 300 }) }],
  }));
  const outer = useAnimatedStyle(() => ({ transform: [{ translateX: ox.value }] }));
  const inner = useAnimatedStyle(() => ({ opacity: op.value, transform: [{ translateY: oy.value }, { scale: os.value }] }));
  const drag = useAnimatedStyle(() => ({
    transform: [{ translateX: dx.value }, { translateY: dy.value }, { rotate: `${rot.value}deg` }],
  }));

  return (
    <Animated.View style={[styles.abs, { width, height, zIndex: 10 - k, transformOrigin: '50% 100%' }, stack]} pointerEvents={top ? 'auto' : 'none'}>
      <Animated.View style={[styles.fill, outer]}>
        <Animated.View style={[styles.fill, inner]}>
          <GestureDetector gesture={pan}>
            <Animated.View style={[styles.fill, styles.shadow, !top && styles.shadowLow, drag, { transformOrigin: '50% 100%' }, top && LAYER]}>
              <FeedCard e={e} people={people} now={now} saved={saved} onSave={onSave} dx={top ? dx : undefined} stamp={top ? stamp : undefined} height={height} top={top} />
            </Animated.View>
          </GestureDetector>
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
});

// Web: верхняя карточка — отдельный слой, поворот не перерисовывает фото на каждом кадре (npm run perf: 10 → 37+ к/с).
const LAYER = Platform.OS === 'web' ? ({ willChange: 'transform' } as object) : null;

const styles = StyleSheet.create({
  abs: { position: 'absolute', left: 0, top: 0 },
  fill: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 },
  shadow: { borderRadius: 26, shadowColor: colors.ink, shadowOpacity: 0.18, shadowRadius: 17, shadowOffset: { width: 0, height: 14 }, elevation: 8 },
  shadowLow: { shadowOpacity: 0.1, shadowRadius: 8, shadowOffset: { width: 0, height: 6 }, elevation: 3 },
});
