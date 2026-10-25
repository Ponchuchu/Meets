// Значок-награда (26 октября, картинки из Figma — src/ui/badgeArt.ts): круглый эмалевый значок с золотым ободком.
// Получен — яркий. Не получен — бледный, вокруг дуга прогресса, в углу маленький замок. Одинаковый размер везде.
import { memo } from 'react';
import { Image, Platform, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { colors } from '../theme';
import { BADGE_ART } from './badgeArt';

export const BadgeMedal = memo(function BadgeMedal({ id, got, progress = 0, size = 56 }: { id: string; icon?: string; got: boolean; progress?: number; size?: number }) {
  const art = BADGE_ART[id] ?? BADGE_ART.locked;
  const arc = 2 * Math.PI * 47;
  const lock = Math.max(16, Math.round(size * 0.3));
  return (
    <View style={{ width: size, height: size }} accessibilityIgnoresInvertColors>
      <Image source={art} style={[{ width: size, height: size }, !got && { opacity: 0.38 }, !got && Platform.OS === 'web' ? ({ filter: 'grayscale(0.85)' } as object) : null]} />
      {!got && progress > 0 && (
        <Svg width={size} height={size} viewBox="0 0 100 100" style={{ position: 'absolute' }}>
          <Circle cx={50} cy={50} r={47} stroke="rgba(23,22,26,0.1)" strokeWidth={4} fill="none" />
          <Circle cx={50} cy={50} r={47} stroke={colors.accent} strokeWidth={4} fill="none" strokeLinecap="round"
            strokeDasharray={`${Math.max(4, arc * Math.min(1, progress))} ${arc}`} transform="rotate(-90 50 50)" />
        </Svg>
      )}
      {!got && size >= 40 && (
        <View style={{ position: 'absolute', right: -2, bottom: -2, width: lock, height: lock, borderRadius: lock / 2, backgroundColor: colors.ink, borderWidth: 2, borderColor: colors.paper, alignItems: 'center', justifyContent: 'center' }}>
          <Svg width={lock * 0.55} height={lock * 0.55} viewBox="0 0 24 24"><Path d="M7 11V8a5 5 0 0110 0v3M5 11h14v10H5z" stroke="#FFFFFF" strokeWidth={2.6} fill="none" strokeLinejoin="round" /></Svg>
        </View>
      )}
    </View>
  );
});
