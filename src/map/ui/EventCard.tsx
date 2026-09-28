// Мини-карточка события внизу карты: категория, время, цена, название, адрес, друзья, «Открыть».
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { photo } from '../../data/photos';
import type { EventItem, Person } from '../../data/types';
import { formatPrice } from '../../lib/format';
import { colors, fonts } from '../../theme';
import { CAT_LABEL } from '../icons';

export function socialLine(e: EventItem, people: Person[]): string {
  const names = e.friendsGoing.map((id) => people.find((p) => p.id === id)?.name).filter(Boolean) as string[];
  if (names.length === 1) return `${names[0]} идёт${e.lookingCount >= 3 ? ` · ищут компанию ${e.lookingCount}` : ''}`;
  if (names.length === 2) return `${names[0]} и ${names[1]} идут`;
  if (names.length > 2) return `${names[0]}, ${names[1]} и ещё ${names.length - 2} идут`;
  // «Кто идёт» и «ищут» показываем от 3 человек.
  if (e.lookingCount >= 3) return `Ищут компанию ${e.lookingCount}`;
  if (e.goingCount >= 3) return `Идут ${e.goingCount.toLocaleString('ru-RU')}`;
  return 'Можно прийти одному';
}

export function EventCard({ e, when, dotColor, people, onOpen }: { e: EventItem; when: string; dotColor: string; people: Person[]; onOpen: () => void }) {
  const friends = e.friendsGoing.map((id) => people.find((p) => p.id === id)).filter(Boolean) as Person[];
  return (
    <Animated.View key={e.id} entering={FadeInDown.duration(260)}>
      <Pressable onPress={onOpen} style={styles.card} accessibilityRole="button" accessibilityLabel={`${e.title}. ${when}. Открыть`}>
        <View style={styles.meta}>
          <View style={styles.metaLeft}>
            <View style={[styles.dot, { backgroundColor: dotColor }]} />
            <Text style={styles.metaText} numberOfLines={1}>{CAT_LABEL[e.category]} · {when}</Text>
          </View>
          <Text style={styles.price}>{formatPrice(e.priceMin, e.priceMax, e.isFree)}</Text>
        </View>
        <Text style={styles.title} numberOfLines={2}>{e.title}</Text>
        <Text style={styles.address} numberOfLines={1}>{e.address}</Text>
        <View style={styles.bottom}>
          {friends.length > 0 && (
            <View style={styles.faces}>
              {friends.slice(0, 3).map((p) => p.photo ? (
                <Image key={p.id} source={photo(p.photo)} style={styles.face} />
              ) : (
                <View key={p.id} style={[styles.face, { backgroundColor: p.tint, alignItems: 'center', justifyContent: 'center' }]}>
                  <Text style={{ fontFamily: fonts.body700, fontSize: 11, color: colors.ink }}>{p.initial}</Text>
                </View>
              ))}
            </View>
          )}
          <Text style={styles.social} numberOfLines={1}>{socialLine(e, people)}</Text>
          <View style={styles.open}><Text style={styles.openText}>Открыть</Text></View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.cardAlt, borderRadius: 22, padding: 16, gap: 4, shadowColor: colors.ink, shadowOpacity: 0.1, shadowRadius: 12, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
  meta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  metaLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  dot: { width: 8, height: 8, borderRadius: 2 },
  metaText: { fontFamily: fonts.mono500, fontSize: 11, letterSpacing: 0.66, color: colors.muted, flexShrink: 1 },
  price: { fontFamily: fonts.mono600, fontSize: 11, letterSpacing: 0.66, color: colors.ink },
  title: { fontFamily: fonts.display700, fontSize: 23, letterSpacing: -0.46, lineHeight: 26.5, paddingTop: 2, color: colors.ink },
  address: { fontFamily: fonts.body400, fontSize: 13, color: colors.muted2 },
  bottom: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  faces: { flexDirection: 'row', paddingRight: 8 },
  face: { width: 30, height: 30, marginRight: -8, borderRadius: 15, borderWidth: 2, borderColor: colors.friend, outlineColor: colors.cardAlt },
  social: { flex: 1, fontFamily: fonts.body400, fontSize: 13, color: colors.muted2 },
  open: { height: 38, paddingHorizontal: 14, borderRadius: 19, backgroundColor: colors.ink, justifyContent: 'center' },
  openText: { fontFamily: fonts.body600, fontSize: 14, color: colors.paper },
});
