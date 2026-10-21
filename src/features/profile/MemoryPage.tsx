// Настройки → Память (как в Telegram): кольцо-диаграмма по видам, сколько занимает каждый, очистка по одному виду или всего.
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Film, Image as ImageIcon, MessageCircle, Mic, Newspaper, Package, Users, type LucideIcon } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import Animated, { cancelAnimation, Easing, FadeOut, useAnimatedProps, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withSpring, withTiming, ZoomIn } from 'react-native-reanimated';
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

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const DRAIN_MS = 900;

/** Доля кольца. Когда её стирают — дуга плавно «стекает» к началу. */
function Segment({ kind, seg, len, offset, size, r, stroke, draining }: { kind: MemKind; seg: number; len: number; offset: number; size: number; r: number; stroke: number; draining: boolean }) {
  const k = useSharedValue(1);
  useEffect(() => { k.set(draining ? withTiming(0, { duration: DRAIN_MS, easing: Easing.bezier(0.6, 0, 0.3, 1) }) : 1); }, [draining, k]);
  const props = useAnimatedProps(() => ({ strokeDasharray: [Math.max(0.01, seg * k.get()), len], strokeOpacity: 0.35 + 0.65 * k.get() }));
  return <AnimatedCircle cx={size / 2} cy={size / 2} r={r} stroke={MEM_LOOK[kind].color} strokeWidth={stroke} fill="none" strokeLinecap="butt"
    animatedProps={props} strokeDashoffset={-offset} transform={`rotate(-90 ${size / 2} ${size / 2})`} />;
}

/** Число в центре плавно уменьшается до того, что останется. */
function useCountTo(target: number, ms = DRAIN_MS) {
  const [shown, setShown] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    const start = Date.now(), a = from.current;
    if (a === target) return;
    let raf = 0;
    const step = () => {
      const t = Math.min(1, (Date.now() - start) / ms);
      const v = a + (target - a) * (1 - (1 - t) ** 3);
      setShown(v); from.current = v;
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return shown;
}

/** Кольцо: доли по видам с небольшими зазорами, в центре — общий размер. */
export function Donut({ parts, size = 210, stroke = 22, draining = null }: { parts: MemPart[]; size?: number; stroke?: number; draining?: MemKind | 'all' | null }) {
  const total = parts.reduce((a, p) => a + p.bytes, 0);
  const left = draining === 'all' ? 0 : draining ? total - (parts.find(p => p.kind === draining)?.bytes ?? 0) : total;
  const counted = useCountTo(left);
  const r = (size - stroke) / 2;
  const len = 2 * Math.PI * r;
  const shown = parts.filter((p) => p.bytes > 0);
  const gap = shown.length > 1 ? 6 : 0;
  // Пока стирается — кольцо слегка «дышит».
  const pulse = useSharedValue(1);
  useEffect(() => {
    if (draining) pulse.set(withRepeat(withSequence(withTiming(0.96, { duration: 300 }), withTiming(1, { duration: 300 })), -1, false));
    else { cancelAnimation(pulse); pulse.set(withSpring(1)); }
  }, [draining, pulse]);
  const ring = useAnimatedStyle(() => ({ transform: [{ scale: pulse.get() }] }));
  let at = 0;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={[StyleSheet.absoluteFill, ring]}>
        <Svg width={size} height={size}>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(23,22,26,0.08)" strokeWidth={stroke} fill="none" />
          {total > 0 && shown.map((p) => {
            const seg = Math.max(2, (p.bytes / total) * len - gap);
            const el = <Segment key={p.kind} kind={p.kind} seg={seg} len={len} offset={at} size={size} r={r} stroke={stroke} draining={draining === 'all' || draining === p.kind} />;
            at += (p.bytes / total) * len;
            return el;
          })}
        </Svg>
      </Animated.View>
      <Text style={styles.total}>{sizeText(counted)}</Text>
      <Text style={styles.totalSub}>{draining ? 'очищаю…' : 'занимает Meets'}</Text>
    </View>
  );
}

export default function MemoryPage() {
  const qc = useQueryClient();
  const use = useQuery({ queryKey: ['memoryUse'], queryFn: memoryUse, gcTime: 0, staleTime: 0 });
  const [busy, setBusy] = useState<MemKind | 'all' | null>(null);
  const [freed, setFreed] = useState<number | null>(null);
  const parts = use.data ?? [];
  const total = parts.reduce((a, p) => a + p.bytes, 0);
  const ask = (what: MemKind | 'all') => {
    const title = what === 'all' ? 'Очистить всё?' : `Стереть «${MEM_LOOK[what].name}»?`;
    const run = async () => {
      const bytes = what === 'all' ? total : parts.find(p => p.kind === what)?.bytes ?? 0;
      setBusy(what); setFreed(null);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
      try {
        // Стираем и показываем, как кольцо «стекает», одновременно; экран ждёт и то и другое.
        await Promise.all([what === 'all' ? clearAll() : clearKind(what), new Promise(r => setTimeout(r, DRAIN_MS + 80))]);
        setFreed(bytes);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
        setTimeout(() => setFreed(null), 2600);
      } finally { await qc.invalidateQueries({ queryKey: ['memoryUse'] }); setBusy(null); }
    };
    if (Platform.OS === 'web') { void run(); return; }
    Alert.alert(title, 'Ничего не пропадёт: всё загрузится снова, когда понадобится. Неотправленные сообщения останутся.', [
      { text: 'Отмена', style: 'cancel' }, { text: 'Стереть', style: 'destructive', onPress: () => void run() },
    ]);
  };
  return (
    <SettingsPage title="Память" sub="Чаты и лента сохраняются на телефоне на неделю — их можно читать без интернета.">
      <View style={styles.hero}>
        <Donut parts={parts} draining={busy} />
        {freed != null ? (
          <Animated.View entering={ZoomIn.springify().damping(14)} exiting={FadeOut} style={styles.freed}>
            <Check size={18} color="#FFFFFF" strokeWidth={2.6} />
            <Text style={styles.freedText}>Освобождено {sizeText(freed)}</Text>
          </Animated.View>
        ) : (
          <Pressable onPress={() => ask('all')} disabled={!total || !!busy} style={({ pressed }) => [styles.clearAll, (!total || busy) && { opacity: 0.45 }, pressed && { transform: [{ scale: 0.98 }] }]} accessibilityRole="button">
            <Text style={styles.clearAllText}>{busy === 'all' ? 'Очищаю…' : `Очистить всё${total ? ` · ${sizeText(total)}` : ''}`}</Text>
          </Pressable>
        )}
      </View>
      <Group>
        {parts.map((p, i) => {
          const L = MEM_LOOK[p.kind];
          const share = total ? Math.round((p.bytes / total) * 100) : 0;
          const going = busy === 'all' || busy === p.kind;
          return (
            <Pressable key={p.kind} onPress={() => ask(p.kind)} disabled={!p.bytes || !!busy} style={({ pressed }) => [styles.row, i < parts.length - 1 && styles.sep, pressed && { backgroundColor: 'rgba(23,22,26,0.04)' }]}
              accessibilityRole="button" accessibilityLabel={`${L.name}: ${sizeText(p.bytes)}. Нажми, чтобы стереть`}>
              <View style={[styles.icon, { backgroundColor: L.color }]}><L.Icon size={18} color="#FFFFFF" strokeWidth={2} /></View>
              <View style={{ flex: 1, gap: 4 }}>
                <View style={styles.line}>
                  <Text style={styles.name}>{L.name}</Text>
                  <Text style={styles.size}>{going ? 'стираю…' : sizeText(p.bytes)}</Text>
                </View>
                <Bar share={Math.max(p.bytes ? 2 : 0, share)} color={L.color} draining={going} />
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

/** Полоска доли: при очистке уезжает в ноль. */
function Bar({ share, color, draining }: { share: number; color: string; draining: boolean }) {
  const k = useSharedValue(1);
  useEffect(() => { k.set(draining ? withTiming(0, { duration: DRAIN_MS, easing: Easing.bezier(0.6, 0, 0.3, 1) }) : withTiming(1, { duration: 250 })); }, [draining, k]);
  const fill = useAnimatedStyle(() => ({ width: `${share * k.get()}%` }));
  return <View style={styles.bar}><Animated.View style={[styles.fill, { backgroundColor: color }, fill]} /></View>;
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: 16, paddingVertical: 12 },
  total: { fontFamily: fonts.display800, fontSize: 30, letterSpacing: -0.8, color: colors.ink },
  totalSub: { fontFamily: fonts.body500, fontSize: 13, color: colors.muted },
  clearAll: { minHeight: 46, paddingHorizontal: 22, borderRadius: 16, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  clearAllText: { fontFamily: fonts.body700, fontSize: 15, color: colors.paper },
  freed: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 46, paddingHorizontal: 22, borderRadius: 16, backgroundColor: colors.ok },
  freedText: { fontFamily: fonts.body700, fontSize: 15, color: '#FFFFFF' },
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
