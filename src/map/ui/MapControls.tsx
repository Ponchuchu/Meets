// Кнопки справа под верхом карты (FIX1 И2 п.5): компас (стрелка на север крутится вместе с картой; тап — север вверх,
// второй тап — следовать за мной с поворотом), «2D/3D» (наклон и дома объёмом), пилюля «+ / −», «ко мне».
import { LocateFixed, Minus, Plus } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { colors, fonts } from '../../theme';
import { glass } from '../../ui/glass';

export function MapControls({ top, bearing, follow, tilt, onTilt, onCompass, onZoom, onMe }: {
  top: number; bearing: SharedValue<number>; follow: boolean; onCompass: () => void; onZoom: (d: number) => void; onMe: () => void;
  /** Нет onTilt — 3D недоступно (работает подложка без Mapbox), кнопку не показываем. */
  tilt?: boolean; onTilt?: () => void;
}) {
  const needle = useAnimatedStyle(() => ({ transform: [{ rotate: `${-bearing.get()}deg` }] }));
  return (
    <View style={[styles.col, { top }]} pointerEvents="box-none">
      <Pressable onPress={onCompass} style={({ pressed }) => [styles.round, glass, follow && styles.on, pressed && styles.pressed]}
        accessibilityRole="button" accessibilityLabel={follow ? 'Компас: карта следует за тобой. Нажми, чтобы выключить' : 'Компас: север вверх, второй тап — следовать за мной'}>
        <Animated.View style={needle}>
          <Svg width={26} height={26} viewBox="0 0 26 26">
            <Path d="M13 2L17.5 13H8.5Z" fill={colors.accent} />
            <Path d="M13 24L8.5 13H17.5Z" fill={follow ? '#EEE9DE' : '#D9D3C7'} />
          </Svg>
        </Animated.View>
      </Pressable>
      {onTilt && (
        <Pressable onPress={onTilt} style={({ pressed }) => [styles.round, glass, tilt && styles.on, pressed && styles.pressed]}
          accessibilityRole="switch" accessibilityState={{ checked: !!tilt }} accessibilityLabel={tilt ? 'Объёмная карта включена. Нажми — плоская' : 'Плоская карта. Нажми — объёмная, 3D'}>
          <Text style={[styles.tilt, tilt && { color: colors.paper }]} maxFontSizeMultiplier={1.2}>{tilt ? '2D' : '3D'}</Text>
        </Pressable>
      )}
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
  // Скруглённые квадраты 50×50 (референс «Айналма»): крупная цель для пальца, одна колонка с ровным шагом.
  col: { position: 'absolute', right: 16, gap: 10, alignItems: 'center' },
  round: { width: 50, height: 50, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  on: { backgroundColor: colors.ink },
  pressed: { transform: [{ scale: 0.92 }] },
  pill: { width: 50, borderRadius: 17, overflow: 'hidden' },
  half: { height: 48, alignItems: 'center', justifyContent: 'center' },
  pressedBg: { backgroundColor: 'rgba(23,22,26,0.06)' },
  tilt: { fontFamily: fonts.display800, fontSize: 16, letterSpacing: -0.2, color: colors.ink },
  sep: { height: 1, marginHorizontal: 10, backgroundColor: '#E6E1D6' },
});
