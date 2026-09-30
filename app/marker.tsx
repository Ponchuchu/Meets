// «Мой значок на карте»: статус-наклейка, кольцо с узором, невидимка. Внутри всегда фото профиля.
// Скорость показывается сама, когда ты в пути; геолокацией управляет невидимка.
import { router } from 'expo-router';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MapBase } from '../src/components/MapBase';
import { photo } from '../src/data/photos';
import { RING_STYLES, STATUS_STICKERS, statusSticker, useProfile, type Ring, type RingStyle } from '../src/state/profile';
import { useSession } from '../src/state/session';
import { colors, fonts } from '../src/theme';
import { BackButton } from '../src/ui/kit';
import { Cap, Group, SwitchRow } from '../src/ui/Section';

/** Кольцо с узором: сплошное, двойное (второй цвет внутри), пунктир поверх второго цвета, свечение. */
export function RingView({ r, size, children }: { r: RingStyle; size: number; children?: React.ReactNode }) {
  const w = Math.max(3, Math.round(size / 14));
  return (
    <View style={[{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: r.second ?? '#FFFFFF' },
      r.glow && { shadowColor: r.color, shadowOpacity: 0.9, shadowRadius: size / 5, shadowOffset: { width: 0, height: 0 }, elevation: 8 }]}>
      <View style={{ position: 'absolute', width: size, height: size, borderRadius: size / 2, borderWidth: w, borderColor: r.color, borderStyle: r.dashed ? 'dashed' : 'solid' }} />
      <View style={{ width: size - w * 2 - (r.second ? 4 : 2), height: size - w * 2 - (r.second ? 4 : 2), borderRadius: size, overflow: 'hidden', backgroundColor: colors.softGreen, alignItems: 'center', justifyContent: 'center' }}>
        {children}
      </View>
    </View>
  );
}

function StatusTag({ label, big }: { label: string; big?: boolean }) {
  const st = statusSticker(label);
  return (
    <View style={[styles.tag, big && styles.tagBig, { backgroundColor: st.bg, transform: [{ rotate: `${st.rot}deg` }] }, st.bg === '#FFFFFF' && { borderWidth: 2, borderColor: colors.ink }]}>
      <Text style={[styles.tagText, big && { fontSize: 15 }, { color: st.fg }]}>{st.label}</Text>
    </View>
  );
}

export default function MarkerScreen() {
  const insets = useSafeAreaInsets();
  const m = useProfile((s) => s.marker);
  const set = useProfile((s) => s.setMarker);
  const draft = useSession((s) => s.draft);
  const ring = RING_STYLES[m.ring] ?? RING_STYLES.blue;
  const face = <Image source={photo(draft.photo ?? 'danil')} style={{ width: '100%', height: '100%' }} />;

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingTop: Math.max(50, insets.top + 6), paddingHorizontal: 16, paddingBottom: 40 + insets.bottom, gap: 12 }}>
      <View style={styles.head}>
        <BackButton onPress={() => (router.canGoBack() ? router.back() : router.replace('/me'))} />
        <View style={{ flex: 1 }}>
          <Text style={styles.h1} accessibilityRole="header">Мой значок на карте</Text>
          <Text style={styles.sub}>так тебя видят друзья</Text>
        </View>
      </View>

      <View style={styles.preview}>
        <View style={{ position: 'absolute', left: -20, top: -250 }}><MapBase theme="paper" /></View>
        {!m.invisible ? (
          <View style={styles.me}>
            <Animated.View key={m.ring} entering={ZoomIn.springify().damping(12)}>
              <RingView r={ring} size={66}>{face}</RingView>
            </Animated.View>
            <Animated.View key={m.status} entering={ZoomIn.springify().damping(10)} style={styles.bubble}>
              <StatusTag label={m.status} big />
            </Animated.View>
          </View>
        ) : (
          <View style={styles.inv}><Text style={styles.invText}>Невидимка: тебя не видно никому</Text></View>
        )}
      </View>

      <Cap>СТАТУС</Cap>
      <View style={styles.tags} accessibilityRole="radiogroup" accessibilityLabel="Статус над значком">
        {STATUS_STICKERS.map((st) => {
          const on = statusSticker(m.status).label === st.label;
          return (
            <Pressable key={st.label} onPress={() => set({ status: st.label })} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={`Статус: ${st.label}`}
              style={({ pressed }) => [styles.tagCell, on && styles.tagCellOn, { transform: [{ scale: pressed ? 0.94 : 1 }] }]}>
              <StatusTag label={st.label} />
            </Pressable>
          );
        })}
      </View>

      <Cap>КОЛЬЦО</Cap>
      <View style={styles.rings} accessibilityRole="radiogroup" accessibilityLabel="Кольцо вокруг фото">
        {(Object.keys(RING_STYLES) as Ring[]).map((k) => {
          const on = m.ring === k;
          return (
            <Pressable key={k} onPress={() => set({ ring: k })} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={`Кольцо: ${RING_STYLES[k].name}`}
              style={[styles.ringCell, on && styles.ringCellOn]}>
              <RingView r={RING_STYLES[k]} size={44}>{face}</RingView>
              <Text style={[styles.ringName, on && { fontFamily: fonts.body700 }]}>{RING_STYLES[k].name}</Text>
            </Pressable>
          );
        })}
      </View>

      <Group>
        <SwitchRow title="Невидимка" sub="спрятаться сразу от всех" on={m.invisible} onChange={(invisible) => set({ invisible })} last />
      </Group>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  h1: { fontFamily: fonts.display700, fontSize: 24, letterSpacing: -0.5, color: colors.ink },
  sub: { fontFamily: fonts.body400, fontSize: 13, color: colors.muted },
  preview: { height: 230, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: colors.line, backgroundColor: '#EFEBE2', marginTop: 8 },
  me: { position: 'absolute', left: '50%', top: 110, marginLeft: -33, alignItems: 'center' },
  bubble: { position: 'absolute', top: -46, left: 44 },
  tag: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 4, shadowColor: colors.ink, shadowOpacity: 0.3, shadowRadius: 0, shadowOffset: { width: 2, height: 2 }, elevation: 2 },
  tagBig: { paddingHorizontal: 12, paddingVertical: 8 },
  tagText: { fontFamily: fonts.display800, fontSize: 13, letterSpacing: 0.5 },
  inv: { position: 'absolute', left: 16, right: 16, top: 96, padding: 12, borderRadius: 12, backgroundColor: colors.ink, alignItems: 'center' },
  invText: { fontFamily: fonts.body600, fontSize: 13, color: colors.paper },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tagCell: { minHeight: 52, paddingHorizontal: 10, borderRadius: 14, borderWidth: 1.5, borderColor: 'transparent', backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  tagCellOn: { borderColor: colors.ink },
  rings: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  ringCell: { width: '31%', flexGrow: 1, paddingVertical: 10, borderRadius: 16, borderWidth: 1.5, borderColor: 'transparent', backgroundColor: colors.card, alignItems: 'center', gap: 6 },
  ringCellOn: { borderColor: colors.ink },
  ringName: { fontFamily: fonts.body500, fontSize: 12.5, color: colors.ink },
});
