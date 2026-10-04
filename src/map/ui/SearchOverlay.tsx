// Поиск по событиям: название, место, адрес, теги. Тап — событие на карте.
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBackClose } from '../../state/app';
import type { EventItem } from '../../data/types';
import { formatPrice } from '../../lib/format';
import { colors, fonts } from '../../theme';
import { BackButton } from '../../ui/kit';
import { CAT_LABEL } from '../icons';

export function searchEvents(events: EventItem[], q: string): EventItem[] {
  const norm = (s: string) => s.toLowerCase().replace(/ё/g, 'е');
  const words = norm(q).split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  return events.filter((e) => {
    const hay = norm([e.title, e.venueName ?? '', e.address, e.tags.join(' '), CAT_LABEL[e.category]].join(' '));
    return words.every((w) => hay.includes(w));
  });
}

export function SearchOverlay({ events, whenOf, onPick, onClose }: {
  events: EventItem[]; whenOf: (e: EventItem) => string; onPick: (e: EventItem) => void; onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  useBackClose(onClose);
  const [q, setQ] = useState('');
  const found = useMemo(() => searchEvents(events, q), [events, q]);
  return (
    <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(150)} style={[StyleSheet.absoluteFill, styles.root, { paddingTop: Math.max(50, insets.top + 12) }]}>
      <View style={styles.bar}>
        <BackButton onPress={onClose} size={52} label="Закрыть поиск" />
        <TextInput
          value={q}
          onChangeText={setQ}
          autoFocus
          placeholder="Джаз, стендап, Абая…"
          placeholderTextColor={colors.muted3}
          returnKeyType="search"
          accessibilityLabel="Поиск по событиям и местам"
          style={styles.input}
        />
      </View>
      <FlatList
        data={found}
        keyExtractor={(e) => e.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 120 }}
        ListEmptyComponent={q.trim() ? <Text style={styles.empty}>Ничего не нашлось. Попробуй другое слово.</Text> : <Text style={styles.empty}>Ищи по названию, месту или адресу.</Text>}
        renderItem={({ item: e }) => (
          <Pressable onPress={() => onPick(e)} style={styles.row} accessibilityRole="button">
            <Text style={styles.meta}>{CAT_LABEL[e.category]} · {whenOf(e)} · {formatPrice(e.priceMin, e.priceMax, e.isFree)}</Text>
            <Text style={styles.title}>{e.title}</Text>
            <Text style={styles.address} numberOfLines={1}>{e.address}</Text>
          </Pressable>
        )}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: colors.paper, paddingHorizontal: 16 },
  bar: { flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 12 },
  input: { flex: 1, height: 52, borderRadius: 26, paddingHorizontal: 18, backgroundColor: colors.cardAlt, borderWidth: 1, borderColor: colors.line2, fontFamily: fonts.body400, fontSize: 16, color: colors.ink },
  row: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.line, gap: 3 },
  meta: { fontFamily: fonts.mono500, fontSize: 10.5, letterSpacing: 0.6, color: colors.muted },
  title: { fontFamily: fonts.display700, fontSize: 18, color: colors.ink },
  address: { fontFamily: fonts.body400, fontSize: 13, color: colors.muted },
  empty: { fontFamily: fonts.body400, fontSize: 14, color: colors.muted, paddingTop: 12 },
});
