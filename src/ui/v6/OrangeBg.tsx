// Оранжевый фон входа и приветствия (V5Login, V5LoginDone): светлее в левом верхнем углу, темнее книзу.
import { StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

export function OrangeBg() {
  return (
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" preserveAspectRatio="none" pointerEvents="none">
      <Defs>
        <LinearGradient id="obg" x1="0" y1="0" x2="0.55" y2="1">
          <Stop offset="0" stopColor="#F7A47E" />
          <Stop offset="0.5" stopColor="#F0521F" />
          <Stop offset="1" stopColor="#D2461C" />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#obg)" />
    </Svg>
  );
}
