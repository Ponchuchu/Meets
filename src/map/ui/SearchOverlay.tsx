// Поиск по событиям: название, место, адрес, теги. Тап — событие на карте.
import { Search, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBackClose } from '../../state/app';
import type { EventItem } from '../../data/types';
import { formatPrice } from '../../lib/format';
import { colors, fonts, radii } from '../../theme';
import { glass } from '../../ui/glass';
import { StateView } from '../../ui/StateView';
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
        <View style={[styles.field, glass]}>
        <Search size={19} color={colors.muted2} strokeWidth={1.9} />
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
        {q.length > 0 && (
          <Pressable onPress={() => setQ('')} hitSlop={10} style={styles.clear} accessibilityRole="button" accessibilityLabel="Очистить поиск">
            <X size={16} color={colors.paper} strokeWidth={2.2} />
          </Pressable>
        )}
        </View>
      </View>
      <FlatList
        data={found}
        keyExtractor={(e) => e.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 120 }}
        ListEmptyComponent={q.trim() ? <StateView kind="nothing-found" text="Попробуй другое слово или район." /> : <Text style={styles.empty}>Ищи по названию, месту или адресу.</Text>}
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
  field: { flex: 1, minWidth: 0, height: 52, borderRadius: 26, paddingLeft: 16, paddingRight: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  input: { flex: 1, minWidth: 0, height: 52, fontFamily: fonts.body400, fontSize: 16, color: colors.ink },
  clear: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.muted3, alignItems: 'center', justifyContent: 'center' },
  row: { paddingVertical: 12, paddingHorizontal: 14, marginBottom: 8, borderRadius: radii.lg, backgroundColor: colors.card, gap: 3 },
  meta: { fontFamily: fonts.mono500, fontSize: 10.5, letterSpacing: 0.6, color: colors.muted },
  title: { fontFamily: fonts.display700, fontSize: 18, color: colors.ink },
  address: { fontFamily: fonts.body400, fontSize: 13, color: colors.muted },
  empty: { fontFamily: fonts.body400, fontSize: 14, color: colors.muted, paddingTop: 12 },
});
