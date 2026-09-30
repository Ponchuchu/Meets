// Карточка ленты (Feed / FeedCards): обложка цветом или фото, закладка, крупное название, «когда · цена»,
// ниже название, адрес, 2 строки описания, кто из друзей идёт. Причин «почему это тебе» нет — только факты.
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { type SharedValue, useAnimatedStyle, interpolate, Extrapolation } from 'react-native-reanimated';
import { photo } from '../data/photos';
import type { EventItem, Person } from '../data/types';
import { coverLinesFor } from '../event/text';
import { formatPrice, formatWhen } from '../lib/format';
import { CAT_ICON, CAT_LABEL } from '../map/icons';
import { colors, fonts } from '../theme';
import { Avatar } from '../ui/Avatar';
import { Ic, IC } from '../ui/Ic';

const COVER: Partial<Record<EventItem['category'], string>> = {
  music: colors.accent, standup: colors.ink, art: colors.sand, hike: colors.ink, games: colors.softGreen, concert: colors.ink,
  food: colors.softYellow, sport: colors.softBlue, bike: colors.softBlue, theatre: colors.softPink, lecture: colors.softGreen, talks: colors.softGreen, party: colors.ink, meetup: colors.softYellow,
};

export function feedSocial(e: EventItem, people: Person[]): { text: string; faces: { p: Person; ring?: string }[] } {
  const friends = e.friendsGoing.map((id) => people.find((p) => p.id === id)).filter(Boolean) as Person[];
  const looking = Math.max(e.lookingCount, e.lookers?.length ?? 0);
  if (friends.length) {
    const names = friends.length === 1 ? `${friends[0].name} идёт` : friends.length === 2 ? `${friends[0].name} и ${friends[1].name} идут` : `${friends[0].name}, ${friends[1].name} и ещё ${friends.length - 2} идут`;
    return { text: looking >= 3 && friends.length === 1 ? `${names} · ${looking} ищут компанию` : names, faces: friends.slice(0, 3).map((p) => ({ p, ring: colors.friend })) };
  }
  const first = e.lookers?.[0] ? people.find((p) => p.id === e.lookers![0].personId) : undefined;
  if (first && looking >= 3) return { text: `${first.name} и ещё ${looking - 1} ищут компанию`, faces: [{ p: first }] };
  if (looking >= 3) return { text: `${looking} человек ищут компанию`, faces: [] };
  if (e.goingCount >= 1000) return { text: `Идут ${e.goingCount.toLocaleString('ru-RU')} · друзей пока нет`, faces: [] };
  if (e.goingCount >= 3) return { text: `Идут ${e.goingCount}`, faces: [] };
  return { text: '', faces: [] };
}

export function FeedCard({ e, people, now, saved, onSave, dx, stamp, height, top }: {
  e: EventItem; people: Person[]; now: Date; saved: boolean; onSave: () => void;
  dx?: SharedValue<number>; stamp?: SharedValue<number>; height: number; top: boolean;
}) {
  const coverH = Math.round(height * 0.64);
  const bg = e.coverColor ?? COVER[e.category] ?? colors.sand;
  const hasPhoto = !!e.cover;
  const dark = hasPhoto || bg === colors.ink;
  const fg = dark ? colors.paper : colors.ink;
  const lines = e.coverLines ?? coverLinesFor(e.title).map((t) => [t, dark ? 'paper' : 'ink'] as [string, 'ink' | 'paper']);
  const big = lines.length > 2 ? 38 : 44;
  const lineColor = (c: 'ink' | 'paper' | 'accent') => (c === 'accent' ? colors.accent : c === 'paper' ? colors.paper : colors.ink);
  const social = feedSocial(e, people);
  // Штампы проявляются пропорционально |dx| / 90.
  const goStamp = useAnimatedStyle(() => ({ opacity: stamp?.value === 1 ? 1 : dx ? interpolate(dx.value, [0, 90], [0, 1], Extrapolation.CLAMP) : 0 }));
  const skipStamp = useAnimatedStyle(() => ({ opacity: stamp?.value === -1 ? 1 : dx ? interpolate(dx.value, [-90, 0], [1, 0], Extrapolation.CLAMP) : 0 }));
  return (
    <View style={[styles.card, { height }]} accessibilityLabel={`${e.title}. Нажми, чтобы открыть подробности`}>
      <View style={[styles.cover, { height: coverH, backgroundColor: bg }]}>
        {hasPhoto && (
          <>
            <Image source={photo(e.cover)} style={StyleSheet.absoluteFill} resizeMode="cover" />
            <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(23,22,26,0.38)' }]} />
          </>
        )}
        {!hasPhoto && <View style={styles.bigIcon} pointerEvents="none"><Ic d={CAT_ICON[e.category]} size={200} color={fg} w={0.7} /></View>}
        <View style={styles.coverTop}>
          <Text style={[styles.cat, { color: fg }]}>{CAT_LABEL[e.category]}</Text>
          <Pressable onPress={onSave} disabled={!top} hitSlop={6} accessibilityRole="button" accessibilityState={{ selected: saved }}
            accessibilityLabel={saved ? 'Убрать из сохранённых' : 'Сохранить на потом'}
            style={[styles.save, { backgroundColor: saved ? '#F2B632' : 'rgba(251,250,246,0.85)' }]}>
            <Ic d={IC.bookmark} size={18} color={colors.ink} w={2} fill={saved ? colors.ink : 'none'} />
          </Pressable>
        </View>
        <View style={styles.big}>
          {lines.map(([t, c]) => <Text key={t} numberOfLines={1} adjustsFontSizeToFit style={[styles.bigText, { fontSize: big, lineHeight: big * 0.92, color: lineColor(c) }]}>{t}</Text>)}
        </View>
        <View style={[styles.strip, { borderTopColor: fg }]}>
          <Text style={[styles.stripText, { color: fg }]}>{formatWhen(e.startsAt, now)}</Text>
          <Text style={[styles.stripText, { color: fg }]}>{formatPrice(e.priceMin, e.priceMax, e.isFree)}</Text>
        </View>
        <Animated.View pointerEvents="none" style={[styles.stamp, { left: 18, transform: [{ rotate: '-12deg' }] }, goStamp]}><Text style={styles.stampText}>ПОЙДУ</Text></Animated.View>
        <Animated.View pointerEvents="none" style={[styles.stamp, { right: 18, transform: [{ rotate: '12deg' }] }, skipStamp]}><Text style={styles.stampText}>МИМО</Text></Animated.View>
      </View>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>{e.title}</Text>
        <View style={styles.addrRow}>
          <Ic d={IC.pin} c={[[12, 9, 2.5]]} size={14} color={colors.muted2} w={2} />
          <Text style={styles.addr} numberOfLines={1}>{e.address}</Text>
        </View>
        <Text style={styles.about} numberOfLines={2}>{e.about}</Text>
        <View style={styles.socialRow}>
          {social.faces.length > 0 && (
            <View style={{ flexDirection: 'row', paddingRight: 8 }}>
              {social.faces.map(({ p, ring }) => <Avatar key={p.id} p={p} size={28} ring={ring} style={{ marginRight: -8 }} />)}
            </View>
          )}
          <Text style={styles.social} numberOfLines={1}>{social.text}</Text>
          <Ic d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" size={16} color={colors.muted} w={2} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 26, overflow: 'hidden', backgroundColor: colors.card },
  cover: { overflow: 'hidden' },
  bigIcon: { position: 'absolute', right: -36, top: 34, opacity: 0.2 },
  coverTop: { position: 'absolute', left: 18, right: 12, top: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cat: { fontFamily: fonts.mono600, fontSize: 11, letterSpacing: 0.88 },
  save: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  big: { position: 'absolute', left: 18, right: 18, bottom: 50 },
  bigText: { fontFamily: fonts.display800, letterSpacing: -1.5 },
  strip: { position: 'absolute', left: 18, right: 18, bottom: 14, borderTopWidth: 1.5, paddingTop: 8, flexDirection: 'row', justifyContent: 'space-between' },
  stripText: { fontFamily: fonts.mono600, fontSize: 11, letterSpacing: 0.44 },
  stamp: { position: 'absolute', top: 70, paddingVertical: 6, paddingHorizontal: 12, borderWidth: 3, borderColor: colors.ink, borderRadius: 10, backgroundColor: colors.card },
  stampText: { fontFamily: fonts.display800, fontSize: 26, letterSpacing: 0.5, color: colors.ink },
  body: { paddingTop: 14, paddingHorizontal: 18, paddingBottom: 16, gap: 6 },
  title: { fontFamily: fonts.display700, fontSize: 21, letterSpacing: -0.2, lineHeight: 24, color: colors.ink },
  addrRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  addr: { flex: 1, fontFamily: fonts.body400, fontSize: 13.5, color: colors.muted2 },
  about: { fontFamily: fonts.body400, fontSize: 13.5, lineHeight: 18.9, color: colors.muted },
  socialRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 30, paddingTop: 4 },
  social: { flex: 1, fontFamily: fonts.body400, fontSize: 13, lineHeight: 17, color: colors.ink },
});
