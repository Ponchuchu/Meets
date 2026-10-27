// «Места города» (21 октября, после отзыва владельца): раньше — «Сходить одному», слишком громко. Теперь спокойно:
// постоянные места по настроению (погулять, посмотреть, подвигаться), что открыто сейчас, бесплатное, и в конце —
// тихая подборка событий, куда приходят без своей компании. Карточка места та же, что на карте.
import { NONE } from '../../lib/empty';
import { remote } from '../../data/photos';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { data, eventsSnapshot } from '../../data';
import { ATTRACTIONS, inSeason, KIND_LABEL, topSpots, type Attraction, type AttractionKind } from '../../data/attractions';
import { openStatus } from '../../data/hours';
import { getSpots } from '../../data/spots';
import { planWhen } from '../../lib/planWhen';
import { now as clockNow } from '../../lib/clock';
import { CAT_COLOR, CAT_ICON, catFg } from '../../map/icons';
import { AttractionPin } from '../../map/ui/AttractionPin';
import { SpotSheet } from '../../map/ui/SpotSheet';
import { colors, fonts } from '../../theme';
import { plate } from '../../ui/glass';
import { Ic } from '../../ui/Ic';

const MOODS: { key: string; title: string; sub: string; kinds: AttractionKind[] }[] = [
  { key: 'walk', title: 'Погулять и подумать', sub: 'парки, сады, тропы', kinds: ['park', 'garden', 'view', 'photo'] },
  { key: 'look', title: 'Посмотреть что-то новое', sub: 'музеи и выставки', kinds: ['museum', 'zoo'] },
  { key: 'move', title: 'Подвигаться', sub: 'горы, каток, скалодром', kinds: ['ski', 'skate', 'climb', 'cable', 'wheel'] },
];

export default function SoloScreen() {
  const insets = useSafeAreaInsets();
  const now = clockNow();
  const spotsQ = useQuery({ queryKey: ['spots'], queryFn: getSpots, staleTime: 3600e3, placeholderData: ATTRACTIONS });
  const all = spotsQ.data ?? ATTRACTIONS;
  const { data: events = NONE } = useQuery({ queryKey: ['events'], queryFn: () => data.getEvents(), placeholderData: eventsSnapshot });
  const [open, setOpen] = useState<Attraction | null>(null);
  const [broken, setBroken] = useState<string[]>([]);
  const solo = topSpots(all).filter((a) => inSeason(a, now));
  const free = solo.filter((a) => a.free).slice(0, 10);
  // Только где часы известны (их дописывает сборщик): «открыто» без данных было бы догадкой.
  const openNow = solo.filter((a) => openStatus(a.hours, now).state === 'open').slice(0, 8);
  const soloEvents = events.filter((e) => e.tags.includes('можно одному') && Date.parse(e.endsAt ?? e.startsAt) > now.getTime()).slice(0, 6);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/plans'));

  const Tile = ({ a }: { a: Attraction }) => {
    const st = openStatus(a.hours, now);
    return (
      <Pressable onPress={() => setOpen(a)} style={({ pressed }) => [styles.tile, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel={`${a.name}, ${KIND_LABEL[a.kind]}`}>
        {a.photos?.[0] && !broken.includes(a.id)
          ? <Image source={remote(a.photos[0])} style={styles.tilePhoto} resizeMode="cover" onError={() => setBroken((b) => [...b, a.id])} />
          : <View style={styles.tileIcon} pointerEvents="none"><AttractionPin a={a} label={false} onPress={() => undefined} /></View>}
        <Text style={styles.tileName} numberOfLines={2}>{a.name}</Text>
        <Text style={[styles.tileSub, st.state === 'open' && { color: colors.ok }]} numberOfLines={1}>{a.free ? 'бесплатно' : st.state === 'unknown' ? KIND_LABEL[a.kind].toLowerCase() : st.text.toLowerCase()}</Text>
      </Pressable>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <ScrollView contentContainerStyle={{ paddingTop: Math.max(50, insets.top + 6), paddingBottom: insets.bottom + 32, gap: 14 }}>
        <View style={[styles.head, { paddingHorizontal: 16 }]}>
          <Pressable onPress={back} style={styles.back} accessibilityRole="button" accessibilityLabel="Назад"><ChevronLeft size={24} color={colors.ink} strokeWidth={2.2} /></Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.h1} accessibilityRole="header">Места города</Text>
            <Text style={styles.sub}>Парки, горы и музеи — работают каждый день, можно просто выбрать время</Text>
          </View>
        </View>

        {openNow.length > 0 && <Section title="Открыто сейчас">{openNow.map((a) => <Tile key={a.id} a={a} />)}</Section>}
        {free.length > 0 && <Section title="Бесплатно">{free.map((a) => <Tile key={a.id} a={a} />)}</Section>}
        {MOODS.map((m) => {
          const list = solo.filter((a) => m.kinds.includes(a.kind));
          return list.length ? <Section key={m.key} title={m.title} sub={m.sub}>{list.map((a) => <Tile key={a.id} a={a} />)}</Section> : null;
        })}

        {soloEvents.length > 0 && (
          <View style={{ gap: 8, paddingHorizontal: 16 }}>
            <Text style={styles.cap}>МОЖНО БЕЗ СВОЕЙ КОМПАНИИ</Text>
            {soloEvents.map((e) => (
              <Pressable key={e.id} onPress={() => router.push({ pathname: '/event/[id]', params: { id: e.id } })} style={({ pressed }) => [styles.event, pressed && styles.pressed]} accessibilityRole="button">
                <View style={[styles.evIcon, { backgroundColor: CAT_COLOR[e.category] }]}><Ic d={CAT_ICON[e.category]} size={20} color={catFg(e.category)} w={2} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.evTitle} numberOfLines={1}>{e.title}</Text>
                  <Text style={styles.evSub} numberOfLines={1}>{planWhen(e, now).text} · {e.venueName ?? e.address.split(',')[0]}</Text>
                </View>
                <ChevronRight size={18} color={colors.muted} strokeWidth={2} />
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
      {open && <SpotSheet key={open.id} a={open} all={all} onClose={() => setOpen(null)} onOpen={setOpen} />}
    </View>
  );
}

function Section({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <View style={{ paddingHorizontal: 16 }}>
        <Text style={styles.secTitle}>{title}</Text>
        {sub && <Text style={styles.secSub}>{sub}</Text>}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingHorizontal: 16 }}>{children}</ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  back: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginLeft: -10 },
  h1: { fontFamily: fonts.display800, fontSize: 28, letterSpacing: -0.8, color: colors.ink },
  sub: { fontFamily: fonts.body400, fontSize: 14, lineHeight: 19, color: colors.muted2, marginTop: 2 },
  secTitle: { fontFamily: fonts.display700, fontSize: 19, color: colors.ink },
  secSub: { fontFamily: fonts.body400, fontSize: 13, color: colors.muted },
  cap: { fontFamily: fonts.mono600, fontSize: 10.5, letterSpacing: 0.8, color: colors.muted, marginTop: 6 },
  tile: { width: 140, minHeight: 150, padding: 12, borderRadius: 22, ...plate, gap: 4 },
  tilePhoto: { height: 72, borderRadius: 14, marginBottom: 4, backgroundColor: colors.sand },
  tileIcon: { height: 60, alignItems: 'flex-start', justifyContent: 'center', marginLeft: -8 },
  tileName: { fontFamily: fonts.body700, fontSize: 14.5, lineHeight: 18, color: colors.ink },
  tileSub: { fontFamily: fonts.body500, fontSize: 12.5, color: colors.muted2 },
  event: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 18, ...plate },
  evIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  evTitle: { fontFamily: fonts.body700, fontSize: 15, color: colors.ink },
  evSub: { fontFamily: fonts.body400, fontSize: 12.5, color: colors.muted2 },
  pressed: { transform: [{ scale: 0.97 }] },
});
