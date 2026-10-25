// Карточка в стопке v6 (V6.md §4.1): вправо — «Пойду», влево — «Мимо», вверх (60 px) или тап — раскрыть.
// «Пойду» — одна дуга (квадратичная кривая Безье) от точки отпускания к иконке «Планы»: ease-in, масштаб до 0,06,
// поворот до −18°, углы скругляются до круга. Считается в worklet по параметру t — без остановок.
import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { Platform, StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { Easing, useAnimatedReaction, useAnimatedStyle, useSharedValue, withDelay, withSequence, withSpring, withTiming, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import type { EventItem, Person } from '../data/types';
import { colors } from '../theme';
import { FeedCard } from './FeedCard';
import { HINT_IDLE_MS, hintDue, useFeed } from '../state/feed';

export const THRESHOLD = 90;
const UP = 60;
const TAP = 6;
const FLY_MS = 800;

export interface SwipeHandle {
  fly: (kind: 'go' | 'skip') => void;
}

export const SwipeCard = forwardRef<SwipeHandle, {
  e: EventItem; people: Person[]; now: Date;
  k: number; top: boolean; width: number; height: number;
  /** Куда лететь «Пойду»: смещение от центра карточки до иконки «Планы». */
  target: { x: number; y: number };
  enterFrom: 'go' | 'skip' | null;
  onDecide: (kind: 'go' | 'skip') => void;
  onTap: () => void;
  expand: SharedValue<number>;
  onReveal: () => void;
  onRevealEnd: (commit: boolean) => void;
  onUndo: () => void;
  /** Карточка коснулась иконки «Планы» — панель подпрыгивает. */
  onLand?: () => void;
  /** Куда отдавать смещение верхней карточки — для подсказок жестов и подсветки краёв. */
  drag?: { x: SharedValue<number>; y: SharedValue<number> };
}>(function SwipeCard({ e, people, now, k, top, width, height, target, enterFrom, onDecide, onTap, onLand, expand, onReveal, onRevealEnd, onUndo, drag }, ref) {
  const dx = useSharedValue(0);
  const dy = useSharedValue(0);
  const rot = useSharedValue(0);
  const t = useSharedValue(0); // 0…1 — полёт по дуге
  const sx = useSharedValue(0); // точка отпускания
  const sy = useSharedValue(0);
  const sr = useSharedValue(0);
  const op = useSharedValue(1);
  const busy = useSharedValue(false);
  const stamp = useSharedValue(0);
  const revealing = useSharedValue(false);

  // Смещение верхней карточки — наружу (подсказки под карточкой и свечение по краям).
  useAnimatedReaction(() => dx.get(), (v) => { if (top && drag) drag.x.set(v); });
  useAnimatedReaction(() => dy.get(), (v) => { if (top && drag) drag.y.set(v); });

  // Подсказка жестом (FIX5): карточка сама чуть уходит вправо и вверх, только если на ней долго ничего не делают (45 с),
  // и редко — первый раз, через 5 дней, через месяц, потом никогда. Любое касание сбрасывает ожидание.
  const [touched, setTouched] = useState(0);
  const touch = () => setTouched((c) => c + 1);
  useEffect(() => {
    if (!top || enterFrom || !hintDue(useFeed.getState().hintShown, Date.now())) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const play = () => {
      if (busy.get() || revealing.get() || !hintDue(useFeed.getState().hintShown, Date.now())) return;
      useFeed.getState().markHint(Date.now());
      const ease = Easing.inOut(Easing.cubic);
      dx.set(withSequence(withTiming(46, { duration: 520, easing: Easing.out(Easing.cubic) }), withDelay(260, withTiming(0, { duration: 460, easing: ease }))));
      rot.set(withSequence(withTiming(4, { duration: 520 }), withDelay(260, withTiming(0, { duration: 460 }))));
      timers.push(setTimeout(() => {
        if (busy.get() || revealing.get()) return;
        dy.set(withSequence(withTiming(-30, { duration: 420, easing: Easing.out(Easing.cubic) }), withDelay(160, withTiming(0, { duration: 420, easing: ease }))));
      }, 1900));
    };
    timers.push(setTimeout(play, HINT_IDLE_MS));
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [top, touched, enterFrom]);

  // «Вернуть»: карточка появляется с той стороны, куда ушла.
  useEffect(() => {
    if (enterFrom === 'skip') {
      dx.set(-560); dy.set(60); rot.set(-22);
      dx.set(withTiming(0, { duration: 320, easing: Easing.out(Easing.cubic) }));
      dy.set(withTiming(0, { duration: 320 }));
      rot.set(withTiming(0, { duration: 320 }));
    } else if (enterFrom === 'go') {
      sx.set(0); sy.set(0); sr.set(0); t.set(1); op.set(0);
      t.set(withTiming(0, { duration: 420, easing: Easing.out(Easing.cubic) }));
      op.set(withTiming(1, { duration: 200 }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fly = (kind: 'go' | 'skip') => {
    'worklet';
    if (busy.get()) return;
    busy.set(true);
    stamp.set(kind === 'go' ? 1 : -1);
    if (kind === 'skip') {
      dx.set(withTiming(-560, { duration: 320, easing: Easing.in(Easing.quad) }));
      dy.set(withTiming(60, { duration: 320, easing: Easing.in(Easing.quad) }));
      rot.set(withTiming(-22, { duration: 320 }, () => scheduleOnRN(onDecide, 'skip')));
      return;
    }
    sx.set(dx.get()); sy.set(dy.get()); sr.set(rot.get());
    dx.set(0); dy.set(0); rot.set(0);
    t.set(withTiming(1, { duration: FLY_MS, easing: Easing.in(Easing.cubic) }, (done) => {
      if (!done) return;
      if (onLand) scheduleOnRN(onLand);
      scheduleOnRN(onDecide, 'go');
    }));
  };

  useImperativeHandle(ref, () => ({ fly: (kind) => fly(kind) }));

  const pan = Gesture.Pan()
    .enabled(top)
    .minDistance(0)
    .onBegin(() => {
      scheduleOnRN(touch);
      // Касание посреди подсказывающего движения — карточка сразу возвращается на место.
      if (!busy.get() && (dx.get() !== 0 || dy.get() !== 0)) {
        dx.set(withTiming(0, { duration: 140 })); dy.set(withTiming(0, { duration: 140 })); rot.set(withTiming(0, { duration: 140 }));
      }
    })
    .onChange((ev) => {
      if (busy.get()) return;
      // Раскрытие вверх: хватает лёгкого движения; направление — по соотношению, а не по жёсткому коридору (палец ходит дугой).
      if (!revealing.get() && ev.translationY < -8 && -ev.translationY > Math.abs(ev.translationX) * 1.1) {
        revealing.set(true); scheduleOnRN(onReveal);
      }
      if (revealing.get()) { expand.set(Math.max(0, Math.min(1, -ev.translationY / 300))); return; }
      dx.set(ev.translationX);
      dy.set(ev.translationY < 0 ? ev.translationY * 0.6 : ev.translationY * 0.3);
      rot.set(Math.max(-9, Math.min(9, ev.translationX / 18)));
    })
    .onEnd((ev) => {
      if (busy.get()) return;
      if (revealing.get()) {
        revealing.set(false); dx.set(0); dy.set(0); rot.set(0);
        scheduleOnRN(onRevealEnd, expand.get() > 0.12 || ev.velocityY < -350); return;
      }
      if (ev.translationY > 70 && Math.abs(ev.translationX) < 50) {
        dx.set(0); dy.set(0); rot.set(0); scheduleOnRN(onUndo); return;
      }
      const fast = Math.abs(ev.velocityX) > 800 && Math.abs(ev.translationX) > Math.abs(ev.translationY);
      if (Math.abs(ev.translationX) < TAP && Math.abs(ev.translationY) < TAP) {
        dx.set(0); dy.set(0); rot.set(0);
        scheduleOnRN(onTap);
      } else if (ev.translationX > THRESHOLD || (fast && ev.velocityX > 0)) fly('go');
      else if (ev.translationX < -THRESHOLD || (fast && ev.velocityX < 0)) fly('skip');
      else {
        if (ev.translationY < -UP && Math.abs(ev.translationX) < THRESHOLD) scheduleOnRN(onTap);
        dx.set(withSpring(0, { damping: 26, stiffness: 220, overshootClamping: true }));
        dy.set(withSpring(0, { damping: 26, stiffness: 220, overshootClamping: true }));
        rot.set(withSpring(0, { damping: 26, stiffness: 220, overshootClamping: true }));
      }
    }).onFinalize((_e,success)=>{if(!success&&revealing.get()){revealing.set(false);scheduleOnRN(onRevealEnd,false);}});

  // Под верхней: сдвиг 14 px и масштаб 0,95 на каждую; поднимаются плавно.
  const stack = useAnimatedStyle(() => ({
    transform: [{ translateY: withTiming(k * 14, { duration: 400 }) }, { scale: withTiming(1 - k * 0.05, { duration: 400 }) }],
  }));
  const card = useAnimatedStyle(() => {
    const p = t.get();
    // Квадратичная Безье: старт → контрольная (выше и правее, но в пределах экрана) → иконка «Планы».
    const cx = sx.get() + (target.x - sx.get()) * 0.55 + 40;
    const cy = Math.min(sy.get(), target.y) - 160;
    const q = 1 - p;
    const x = q * q * sx.get() + 2 * q * p * cx + p * p * target.x;
    const y = q * q * sy.get() + 2 * q * p * cy + p * p * target.y;
    return {
      // В самом конце полёта кружок растворяется в значке «Планы».
      opacity: op.get() * (1 - Math.max(0, (p - 0.9) / 0.1)),
      borderRadius: 30 + (Math.min(width, height) / 2 - 30) * p,
      transform: [
        { translateX: dx.get() + x }, { translateY: dy.get() + y },
        { rotate: `${rot.get() + sr.get() * q + -18 * p}deg` }, { scale: 1 - 0.94 * p },
      ],
    };
  });

  return (
    <Animated.View style={[styles.abs, { width, height, zIndex: 10 - k, transformOrigin: '50% 100%' }, stack]} pointerEvents={top ? 'auto' : 'none'}>
      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.fill, styles.shadow, !top && styles.shadowLow, card, { overflow: 'hidden' }, top && LAYER]}>
          <FeedCard e={e} people={people} now={now} dx={top ? dx : undefined} stamp={top ? stamp : undefined} height={height} />
        </Animated.View>
      </GestureDetector>
    </Animated.View>
  );
});

// Web: верхняя карточка — отдельный слой, поворот не перерисовывает фото на каждом кадре.
const LAYER = Platform.OS === 'web' ? ({ willChange: 'transform' } as object) : null;

const styles = StyleSheet.create({
  abs: { position: 'absolute', left: 0, top: 0 },
  fill: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 },
  shadow: { borderRadius: 30, shadowColor: colors.ink, shadowOpacity: 0.2, shadowRadius: 18, shadowOffset: { width: 0, height: 14 }, elevation: 8 },
  shadowLow: { shadowOpacity: 0.1, shadowRadius: 8, shadowOffset: { width: 0, height: 6 }, elevation: 3 },
});
