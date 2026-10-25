// «Мои места» на карте (21 окт.): дом, работа, учёба и другие — круглый значок со своей иконкой и хвостиком.
// Видишь только ты: точки берутся из твоих мест (user_places_points), друзьям не показываются.
import { BookOpen, Briefcase, Camera, Coffee, Dog, Dumbbell, GraduationCap, Heart, Home, Mountain, Music, PartyPopper, Star, TreePine, Trees, UtensilsCrossed, type LucideIcon } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';
import { shade } from '../../ui/EventCover';
import { colors, fonts } from '../../theme';

export const PLACE_LOOK: Record<string, { Icon: LucideIcon; color: string; name: string }> = {
  home: { Icon: Home, color: '#F0521F', name: 'Дом' },
  work: { Icon: Briefcase, color: '#2447B8', name: 'Работа' },
  study: { Icon: GraduationCap, color: '#7E5BD6', name: 'Учёба' },
  gym: { Icon: Dumbbell, color: '#1F9AA8', name: 'Зал' },
  dacha: { Icon: TreePine, color: '#2F8F5B', name: 'Дача' },
  other: { Icon: Star, color: '#C98A1B', name: 'Место' },
  fav: { Icon: Heart, color: '#E0457B', name: 'Избранное' },
};

/** Значки избранных мест (21 окт.): куда хочется возвращаться — у каждого свой цвет. */
export const FAV_ICONS: Record<string, { Icon: LucideIcon; color: string; name: string }> = {
  heart: { Icon: Heart, color: '#E0457B', name: 'Любимое' },
  coffee: { Icon: Coffee, color: '#8A5A3C', name: 'Кофе' },
  food: { Icon: UtensilsCrossed, color: '#D9822B', name: 'Еда' },
  view: { Icon: Mountain, color: '#2C6FB0', name: 'Вид' },
  park: { Icon: Trees, color: '#2F8F5B', name: 'Природа' },
  sport: { Icon: Dumbbell, color: '#1F9AA8', name: 'Спорт' },
  music: { Icon: Music, color: '#9167CE', name: 'Музыка' },
  party: { Icon: PartyPopper, color: '#F0521F', name: 'Тусовка' },
  book: { Icon: BookOpen, color: '#5B5BD6', name: 'Почитать' },
  photo: { Icon: Camera, color: '#3A3046', name: 'Фото' },
  dog: { Icon: Dog, color: '#B5651D', name: 'С собакой' },
  star: { Icon: Star, color: '#C98A1B', name: 'Особое' },
};
export const lookOf = (kind: string, icon?: string | null) => (kind === 'fav' && icon && FAV_ICONS[icon]) || PLACE_LOOK[kind] || PLACE_LOOK.other;

/** Значок своего места (FIX5): объёмная булавка-капля своего цвета с бликом и белой кромкой, кончик — точно в точке,
 *  под ним мягкая тень на земле; вблизи — подпись. Видно сразу, что это «твоё», а не событие (события — круглые пуговицы). */
export function PlacePin({ kind, title, label, icon }: { kind: string; title?: string; label?: boolean; icon?: string | null }) {
  const l = lookOf(kind, icon);
  const id = `pp-${kind}-${icon ?? ''}`;
  return (
    <View style={styles.wrap} pointerEvents="none" accessibilityLabel={`Моё место: ${title || l.name}`}>
      <View style={styles.ground} />
      <View style={styles.pin}>
        <Svg width={40} height={50} viewBox="0 0 40 50" style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id={`${id}-f`} x1="0" y1="0" x2="0.4" y2="1">
              <Stop offset="0" stopColor={shade(l.color, -0.22)} />
              <Stop offset="1" stopColor={shade(l.color, 0.22)} />
            </LinearGradient>
            <RadialGradient id={`${id}-g`} cx="34%" cy="24%" r="55%">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.55} />
              <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Path d="M20 48.5c-1.2 0-12-12.2-17-21.4A18 18 0 1 1 37 27.1C32 36.3 21.2 48.5 20 48.5z" fill={`url(#${id}-f)`} stroke="#FFFFFF" strokeWidth={2.4} />
          <Path d="M20 48.5c-1.2 0-12-12.2-17-21.4A18 18 0 1 1 37 27.1C32 36.3 21.2 48.5 20 48.5z" fill={`url(#${id}-g)`} />
          <Circle cx={20} cy={19} r={11.5} fill="rgba(255,255,255,0.18)" />
        </Svg>
        <View style={styles.icon}><l.Icon size={18} color="#FFFFFF" strokeWidth={2.3} /></View>
      </View>
      {label && <View style={styles.label}><Text style={styles.labelText} numberOfLines={1}>{title || l.name}</Text></View>}
    </View>
  );
}

const styles = StyleSheet.create({
  // Кончик булавки — в центре коробки (координата места): всё поднято на высоту булавки.
  wrap: { alignItems: 'center', width: 76, height: 50, transform: [{ translateY: -25 }] },
  pin: { width: 40, height: 50, filter: 'drop-shadow(0 4px 5px rgba(23,22,26,0.35))' },
  icon: { position: 'absolute', left: 0, right: 0, top: 10, alignItems: 'center' },
  ground: { position: 'absolute', top: 45, width: 18, height: 6, borderRadius: 6, backgroundColor: 'rgba(23,22,26,0.28)' },
  label: { position: 'absolute', top: 53, maxWidth: 76, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8, backgroundColor: 'rgba(252,251,248,0.95)', boxShadow: '0 2px 6px -2px rgba(23,22,26,0.35)' },
  labelText: { fontFamily: fonts.body700, fontSize: 10, color: colors.ink },
});
