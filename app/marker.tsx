// «Мой значок на карте» — design/png/MarkerStyle.png: скорость, статус, кольцо, кто видит.
import { router } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MapBase } from '../src/components/MapBase';
import { photo } from '../src/data/photos';
import { RING_COLORS, speedLabel, useProfile, type Ring, type SpeedMode } from '../src/state/profile';
import { useSession } from '../src/state/session';
import { colors, fonts } from '../src/theme';
import { Ic, IC } from '../src/ui/Ic';
import { BackButton, Chip } from '../src/ui/kit';
import { Cap, Group, Row, SwitchRow } from '../src/ui/Section';

const STATUSES = ['Свободен', 'На событии', 'Занят', 'Не беспокоить', 'Хочу кофе'];
const MODES: [SpeedMode, string, string][] = [['exact', 'Точно', '12 КМ/Ч'], ['approx', 'Примерно', 'НА САМОКАТЕ'], ['simple', 'Просто', 'В ПУТИ']];
const MODE_HINT: Record<SpeedMode, string> = {
  exact: 'Друзья видят цифру и направление. Удобно, когда договариваетесь встретиться.',
  approx: 'Друзья видят, на чём ты едешь, но не цифру.',
  simple: 'Друзья видят только, что ты в пути.',
};

export default function MarkerScreen() {
  const insets = useSafeAreaInsets();
  const m = useProfile((s) => s.marker);
  const set = useProfile((s) => s.setMarker);
  const draft = useSession((s) => s.draft);
  const ring = RING_COLORS[m.ring];
  const speed = speedLabel(12, m);
  const custom = !STATUSES.includes(m.status);
  const [openedAt] = useState(() => Date.now());
  const sharing = m.shareUntil && new Date(m.shareUntil).getTime() > openedAt;
  const until = sharing ? new Date(m.shareUntil!) : null;

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
        {!m.invisible && (
          <View style={styles.me}>
            {m.showMoving && [0, 1, 2].map((i) => <View key={i} style={[styles.trail, { left: 120 - 46 + i * 11, opacity: [0.18, 0.3, 0.5][i] }]} />)}
            <View style={[styles.ring, { borderColor: ring }]}>
              {m.inside === 'photo' ? <Image source={photo(draft.photo ?? 'danil')} style={styles.face} /> : (
                <View style={[styles.face, { backgroundColor: colors.softGreen, alignItems: 'center', justifyContent: 'center' }]}><Text style={styles.letter}>{(draft.name || 'Д')[0]}</Text></View>
              )}
            </View>
            {speed && <View style={styles.speed}><Text style={styles.speedText}>{speed}</Text><Ic d="M5 12h14M13 6l6 6-6 6" size={10} color="#FFFFFF" w={3} /></View>}
            {!!m.status && <View style={styles.bubble}><Text style={styles.bubbleText}>{m.status === 'Свободен' ? 'Свободен вечером' : m.status}</Text></View>}
          </View>
        )}
        {m.invisible && <View style={styles.inv}><Text style={styles.bubbleText}>Невидимка: тебя не видно никому</Text></View>}
      </View>

      <Cap>СКОРОСТЬ</Cap>
      <Group>
        <SwitchRow title="Показывать, что я в пути" sub="только когда ты быстрее 3 км/ч" on={m.showMoving} onChange={(showMoving) => set({ showMoving })} />
        <Row title="Как показывать" last>
          <View style={styles.seg}>
            {MODES.map(([k, label, hint]) => {
              const on = m.speedMode === k;
              return (
                <Pressable key={k} onPress={() => set({ speedMode: k })} style={[styles.segItem, on && styles.segOn]} accessibilityRole="radio" accessibilityState={{ selected: on }}>
                  <Text style={[styles.segLabel, { fontFamily: on ? fonts.body600 : fonts.body500 }]}>{label}</Text>
                  <Text style={styles.segHint}>{hint}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.small}>{MODE_HINT[m.speedMode]}</Text>
        </Row>
      </Group>

      <Cap>СТАТУС НАД ЗНАЧКОМ</Cap>
      <View style={styles.chips}>
        {STATUSES.map((st) => <Chip key={st} label={st} on={m.status === st} onPress={() => set({ status: st })} />)}
      </View>
      <TextInput value={custom ? m.status : ''} onChangeText={(t) => set({ status: t.slice(0, 24) || 'Свободен' })} maxLength={24}
        placeholder="Свой статус, до 24 знаков" placeholderTextColor={colors.muted3} style={styles.input} accessibilityLabel="Свой статус" />
      <Text style={styles.small}>«На событии» ставится сам, когда ты отметился «Я на месте», и снимается, когда уходишь.</Text>

      <Cap>КОЛЬЦО И ЗНАЧОК</Cap>
      <Group>
        <Row title="Цвет кольца" right={
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {(Object.keys(RING_COLORS) as Ring[]).map((r) => (
              <Pressable key={r} onPress={() => set({ ring: r })} accessibilityRole="radio" accessibilityState={{ selected: m.ring === r }} accessibilityLabel={`Кольцо: ${r}`}
                style={[styles.dotWrap, m.ring === r && { borderColor: colors.ink }]}>
                <View style={[styles.dot, { backgroundColor: RING_COLORS[r] }]} />
              </Pressable>
            ))}
          </View>
        } />
        <Row title="Что внутри" last>
          <View style={styles.seg}>
            {([['photo', 'Фото профиля'], ['letter', 'Буква имени']] as ['photo' | 'letter', string][]).map(([k, label]) => (
              <Pressable key={k} onPress={() => set({ inside: k })} style={[styles.segItem, { height: 40 }, m.inside === k && styles.segOn]} accessibilityRole="radio" accessibilityState={{ selected: m.inside === k }}>
                <Text style={[styles.segLabel, { fontFamily: m.inside === k ? fonts.body600 : fonts.body500 }]}>{label}</Text>
              </Pressable>
            ))}
          </View>
        </Row>
      </Group>

      <Cap>КТО ВИДИТ</Cap>
      <Group>
        <Pressable onPress={() => set({ shareUntil: sharing ? null : new Date(Date.now() + 2 * 3600e3).toISOString() })} accessibilityRole="button">
          <Row title="Геолокация для друзей" sub={sharing ? `открыта до ${String(until!.getHours()).padStart(2, '0')}:${String(until!.getMinutes()).padStart(2, '0')} · нажми, чтобы выключить` : 'на 2 часа, потом выключится сама'}
            right={<Ic d={sharing ? IC.check : IC.chevron} size={18} color={sharing ? colors.ok : colors.muted} w={2} />} />
        </Pressable>
        <SwitchRow title="Невидимка" sub="спрятаться сразу от всех" on={m.invisible} onChange={(invisible) => set({ invisible })} last />
      </Group>
      <Text style={styles.small}>Скорость и статус видят только друзья, которым открыта геолокация. Историю перемещений мы не храним — только последнюю точку.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  h1: { fontFamily: fonts.display700, fontSize: 24, letterSpacing: -0.5, color: colors.ink },
  sub: { fontFamily: fonts.body400, fontSize: 13, color: colors.muted },
  preview: { height: 240, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: colors.line, backgroundColor: '#EFEBE2', marginTop: 8 },
  me: { position: 'absolute', left: '50%', top: 102, width: 240, marginLeft: -120, height: 60, alignItems: 'center', justifyContent: 'center' },
  trail: { position: 'absolute', top: 27.5, width: 5, height: 5, borderRadius: 3, backgroundColor: colors.friend },
  ring: { width: 60, height: 60, borderRadius: 30, borderWidth: 4, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  face: { width: 48, height: 48, borderRadius: 24 },
  letter: { fontFamily: fonts.display700, fontSize: 20, color: colors.ink },
  speed: { position: 'absolute', top: 64, flexDirection: 'row', alignItems: 'center', gap: 4, height: 22, paddingHorizontal: 8, borderRadius: 11, backgroundColor: colors.friend },
  speedText: { fontFamily: fonts.mono600, fontSize: 10, color: '#FFFFFF', flexShrink: 0 },
  bubble: { position: 'absolute', top: -54, left: 136, width: 150, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: colors.ink },
  bubbleText: { fontFamily: fonts.body600, fontSize: 13, color: colors.paper, flexShrink: 0 },
  inv: { position: 'absolute', left: 16, right: 16, top: 100, padding: 12, borderRadius: 12, backgroundColor: colors.ink, alignItems: 'center' },
  seg: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: 14, backgroundColor: colors.sand },
  segItem: { flex: 1, height: 48, borderRadius: 11, alignItems: 'center', justifyContent: 'center', gap: 1 },
  segOn: { backgroundColor: colors.card, shadowColor: colors.ink, shadowOpacity: 0.14, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 2 },
  segLabel: { fontSize: 13.5, color: colors.ink },
  segHint: { fontFamily: fonts.mono500, fontSize: 9, letterSpacing: 0.4, color: colors.muted },
  small: { fontFamily: fonts.body400, fontSize: 12.5, lineHeight: 17, color: colors.muted2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  input: { height: 48, paddingHorizontal: 16, borderWidth: 1, borderColor: colors.line2, borderRadius: 16, backgroundColor: colors.card, fontFamily: fonts.body400, fontSize: 15, color: colors.ink },
  dotWrap: { width: 38, height: 38, borderRadius: 19, borderWidth: 2, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  dot: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: '#FFFFFF' },
});
