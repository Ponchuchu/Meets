// Мини-карточка события внизу карты: слева плитка категории (или фото), справа когда, название, где и кто идёт.
// Без кнопок: тап или «потянуть вверх» — событие раскрывается из карточки на весь экран; смахнуть — закрыть.
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { photo } from '../../data/photos';
import type { EventItem, Person } from '../../data/types';
import { formatPrice } from '../../lib/format';
import { colors, fonts } from '../../theme';
import { Avatar } from '../../ui/Avatar';
import { Ic } from '../../ui/Ic';
import { CAT_COLOR, CAT_ICON, CAT_LABEL, catFg } from '../icons';

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

export function EventCard({ e, when, people, onOpen }: { e: EventItem; when: string; dotColor?: string; people: Person[]; onOpen: () => void }) {
  const friends = e.friendsGoing.map((id) => people.find((p) => p.id === id)).filter(Boolean) as Person[];
  const bg = CAT_COLOR[e.category];
  return (
    <Animated.View key={e.id} entering={FadeInDown.duration(260)}>
      <Pressable onPress={onOpen} style={({ pressed }) => [styles.card, pressed && { transform: [{ scale: 0.985 }] }]} accessibilityRole="button" accessibilityLabel={`${e.title}. ${when}. Открыть событие`} accessibilityHint="Потяни вверх, чтобы раскрыть">
        <View style={[styles.tile, { backgroundColor: bg }]}>
          {e.cover ? <Image source={photo(e.cover)} style={StyleSheet.absoluteFill} /> : <Ic d={CAT_ICON[e.category]} size={30} color={catFg(e.category)} w={1.9} />}
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={styles.meta} numberOfLines={1}>{CAT_LABEL[e.category]} · {when}</Text>
          <Text style={styles.title} numberOfLines={2}>{e.title}</Text>
          <Text style={styles.address} numberOfLines={1}>{e.venueName ?? e.address.split(',')[0]} · {formatPrice(e.priceMin, e.priceMax, e.isFree)}</Text>
          <View style={styles.bottom}>
            {friends.length > 0 && (
              <View style={{ flexDirection: 'row' }}>
                {friends.slice(0, 3).map((p, i) => <Avatar key={p.id} p={p} size={22} ring={colors.friend} style={{ marginLeft: i ? -7 : 0 }} />)}
              </View>
            )}
            <Text style={styles.social} numberOfLines={1}>{socialLine(e, people)}</Text>
          </View>
        </View>
        <View style={styles.up} accessibilityElementsHidden><Ic d="M6 15l6-6 6 6" size={16} color={colors.muted2} w={2.4} /></View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.cardAlt, borderRadius: 26, padding: 12, paddingTop: 18,
    shadowColor: colors.ink, shadowOpacity: 0.12, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 6,
  },
  tile: { width: 84, height: 96, borderRadius: 18, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  meta: { fontFamily: fonts.mono500, fontSize: 10.5, letterSpacing: 0.5, color: colors.muted },
  title: { fontFamily: fonts.display700, fontSize: 19, letterSpacing: -0.3, lineHeight: 22, color: colors.ink },
  address: { fontFamily: fonts.body400, fontSize: 12.5, color: colors.muted2 },
  bottom: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 3 },
  social: { flex: 1, fontFamily: fonts.body500, fontSize: 12.5, color: colors.ink },
  up: { position: 'absolute', top: 2, right: 14 },
});
