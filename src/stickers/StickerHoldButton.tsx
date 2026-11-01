import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { colors, fonts } from '../theme';
import type { Sticker } from './catalog';
import { createStickerHold, STICKER_HOLD_LIMIT } from './hold';
import { StickerView } from './StickerView';

/** Map-only input. Each callback is a delta of one; the caller owns delivery and batching. */
export function StickerHoldButton({ st, index, onSticker, disabled = false, onHoldStart, onHoldEnd }: {
  st: Sticker; index: number; onSticker: (index: number, delta: number) => void; disabled?: boolean;
  onHoldStart?: () => boolean; onHoldEnd?: () => void;
}) {
  const [count, setCount] = useState(0);
  const [holding, setHolding] = useState(false);
  const wasHeld = useRef(false);
  const holdingRef = useRef(false);
  const mounted = useRef(true);
  const callbacks = useRef({ onSticker, index, onHoldEnd });
  const controller = useRef<ReturnType<typeof createStickerHold> | null>(null);
  const hide = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const countRef = useRef(0);
  const lastHaptic = useRef(-Infinity);
  const scale = useSharedValue(1);
  const rotation = useSharedValue(0);
  const progress = useSharedValue(0);
  const reduceMotion = useReducedMotion();

  useEffect(() => { callbacks.current = { onSticker, index, onHoldEnd }; }, [onSticker, index, onHoldEnd]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      controller.current?.stop();
      clearTimeout(hide.current);
      if (holdingRef.current) callbacks.current.onHoldEnd?.();
      holdingRef.current = false;
    };
  }, []);

  const stop = () => {
    controller.current?.stop();
    if (holdingRef.current) {
      holdingRef.current = false;
      setHolding(false);
      callbacks.current.onHoldEnd?.();
    }
    scale.set(withTiming(1, { duration: 140 }));
    rotation.set(withTiming(0, { duration: 140 }));
    clearTimeout(hide.current);
    if (countRef.current) hide.current = setTimeout(() => {
      if (!mounted.current) return;
      countRef.current = 0; setCount(0); progress.set(0);
    }, 700);
  };
  useEffect(() => {
    if (!holding) return;
    const sub = AppState.addEventListener('change', state => { if (state !== 'active') stop(); });
    return () => sub.remove();
    // A subscription exists only for the currently held tile.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holding]);

  const pressIn = () => {
    wasHeld.current = false;
    countRef.current = 0; setCount(0);
    clearTimeout(hide.current);
    progress.set(0);
    if (!reduceMotion) scale.set(withTiming(0.94, { duration: 100 }));
  };
  const longPress = () => {
    if (wasHeld.current) return;
    wasHeld.current = true;
    if (disabled || (AppState.currentState && AppState.currentState !== 'active') || onHoldStart?.() === false) return;
    holdingRef.current = true; setHolding(true);
    lastHaptic.current = -Infinity;
    controller.current?.stop();
    controller.current = createStickerHold(n => {
      if (!mounted.current) return;
      countRef.current = n; setCount(n);
      progress.set(withTiming(n / STICKER_HOLD_LIMIT, { duration: 50 }));
      if (!reduceMotion) {
        scale.set(withTiming(n % 2 ? 0.97 : 1.02 + n / 1600, { duration: 45 }));
        rotation.set(withTiming((n % 2 ? -1 : 1) * Math.min(5, n / 15), { duration: 45 }));
      }
      const now = Date.now();
      if (now - lastHaptic.current >= 120) {
        lastHaptic.current = now;
        const style = n >= 60 ? Haptics.ImpactFeedbackStyle.Heavy : n >= 25 ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light;
        void Haptics.impactAsync(style).catch(() => undefined);
      }
      callbacks.current.onSticker(callbacks.current.index, 1);
    });
    controller.current.start();
  };
  const tap = () => {
    if (wasHeld.current || disabled) return;
    countRef.current = 1; setCount(1);
    if (!reduceMotion) scale.set(withSequence(withTiming(1.06, { duration: 90 }), withTiming(1, { duration: 120 })));
    callbacks.current.onSticker(callbacks.current.index, 1);
    clearTimeout(hide.current);
    hide.current = setTimeout(() => { if (mounted.current) { countRef.current = 0; setCount(0); } }, 700);
  };
  const motion = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }, { rotate: `${rotation.get()}deg` }] }));
  const bar = useAnimatedStyle(() => ({ transform: [{ scaleX: progress.get() }] }));
  return <Pressable disabled={disabled} onPressIn={pressIn} onLongPress={longPress} delayLongPress={280} onPressOut={stop} onTouchCancel={stop} onPress={tap}
    accessibilityRole="button" accessibilityLabel={`Кинуть стикер «${st.label}»`} accessibilityHint="Нажми для одного стикера. Удерживай для очереди до 100"
    accessibilityState={{ disabled }} accessibilityValue={count ? { min: 0, max: STICKER_HOLD_LIMIT, now: count } : undefined}>
    <Animated.View style={[styles.tile, holding && styles.holding, motion]}>
      <StickerView st={st} size={58} />
      {count > 1 && <View pointerEvents="none" style={[styles.counter, count === STICKER_HOLD_LIMIT && styles.limit]}><Text style={styles.counterText} allowFontScaling={false}>×{count}</Text></View>}
      {holding && <View pointerEvents="none" style={styles.track}><Animated.View style={[styles.progress, bar]} /></View>}
    </Animated.View>
  </Pressable>;
}

const styles = StyleSheet.create({
  tile: { width: 66, height: 72, borderRadius: 16, borderWidth: 1.5, borderColor: 'transparent', backgroundColor: 'rgba(23,22,26,0.04)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  holding: { borderColor: colors.friend, backgroundColor: 'rgba(36,71,184,0.1)' },
  counter: { position: 'absolute', top: 3, right: 3, minWidth: 26, paddingHorizontal: 5, paddingVertical: 3, borderRadius: 10, backgroundColor: colors.ink },
  limit: { backgroundColor: colors.friend },
  counterText: { fontFamily: fonts.body700, color: '#FFFFFF', fontSize: 10, lineHeight: 12 },
  track: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 4, backgroundColor: 'rgba(36,71,184,0.15)' },
  progress: { height: 4, backgroundColor: colors.friend, transformOrigin: 'left center' },
});
