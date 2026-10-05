// Карточка ленты v6 (V6.md §4.1, V6PlansFly): фото 400 сверху, ниже на тёмном — название и «когда · цена».
// Причин «почему это тебе» нет — только факты. Штампы «ПОЙДУ» / «МИМО» проявляются от сдвига.
import { Image, StyleSheet, Text, View } from 'react-native';
import Animated, { Extrapolation, interpolate, type SharedValue, useAnimatedStyle } from 'react-native-reanimated';
import { photo } from '../data/photos';
import type { EventItem, Person } from '../data/types';
import { formatPrice } from '../lib/format';
import { CAT_COLOR, CAT_ICON, catFg } from '../map/icons';
import { stampOf } from '../map/ui/EventSheet';
import { colors, fonts } from '../theme';
import { Avatar } from '../ui/Avatar';
import { Ic } from '../ui/Ic';

export function feedSocial(e: EventItem, people: Person[]): { text: string; faces: { p: Person; ring?: string }[] } {
  const friends = e.friendsGoing.map((id) => people.find((p) => p.id === id)).filter(Boolean) as Person[];
  const looking = Math.max(e.lookingCount, e.lookers?.length ?? 0);
  if (friends.length) {
    const names = friends.length === 1 ? `${friends[0].name} идёт` : friends.length === 2 ? `${friends[0].name} и ${friends[1].name} идут` : `${friends[0].name}, ${friends[1].name} и ещё ${friends.length - 2} идут`;
    return { text: looking >= 3 && friends.length === 1 ? `${names} · ${looking} ищут компанию` : names, faces: friends.slice(0, 3).map((p) => ({ p, ring: colors.friend })) };
  }
  if (looking >= 3) return { text: `${looking} человек ищут компанию`, faces: [] };
  if (e.goingCount >= 3) return { text: `Идут ${e.goingCount.toLocaleString('ru-RU')}`, faces: [] };
  return { text: '', faces: [] };
}

export function FeedCard({ e, people, now, dx, stamp, height }: {
  e: EventItem; people: Person[]; now: Date; dx?: SharedValue<number>; stamp?: SharedValue<number>; height: number;
}) {
  const coverH = Math.round(height * 0.714);
  const bg = e.coverColor ?? CAT_COLOR[e.category] ?? colors.sand;
  const social = feedSocial(e, people);
  const price = formatPrice(e.priceMin, e.priceMax, e.isFree);
  const goStamp = useAnimatedStyle(() => ({ opacity: stamp?.get() === 1 ? 1 : dx ? interpolate(dx.get(), [0, 90], [0, 1], Extrapolation.CLAMP) : 0 }));
  const skipStamp = useAnimatedStyle(() => ({ opacity: stamp?.get() === -1 ? 1 : dx ? interpolate(dx.get(), [-90, 0], [1, 0], Extrapolation.CLAMP) : 0 }));
  return (
    <View style={[styles.card, { height }]} accessibilityLabel={`${e.title}. ${stampOf(e, now)}. Нажми, чтобы открыть подробности`}>
      <View style={[styles.cover, { height: coverH, backgroundColor: bg }]}>
        {e.cover ? <Image source={photo(e.cover)} style={StyleSheet.absoluteFill} resizeMode="cover" /> : (
          <View style={styles.bigIcon} pointerEvents="none"><Ic d={CAT_ICON[e.category]} size={210} color={catFg(e.category)} w={0.8} /></View>
        )}
        <View style={styles.when}><Text style={styles.whenText}>{stampOf(e, now)}{price ? ` · ${price}` : ''}</Text></View>
        <Animated.View pointerEvents="none" style={[styles.stamp, styles.stampGo, goStamp]}><Text style={[styles.stampText, { color: colors.accent }]}>ПОЙДУ</Text></Animated.View>
        <Animated.View pointerEvents="none" style={[styles.stamp, styles.stampSkip, skipStamp]}><Text style={styles.stampText}>МИМО</Text></Animated.View>
      </View>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={2}>{e.title}</Text>
        {(social.text || e.venueName) ? (
          <View style={styles.socialRow}>
            {social.faces.length > 0 && (
              <View style={{ flexDirection: 'row', paddingRight: 4 }}>
                {social.faces.map(({ p }, i) => <Avatar key={p.id} p={p} size={24} style={{ marginLeft: i ? -8 : 0, borderWidth: 2, borderColor: colors.ink }} />)}
              </View>
            )}
            <Text style={styles.social} numberOfLines={1}>{social.text || e.venueName}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 30, overflow: 'hidden', backgroundColor: colors.ink },
  cover: { overflow: 'hidden' },
  bigIcon: { position: 'absolute', right: -30, top: 40, opacity: 0.22 },
  when: { position: 'absolute', left: 16, bottom: 14, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 9, backgroundColor: 'rgba(23,22,26,0.6)' },
  whenText: { fontFamily: fonts.mono600, fontSize: 11, letterSpacing: 0.8, color: '#FBFAF6' },
  stamp: { position: 'absolute', top: 40, paddingVertical: 6, paddingHorizontal: 12, borderWidth: 3, borderRadius: 12, backgroundColor: 'rgba(251,250,246,0.9)' },
  stampGo: { left: 20, borderColor: colors.accent, transform: [{ rotate: '-12deg' }] },
  stampSkip: { right: 20, borderColor: colors.ink, transform: [{ rotate: '12deg' }] },
  stampText: { fontFamily: fonts.display800, fontSize: 26, letterSpacing: 0.5, color: colors.ink },
  body: { flex: 1, paddingHorizontal: 18, paddingTop: 16, gap: 8 },
  title: { fontFamily: fonts.display700, fontSize: 24, lineHeight: 28, letterSpacing: -0.5, color: '#FBFAF6' },
  socialRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  social: { flex: 1, fontFamily: fonts.body500, fontSize: 13.5, color: '#BDB8AD' },
});
