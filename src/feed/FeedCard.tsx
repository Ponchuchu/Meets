// Карточка ленты (переделана 11 октября): светлая, сверху фото события (или яркий постер раздела), ниже — название и всегда
// три факта: когда, где, сколько. Причин «почему это тебе» нет. Штампы «ПОЙДУ» / «МИМО» проявляются от сдвига.
import { Clock, MapPin, Ticket } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Extrapolation, interpolate, type SharedValue, useAnimatedStyle } from 'react-native-reanimated';
import type { EventItem, Person } from '../data/types';
import { eventFacts } from '../event/facts';
import { CAT_LABEL } from '../map/icons';
import { stampOf } from '../map/ui/EventSheet';
import { colors, fonts } from '../theme';
import { Avatar } from '../ui/Avatar';
import { EventCover } from '../ui/EventCover';

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
  const coverH = Math.round(height * 0.5);
  const social = feedSocial(e, people);
  const f = eventFacts(e);
  const roomy = height >= 470 && e.about.trim().length > 0;
  const goStamp = useAnimatedStyle(() => ({ opacity: stamp?.get() === 1 ? 1 : dx ? interpolate(dx.get(), [0, 90], [0, 1], Extrapolation.CLAMP) : 0 }));
  const skipStamp = useAnimatedStyle(() => ({ opacity: stamp?.get() === -1 ? 1 : dx ? interpolate(dx.get(), [-90, 0], [1, 0], Extrapolation.CLAMP) : 0 }));
  return (
    <View style={[styles.card, { height }]} accessibilityLabel={`${e.title}. ${f.when}. ${f.place}. ${f.price}. Нажми, чтобы открыть подробности`}>
      <EventCover cover={e.cover} category={e.category} color={e.coverColor} style={{ height: coverH }} iconSize={Math.round(coverH * 0.62)}>
        <View style={styles.cat}><Text style={styles.catText}>{CAT_LABEL[e.category]}</Text></View>
        <View style={styles.when}><Text style={styles.whenText}>{stampOf(e, now)}</Text></View>
        <Animated.View pointerEvents="none" style={[styles.stamp, styles.stampGo, goStamp]}><Text style={[styles.stampText, { color: colors.accent }]}>ПОЙДУ</Text></Animated.View>
        <Animated.View pointerEvents="none" style={[styles.stamp, styles.stampSkip, skipStamp]}><Text style={styles.stampText}>МИМО</Text></Animated.View>
      </EventCover>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={2}>{e.title}</Text>
        <View style={styles.facts}>
          <Fact Icon={Clock} text={f.when} bad={f.whenMissing} />
          <Fact Icon={MapPin} text={f.place} bad={f.placeMissing} />
          <Fact Icon={Ticket} text={f.price} bad={f.priceMissing} strong={!f.priceMissing} />
        </View>
        {roomy && <Text style={styles.about} numberOfLines={2}>{e.about.trim()}</Text>}
        {social.text ? (
          <View style={styles.socialRow}>
            {social.faces.length > 0 && (
              <View style={{ flexDirection: 'row', paddingRight: 4 }}>
                {social.faces.map(({ p }, i) => <Avatar key={p.id} p={p} size={24} style={{ marginLeft: i ? -8 : 0, borderWidth: 2, borderColor: colors.card }} />)}
              </View>
            )}
            <Text style={styles.social} numberOfLines={1}>{social.text}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function Fact({ Icon, text, bad, strong }: { Icon: typeof Clock; text: string; bad?: boolean; strong?: boolean }) {
  return (
    <View style={styles.fact}>
      <Icon size={16} color={bad ? colors.muted3 : colors.ink} strokeWidth={1.9} />
      <Text style={[styles.factText, bad && { color: colors.muted3, fontFamily: fonts.body500 }, strong && { fontFamily: fonts.body700 }]} numberOfLines={1}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 30, overflow: 'hidden', backgroundColor: colors.card },
  cat: { position: 'absolute', left: 14, top: 14, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 9, backgroundColor: 'rgba(251,250,246,0.92)' },
  catText: { fontFamily: fonts.mono600, fontSize: 10.5, letterSpacing: 0.9, color: colors.ink },
  when: { position: 'absolute', left: 14, bottom: 14, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 9, backgroundColor: 'rgba(23,22,26,0.66)' },
  whenText: { fontFamily: fonts.mono600, fontSize: 11, letterSpacing: 0.8, color: '#FBFAF6' },
  stamp: { position: 'absolute', top: 40, paddingVertical: 6, paddingHorizontal: 12, borderWidth: 3, borderRadius: 12, backgroundColor: 'rgba(251,250,246,0.92)' },
  stampGo: { left: 20, borderColor: colors.accent, transform: [{ rotate: '-12deg' }] },
  stampSkip: { right: 20, borderColor: colors.ink, transform: [{ rotate: '12deg' }] },
  stampText: { fontFamily: fonts.display800, fontSize: 26, letterSpacing: 0.5, color: colors.ink },
  body: { flex: 1, paddingHorizontal: 18, paddingTop: 14, paddingBottom: 14, gap: 10 },
  title: { fontFamily: fonts.display700, fontSize: 23, lineHeight: 27, letterSpacing: -0.5, color: colors.ink },
  facts: { gap: 7 },
  fact: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  factText: { flex: 1, fontFamily: fonts.body600, fontSize: 14.5, color: colors.ink },
  about: { fontFamily: fonts.body400, fontSize: 13.5, lineHeight: 19, color: colors.muted },
  socialRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 'auto' },
  social: { flex: 1, fontFamily: fonts.body500, fontSize: 13.5, color: colors.muted },
});
