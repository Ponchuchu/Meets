import { Pressable } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import type { Sticker } from './catalog';
import { StickerView } from './StickerView';
import { playReaction } from './reactions';
export function InteractiveSticker({ st }: { st: Sticker }) {
  const x = useSharedValue(0); const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }, { scale: scale.get() }] }));
  const tap = () => {
    if (!st.effect) return;
    playReaction(st.effect);
    if (st.effect === 'punch') x.set(withSequence(withTiming(-12, { duration: 70 }), withTiming(12, { duration: 70 }), withTiming(-7, { duration: 70 }), withTiming(0, { duration: 100 })));
    scale.set(withSequence(withTiming(1.14, { duration: 140 }), withTiming(0.94, { duration: 140 }), withTiming(1, { duration: 220 })));
  };
  return <Pressable onPress={tap} accessibilityRole={st.effect ? 'button' : 'image'} accessibilityLabel={st.effect ? `${st.label}. Нажми для анимации и звука` : st.label}><Animated.View style={style}><StickerView st={st} size="lg" /></Animated.View></Pressable>;
}
