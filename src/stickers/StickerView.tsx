// Стикер — как наклейка в Telegram: картинка с белой вырубкой (нарисована в Figma) без тени (убрана 27 окт. по просьбе владельца: тень только на карте).
// Текстовый мем («67», «МОГНУ») — крупные буквы с тёмным контуром и толстой белой каймой, чуть повёрнут.
import { Image, View } from 'react-native';
import Svg, { Text as SvgText } from 'react-native-svg';
import { fonts } from '../theme';
import type { Sticker } from './catalog';

export function StickerView({ st, size = 'md' }: { st: Sticker; size?: 'md' | 'lg' | number }) {
  const n = typeof size === 'number' ? size : size === 'lg' ? 150 : 82;
  return (
    <View style={{ width: n, height: n, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: `${st.rot}deg` }] }} accessibilityLabel={st.label}>
      {st.img ? <Image source={st.img} style={{ width: n * 0.96, height: n * 0.96 }} resizeMode="contain" /> : <MemeText text={st.text ?? st.label} tint={st.tint ?? '#FFD23F'} n={n} />}
    </View>
  );
}

/** Текст-наклейка: белая кайма → тёмный контур → цветная заливка с бликом. Длинное слово мельче. */
function MemeText({ text, tint, n }: { text: string; tint: string; n: number }) {
  // Ширина заглавной буквы ≈ 0,75 кегля: слово занимает не больше 80 из 100 по ширине (с каймой — почти до края).
  const fs = Math.min(52, 80 / (Math.max(1, text.length) * 0.75));
  const fit = text.length >= 3 ? { textLength: Math.min(80, text.length * fs * 0.75), lengthAdjust: 'spacingAndGlyphs' as const } : {};
  const common = { x: 50, y: 50 + fs * 0.36, fontSize: fs, fontFamily: fonts.display800, fontWeight: '800' as const, textAnchor: 'middle' as const, strokeLinejoin: 'round' as const, ...fit };
  return (
    <Svg width={n} height={n} viewBox="0 0 100 100">
      <SvgText {...common} fill="#FFFFFF" stroke="#FFFFFF" strokeWidth={fs * 0.42}>{text}</SvgText>
      <SvgText {...common} fill={tint} stroke="#1F1A26" strokeWidth={fs * 0.14}>{text}</SvgText>
      <SvgText {...common} y={common.y - fs * 0.05} fill="#FFFFFF" opacity={0.28}>{text}</SvgText>
      <SvgText {...common} fill={tint} opacity={0.75}>{text}</SvgText>
    </Svg>
  );
}
