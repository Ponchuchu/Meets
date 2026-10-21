// «Мои места» на карте (21 окт.): дом, работа, учёба и другие — круглый значок со своей иконкой и хвостиком.
// Видишь только ты: точки берутся из твоих мест (user_places_points), друзьям не показываются.
import { Briefcase, Dumbbell, GraduationCap, Home, Star, TreePine, type LucideIcon } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { colors, fonts } from '../../theme';

export const PLACE_LOOK: Record<string, { Icon: LucideIcon; color: string; name: string }> = {
  home: { Icon: Home, color: '#F0521F', name: 'Дом' },
  work: { Icon: Briefcase, color: '#2447B8', name: 'Работа' },
  study: { Icon: GraduationCap, color: '#7E5BD6', name: 'Учёба' },
  gym: { Icon: Dumbbell, color: '#1F9AA8', name: 'Зал' },
  dacha: { Icon: TreePine, color: '#2F8F5B', name: 'Дача' },
  other: { Icon: Star, color: '#C98A1B', name: 'Место' },
};

export function PlacePin({ kind, title, label }: { kind: string; title?: string; label?: boolean }) {
  const l = PLACE_LOOK[kind] ?? PLACE_LOOK.other;
  return (
    <View style={styles.wrap} pointerEvents="none" accessibilityLabel={`Моё место: ${title || l.name}`}>
      <View style={[styles.disc, { backgroundColor: l.color }]}>
        {/* Объём: блик сверху слева и тень снизу — как у значков мест города. */}
        <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
          <Defs><RadialGradient id={`pp-${kind}`} cx="35%" cy="28%" r="75%"><Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.45} /><Stop offset="0.55" stopColor="#FFFFFF" stopOpacity={0} /><Stop offset="1" stopColor="#000000" stopOpacity={0.22} /></RadialGradient></Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill={`url(#pp-${kind})`} />
        </Svg>
        <l.Icon size={19} color="#FFFFFF" strokeWidth={2.2} />
      </View>
      <View style={[styles.tail, { borderTopColor: l.color }]} />
      {label && <View style={styles.label}><Text style={styles.labelText} numberOfLines={1}>{title || l.name}</Text></View>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', width: 72 },
  disc: { width: 40, height: 40, borderRadius: 20, overflow: 'hidden', borderWidth: 2.5, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center',
    boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.5), 0 6px 12px -4px rgba(23,22,26,0.45)' },
  tail: { width: 0, height: 0, marginTop: -2, borderLeftWidth: 6, borderRightWidth: 6, borderTopWidth: 7, borderLeftColor: 'transparent', borderRightColor: 'transparent' },
  label: { marginTop: 2, maxWidth: 72, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 7, backgroundColor: 'rgba(252,251,248,0.92)' },
  labelText: { fontFamily: fonts.body700, fontSize: 9.5, color: colors.ink },
});
