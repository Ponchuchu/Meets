// Карточка постоянного места (Шымбулак, боулинг, фотозона…): вид, сезон, бесплатно ли, и три действия —
// «Купить билет» (официальный сайт, где он точно есть), «Часы и цены» (2ГИС — там их обновляют сами места), «Маршрут».
import { router } from 'expo-router';
import { ArrowUpRight, Clock, Navigation, Ticket, X } from 'lucide-react-native';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { gisUrl, inSeason, KIND_COLOR, KIND_LABEL, seasonText, type Attraction } from '../../data/attractions';
import { now as clockNow } from '../../lib/clock';
import { useBackClose } from '../../state/app';
import { colors, fonts, radii, space } from '../../theme';
import { glass } from '../../ui/glass';
import { AttractionPin } from './AttractionPin';

export function AttractionCard({ a, onClose }: { a: Attraction; onClose: () => void }) {
  useBackClose(onClose);
  const open = inSeason(a, clockNow());
  const go = (url: string) => { void Linking.openURL(url).catch(() => undefined); };
  return (
    <Animated.View entering={SlideInDown.duration(260)} exiting={SlideOutDown.duration(200)} style={[styles.card, glass]} accessibilityLabel={`Место: ${a.name}`}>
      <View style={styles.head}>
        <View style={styles.icon} pointerEvents="none"><AttractionPin a={a} label={false} onPress={() => undefined} /></View>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={[styles.kind, { color: KIND_COLOR[a.kind] === '#3A3046' ? colors.ink : colors.accentText }]}>{KIND_LABEL[a.kind].toUpperCase()}</Text>
          <Text style={styles.title} numberOfLines={2} accessibilityRole="header">{a.name}</Text>
          <Text style={styles.about} numberOfLines={2}>{a.about}</Text>
        </View>
        <Pressable onPress={onClose} hitSlop={8} style={styles.close} accessibilityRole="button" accessibilityLabel="Закрыть карточку места"><X size={22} color={colors.ink} strokeWidth={2} /></Pressable>
      </View>
      <View style={styles.tags}>
        {a.free && <View style={[styles.tag, { backgroundColor: '#D7EBDD' }]}><Text style={[styles.tagText, { color: '#1F6B43' }]}>бесплатно</Text></View>}
        <View style={[styles.tag, !open && { backgroundColor: '#F3D9CC' }]}><Clock size={12} color={open ? colors.ink : colors.accentText} strokeWidth={2.2} /><Text style={[styles.tagText, !open && { color: colors.accentText }]}>{seasonText(a, clockNow())}</Text></View>
        {!!a.address && <View style={styles.tag}><Text style={styles.tagText} numberOfLines={1}>{a.address}</Text></View>}
      </View>
      <View style={styles.actions}>
        {a.buy && !a.free ? (
          <Pressable onPress={() => go(a.buy!)} style={({ pressed }) => [styles.btn, styles.main, pressed && styles.pressed]} accessibilityRole="link" accessibilityLabel={`Купить билет: ${a.name}`}>
            <Ticket size={18} color={colors.ink} strokeWidth={2} /><Text style={styles.btnText}>Купить билет</Text>
          </Pressable>
        ) : null}
        <Pressable onPress={() => go(gisUrl(a))} style={({ pressed }) => [styles.btn, !(a.buy && !a.free) && styles.main, pressed && styles.pressed]} accessibilityRole="link" accessibilityLabel="Часы работы и цены в 2ГИС">
          <ArrowUpRight size={18} color={colors.ink} strokeWidth={2} /><Text style={styles.btnText}>Часы и цены</Text>
        </Pressable>
        <Pressable onPress={() => router.push({ pathname: '/route', params: { id: `place-${a.id}`, lat: String(a.lat), lon: String(a.lon), title: a.name, address: a.address ?? '' } })}
          style={({ pressed }) => [styles.btn, styles.square, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel={`Маршрут: ${a.name}`}>
          <Navigation size={18} color={colors.ink} strokeWidth={2} />
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radii.xl, padding: space.l, gap: 12 },
  head: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  icon: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
  kind: { fontFamily: fonts.mono600, fontSize: 10.5, letterSpacing: 0.8 },
  title: { fontFamily: fonts.display800, fontSize: 21, lineHeight: 25, letterSpacing: -0.4, color: colors.ink },
  about: { fontFamily: fonts.body400, fontSize: 13.5, lineHeight: 18, color: colors.muted2 },
  close: { width: 44, height: 44, borderRadius: 22, marginTop: -6, marginRight: -8, alignItems: 'center', justifyContent: 'center' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 26, maxWidth: '100%', paddingHorizontal: 10, borderRadius: 13, backgroundColor: colors.sand },
  tagText: { fontFamily: fonts.body600, fontSize: 12, color: colors.ink, flexShrink: 1 },
  actions: { flexDirection: 'row', gap: 8 },
  btn: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0, flexDirection: 'row', gap: 6, height: 50, borderRadius: 16, backgroundColor: '#EDE8DD', alignItems: 'center', justifyContent: 'center' },
  main: { backgroundColor: colors.accent },
  square: { flexGrow: 0, flexShrink: 0, flexBasis: 50, width: 50 },
  btnText: { fontFamily: fonts.body700, fontSize: 14.5, color: colors.ink },
  pressed: { transform: [{ scale: 0.97 }] },
});
