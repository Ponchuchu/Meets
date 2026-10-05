// Кнопки справа под верхом карты (FIX1 И2 п.5): компас (стрелка на север крутится вместе с картой; тап — север вверх,
// второй тап — следовать за мной с поворотом), пилюля «+ / −», «ко мне».
import { LocateFixed, Minus, Plus } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../../theme';
import { glass } from '../../ui/glass';

export function MapControls({ top, bearing, follow, onCompass, onZoom, onMe }: {
  top: number; bearing: SharedValue<number>; follow: boolean; onCompass: () => void; onZoom: (d: number) => void; onMe: () => void;
}) {
  const needle = useAnimatedStyle(() => ({ transform: [{ rotate: `${-bearing.get()}deg` }] }));
  return (
    <View style={[styles.col, { top }]} pointerEvents="box-none">
      <Pressable onPress={onCompass} style={({ pressed }) => [styles.round, glass, follow && styles.on, pressed && styles.pressed]}
        accessibilityRole="button" accessibilityLabel={follow ? 'Компас: карта следует за тобой. Нажми, чтобы выключить' : 'Компас: север вверх, второй тап — следовать за мной'}>
        <Animated.View style={needle}>
          <Svg width={26} height={26} viewBox="0 0 26 26">
            <Path d="M13 2L17.5 13H8.5Z" fill={colors.accent} />
            <Path d="M13 24L8.5 13H17.5Z" fill={follow ? '#FBFAF6' : '#D9D3C7'} />
          </Svg>
        </Animated.View>
      </Pressable>
      <View style={[styles.pill, glass]}>
        <Pressable onPress={() => onZoom(1)} style={({ pressed }) => [styles.half, pressed && styles.pressedBg]} accessibilityRole="button" accessibilityLabel="Приблизить">
          <Plus size={20} color={colors.ink} strokeWidth={1.9} />
        </Pressable>
        <View style={styles.sep} />
        <Pressable onPress={() => onZoom(-1)} style={({ pressed }) => [styles.half, pressed && styles.pressedBg]} accessibilityRole="button" accessibilityLabel="Отдалить">
          <Minus size={20} color={colors.ink} strokeWidth={1.9} />
        </Pressable>
      </View>
      <Pressable onPress={onMe} style={({ pressed }) => [styles.round, glass, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel="Ко мне">
        <LocateFixed size={21} color={colors.accent} strokeWidth={1.9} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  col: { position: 'absolute', right: 16, gap: 10, alignItems: 'center' },
  round: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  on: { backgroundColor: colors.ink },
  pressed: { transform: [{ scale: 0.92 }] },
  pill: { width: 46, borderRadius: 23, overflow: 'hidden' },
  half: { height: 46, alignItems: 'center', justifyContent: 'center' },
  pressedBg: { backgroundColor: 'rgba(23,22,26,0.06)' },
  sep: { height: 1, marginHorizontal: 10, backgroundColor: '#E6E1D6' },
});
