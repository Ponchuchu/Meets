// Стикер в чате: по нажатию — звук и короткое движение (у каждого своё: сердце бьётся, огонь вспыхивает, мем подпрыгивает).
import { Pressable } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import type { Sticker } from './catalog';
import { StickerView } from './StickerView';
import { playReaction } from './reactions';

export function InteractiveSticker({ st }: { st: Sticker }) {
  const x = useSharedValue(0); const r = useSharedValue(0); const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }, { rotate: `${r.get()}deg` }, { scale: scale.get() }] }));
  const tap = () => {
    playReaction(st.sound);
    if (st.anim === 'punch' || st.anim === 'rattle' || st.anim === 'slam') x.set(withSequence(withTiming(-12, { duration: 60 }), withTiming(12, { duration: 60 }), withTiming(-7, { duration: 60 }), withTiming(0, { duration: 90 })));
    if (st.anim === 'laugh' || st.anim === 'sixseven' || st.anim === 'wobble' || st.anim === 'sway') r.set(withSequence(withTiming(-12, { duration: 90 }), withTiming(12, { duration: 110 }), withTiming(-6, { duration: 100 }), withTiming(0, { duration: 120 })));
    scale.set(st.anim === 'heartbeat'
      ? withSequence(withTiming(1.22, { duration: 110 }), withTiming(1, { duration: 100 }), withTiming(1.14, { duration: 100 }), withTiming(1, { duration: 260 }))
      : withSequence(withTiming(1.16, { duration: 140 }), withTiming(0.94, { duration: 140 }), withTiming(1, { duration: 220 })));
  };
  return <Pressable onPress={tap} accessibilityRole="button" accessibilityLabel={`${st.label}. Нажми — сыграет`}><Animated.View style={style}><StickerView st={st} size="lg" /></Animated.View></Pressable>;
}
