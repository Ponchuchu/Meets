// Настройки → Память (как в Telegram): кольцо-диаграмма по видам, сколько занимает каждый, очистка по одному виду или всего.
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Film, Image as ImageIcon, MessageCircle, Mic, Newspaper, Package, Users, type LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { clearAll, clearKind, memoryUse, sizeText, type MemKind, type MemPart } from '../../live/memory';
import { colors, fonts } from '../../theme';
import { Group, Note, SettingsPage } from '../../ui/v6/Settings';

export const MEM_LOOK: Record<MemKind, { name: string; sub: string; color: string; Icon: LucideIcon }> = {
  messages: { name: 'Сообщения', sub: 'чаты и приглашения', color: '#F0521F', Icon: MessageCircle },
  feed: { name: 'Лента и события', sub: 'афиша, планы', color: '#E2A21B', Icon: Newspaper },
  people: { name: 'Люди', sub: 'друзья и профили', color: '#2F8F5B', Icon: Users },
  photo: { name: 'Фото', sub: 'из чатов и альбомов', color: '#2447B8', Icon: ImageIcon },
  video: { name: 'Видео и кружки', sub: 'загрузятся снова', color: '#7E5BD6', Icon: Film },
  voice: { name: 'Голосовые', sub: 'загрузятся снова', color: '#2AA5B8', Icon: Mic },
  other: { name: 'Другое', sub: 'временные файлы', color: '#9C968A', Icon: Package },
};

/** Кольцо: доли по видам с небольшими зазорами, в центре — общий размер. */
export function Donut({ parts, size = 210, stroke = 22 }: { parts: MemPart[]; size?: number; stroke?: number }) {
  const total = parts.reduce((a, p) => a + p.bytes, 0);
  const r = (size - stroke) / 2;
  const len = 2 * Math.PI * r;
  const shown = parts.filter((p) => p.bytes > 0);
  const gap = shown.length > 1 ? 6 : 0;
  let at = 0;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(23,22,26,0.08)" strokeWidth={stroke} fill="none" />
        {total > 0 && shown.map((p) => {
          const seg = Math.max(2, (p.bytes / total) * len - gap);
          const el = <Circle key={p.kind} cx={size / 2} cy={size / 2} r={r} stroke={MEM_LOOK[p.kind].color} strokeWidth={stroke} fill="none" strokeLinecap="butt"
            strokeDasharray={`${seg} ${len}`} strokeDashoffset={-at} transform={`rotate(-90 ${size / 2} ${size / 2})`} />;
          at += (p.bytes / total) * len;
          return el;
        })}
      </Svg>
      <Text style={styles.total}>{sizeText(total)}</Text>
      <Text style={styles.totalSub}>занимает Meets</Text>
    </View>
  );
}

export default function MemoryPage() {
  const qc = useQueryClient();
  const use = useQuery({ queryKey: ['memoryUse'], queryFn: memoryUse, gcTime: 0, staleTime: 0 });
  const [busy, setBusy] = useState<MemKind | 'all' | null>(null);
  const parts = use.data ?? [];
  const total = parts.reduce((a, p) => a + p.bytes, 0);
  const ask = (what: MemKind | 'all') => {
    const title = what === 'all' ? 'Очистить всё?' : `Стереть «${MEM_LOOK[what].name}»?`;
    const run = async () => {
      setBusy(what);
      try { await (what === 'all' ? clearAll() : clearKind(what)); } finally { setBusy(null); void qc.invalidateQueries({ queryKey: ['memoryUse'] }); }
    };
    if (Platform.OS === 'web') { void run(); return; }
    Alert.alert(title, 'Ничего не пропадёт: всё загрузится снова, когда понадобится. Неотправленные сообщения останутся.', [
      { text: 'Отмена', style: 'cancel' }, { text: 'Стереть', style: 'destructive', onPress: () => void run() },
    ]);
  };
  return (
    <SettingsPage title="Память" sub="Чаты и лента сохраняются на телефоне на неделю — их можно читать без интернета.">
      <View style={styles.hero}>
        <Donut parts={parts} />
        <Pressable onPress={() => ask('all')} disabled={!total || !!busy} style={({ pressed }) => [styles.clearAll, (!total || busy) && { opacity: 0.45 }, pressed && { transform: [{ scale: 0.98 }] }]} accessibilityRole="button">
          <Text style={styles.clearAllText}>{busy === 'all' ? 'Очищаю…' : `Очистить всё${total ? ` · ${sizeText(total)}` : ''}`}</Text>
        </Pressable>
      </View>
      <Group>
        {parts.map((p, i) => {
          const L = MEM_LOOK[p.kind];
          const share = total ? Math.round((p.bytes / total) * 100) : 0;
          return (
            <Pressable key={p.kind} onPress={() => ask(p.kind)} disabled={!p.bytes || !!busy} style={({ pressed }) => [styles.row, i < parts.length - 1 && styles.sep, pressed && { backgroundColor: 'rgba(23,22,26,0.04)' }]}
              accessibilityRole="button" accessibilityLabel={`${L.name}: ${sizeText(p.bytes)}. Нажми, чтобы стереть`}>
              <View style={[styles.icon, { backgroundColor: L.color }]}><L.Icon size={18} color="#FFFFFF" strokeWidth={2} /></View>
              <View style={{ flex: 1, gap: 4 }}>
                <View style={styles.line}>
                  <Text style={styles.name}>{L.name}</Text>
                  <Text style={styles.size}>{busy === p.kind ? 'стираю…' : sizeText(p.bytes)}</Text>
                </View>
                <View style={styles.bar}><View style={[styles.fill, { width: `${Math.max(p.bytes ? 2 : 0, share)}%`, backgroundColor: L.color }]} /></View>
                <Text style={styles.sub}>{p.bytes ? `${share < 1 ? 'меньше 1' : share}% · ${L.sub}` : 'пусто'}</Text>
              </View>
            </Pressable>
          );
        })}
      </Group>
      <Note>Нажми на строку, чтобы стереть только этот вид. Сообщения, которые ждут интернета, не сотрутся.</Note>
    </SettingsPage>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: 16, paddingVertical: 12 },
  total: { fontFamily: fonts.display800, fontSize: 30, letterSpacing: -0.8, color: colors.ink },
  totalSub: { fontFamily: fonts.body500, fontSize: 13, color: colors.muted },
  clearAll: { minHeight: 46, paddingHorizontal: 22, borderRadius: 16, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  clearAllText: { fontFamily: fonts.body700, fontSize: 15, color: colors.paper },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12, minHeight: 64 },
  sep: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(23,22,26,0.12)' },
  icon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  line: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  name: { fontFamily: fonts.body700, fontSize: 15.5, color: colors.ink },
  size: { fontFamily: fonts.mono600, fontSize: 12.5, color: colors.ink },
  bar: { height: 5, borderRadius: 3, backgroundColor: 'rgba(23,22,26,0.07)', overflow: 'hidden' },
  fill: { height: 5, borderRadius: 3 },
  sub: { fontFamily: fonts.body400, fontSize: 12.5, color: colors.muted },
});
