// Стикеры в чате: поиск сверху, открытые стикеры плиткой, ниже — закрытые («откроются на уровне N»). Без лишних подписей.
import { Lock, Search, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { PACKS, STICKERS, stickerUnlocked, type Sticker } from './catalog';
import { StickerView } from './StickerView';
import { colors, fonts } from '../theme';

const COLS = 4;

export function StickerPicker({ level, onSelect }: { level: number; onSelect: (s: Sticker) => void }) {
  const [q, setQ] = useState('');
  const { width, height } = useWindowDimensions();
  const tile = Math.floor((Math.min(width, 640) - 32 - (COLS - 1) * 8) / COLS);
  const scale = Math.min(1, (tile - 6) / 82);
  const found = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return STICKERS;
    return STICKERS.filter(s => s.label.toLowerCase().includes(t) || PACKS.find(p => p.id === s.pack)?.title.toLowerCase().includes(t));
  }, [q]);
  const open = found.filter(s => stickerUnlocked(s, level));
  const closed = found.filter(s => !stickerUnlocked(s, level));
  const nextLevel = closed.reduce((m, s) => Math.min(m, s.level), Infinity);

  return (
    <View style={{ gap: 12 }}>
      <View style={styles.search}>
        <Search size={18} color={colors.muted} strokeWidth={2} />
        <TextInput value={q} onChangeText={setQ} placeholder="Найти стикер" placeholderTextColor={colors.muted3} style={styles.input} accessibilityLabel="Найти стикер" returnKeyType="search" />
        {!!q && <Pressable onPress={() => setQ('')} hitSlop={10} accessibilityRole="button" accessibilityLabel="Очистить поиск"><X size={18} color={colors.muted} strokeWidth={2} /></Pressable>}
      </View>
      <ScrollView style={{ maxHeight: Math.min(440, height * 0.55) }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.grid}>
          {open.map(s => (
            <Pressable key={s.id} onPress={() => onSelect(s)} style={({ pressed }) => [styles.tile, { width: tile, height: tile + 10 }, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel={s.label}>
              <View style={{ transform: [{ scale }] }}><StickerView st={s} /></View>
            </Pressable>
          ))}
        </View>
        {!open.length && !closed.length && <Text style={styles.empty}>Ничего не нашлось</Text>}
        {closed.length > 0 && (
          <View style={styles.locked}>
            <View style={styles.lockedHead}>
              <Lock size={14} color={colors.muted2} strokeWidth={2.2} />
              <Text style={styles.lockedTitle}>Откроются позже · {closed.length}</Text>
              <Text style={styles.lockedSub}>с уровня {nextLevel}</Text>
            </View>
            <View style={styles.grid}>
              {closed.map(s => (
                <View key={s.id} style={[styles.tile, styles.tileLocked, { width: tile, height: tile + 10 }]} accessibilityLabel={`${s.label}, откроется на уровне ${s.level}`}>
                  <View style={{ transform: [{ scale }], opacity: 0.28 }}><StickerView st={s} /></View>
                  <View style={styles.lvl}><Text style={styles.lvlText}>{s.level}</Text></View>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 44, paddingHorizontal: 14, borderRadius: 22, backgroundColor: colors.sand },
  input: { flex: 1, fontFamily: fonts.body400, fontSize: 15, color: colors.ink, paddingVertical: 0 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: { borderRadius: 18, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  tileLocked: { backgroundColor: 'rgba(23,22,26,0.05)' },
  pressed: { transform: [{ scale: 0.92 }], backgroundColor: 'rgba(23,22,26,0.06)' },
  empty: { fontFamily: fonts.body400, fontSize: 14, color: colors.muted, textAlign: 'center', paddingVertical: 24 },
  locked: { marginTop: 18, gap: 10 },
  lockedHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  lockedTitle: { flex: 1, fontFamily: fonts.body700, fontSize: 14, color: colors.ink },
  lockedSub: { fontFamily: fonts.mono500, fontSize: 11.5, color: colors.muted },
  lvl: { position: 'absolute', right: 6, top: 6, minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 5, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  lvlText: { fontFamily: fonts.mono600, fontSize: 11, color: colors.paper },
});
