// Тело карточки растёт по контенту, медиа заполняет оставшийся верх: формат афиши не создаёт пустот под текстом.
// Полная геометрия карточки остаётся стабильной для свайпа и раскрытия. Штампы проявляются от сдвига.
import { photo as imageSource } from '../data/photos';
import { ChevronLeft, ChevronRight, Clock, MapPin, Ticket } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Image } from 'expo-image';
import { Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { edgeBorder } from '../ui/glass';
import Animated, { Extrapolation, interpolate, type SharedValue, useAnimatedStyle } from 'react-native-reanimated';
import type { EventItem, Person } from '../data/types';
import { editorialText } from '../event/editorial';
import { displayEventTitle } from '../event/title';
import { eventFacts } from '../event/facts';

import { colors, fonts } from '../theme';
import { Avatar } from '../ui/Avatar';
import { EventCover } from '../ui/EventCover';
import { EventMedia, eventMedia } from '../ui/EventMedia';
import { ATTRACTIONS, inSeason, KIND_COLOR, KIND_LABEL, seasonText } from '../data/attractions';
import { openStatus } from '../data/hours';
import { AttractionPin } from '../map/ui/AttractionPin';

export function feedSocial(e: EventItem, people: Person[]): { text: string; faces: { p: Person; ring?: string }[] } {
  const friends = e.friendsGoing.map((id) => people.find((p) => p.id === id)).filter(Boolean) as Person[];
  const looking = Math.max(e.lookingCount, e.lookers?.length ?? 0);
  if (friends.length) {
    const names = friends.length === 1 ? `${friends[0].name} идёт` : friends.length === 2 ? `${friends[0].name} и ${friends[1].name} идут` : `${friends[0].name}, ${friends[1].name} и ещё ${friends.length - 2} идут`;
    return { text: looking >= 3 && friends.length === 1 ? `${names} · ${looking} ищут компанию` : names, faces: friends.slice(0, 3).map((p) => ({ p, ring: colors.friend })) };
  }
  if (looking >= 3) return { text: `${looking} человек ищут компанию`, faces: [] };
  if (e.goingCount >= 3) return { text: `Идут ${e.goingCount.toLocaleString('ru-RU')}`, faces: [] };
  return { text: '', faces: [] };
}

export function feedCoverH(e: EventItem, height: number): number {
  return Math.round(e.spotId ? height * 0.5 : Math.min(height * (e.media?.some(m => m.type === 'video') ? 0.62 : 0.54), height - 170));
}

export function FeedCard(props: { e: EventItem; people: Person[]; now: Date; dx?: SharedValue<number>; stamp?: SharedValue<number>; height: number; active?: boolean }) {
  return props.e.spotId ? <SpotFeedCard {...props} /> : <EventFeedCard {...props} />;
}

function EventFeedCard({ e, people, now: _now, dx, stamp, height, active = false }: {
  e: EventItem; people: Person[]; now: Date; dx?: SharedValue<number>; stamp?: SharedValue<number>; height: number; active?: boolean;
}) {
  const coverH = feedCoverH(e, height);
  const media = useMemo(() => eventMedia(e), [e]);
  const [page, setPage] = useState(() => Math.max(0, media.findIndex(m => m.type === 'video')));
  const [mediaHeight, setMediaHeight] = useState(coverH);
  const { fontScale } = useWindowDimensions();
  const compact = height / fontScale < 440;
  const selected = Math.min(page, Math.max(0, media.length - 1));
  const item = media[selected];
  const social = feedSocial(e, people);
  const f = eventFacts(e);
  const about = !compact && e.about.trim() ? editorialText(e) : '';
  const goStamp = useAnimatedStyle(() => ({ opacity: stamp?.get() === 1 ? 1 : dx ? interpolate(dx.get(), [0, 90], [0, 1], Extrapolation.CLAMP) : 0 }));
  const skipStamp = useAnimatedStyle(() => ({ opacity: stamp?.get() === -1 ? 1 : dx ? interpolate(dx.get(), [-90, 0], [1, 0], Extrapolation.CLAMP) : 0 }));
  return (
    <View style={[styles.card, { height }]} accessibilityLabel={`${e.title}. ${f.when}. ${f.place}. ${f.price}. Нажми, чтобы открыть подробности`}>
      <View style={styles.media} onLayout={ev => setMediaHeight(Math.round(ev.nativeEvent.layout.height))}>
      <EventCover cover={null} category={e.category} color={e.coverColor} style={StyleSheet.absoluteFill} iconSize={Math.round(mediaHeight * 0.62)}>
        {item?.type === 'image' ? <FeedPhoto key={item.url} uri={item.url} /> : item && <View style={StyleSheet.absoluteFill}><EventMedia items={media} height={mediaHeight} active={active} fit="cover" selected={selected} /></View>}
        <MediaShade />
        {active && media.length > 1 && <>
          <Pressable accessibilityRole="button" accessibilityLabel="Предыдущее фото" onPress={() => setPage((selected - 1 + media.length) % media.length)} style={[styles.mediaArrow, { left: 8 }]}><ChevronLeft color="white" size={20} /></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Следующее фото" onPress={() => setPage((selected + 1) % media.length)} style={[styles.mediaArrow, { right: 8 }]}><ChevronRight color="white" size={20} /></Pressable>
        </>}
        {media.length > 1 && <View pointerEvents="none" style={styles.mediaCount}><Text style={styles.mediaCountText}>{selected + 1} / {media.length}</Text></View>}
        {e.lang === 'kk' && <View style={styles.kk} accessibilityLabel="Событие на казахском языке"><Text style={styles.kkText}>ҚАЗАҚША</Text></View>}
        <Animated.View pointerEvents="none" style={[styles.stamp, styles.stampGo, goStamp]}><Text style={[styles.stampText, { color: colors.accent }]}>ПОЙДУ</Text></Animated.View>
        <Animated.View pointerEvents="none" style={[styles.stamp, styles.stampSkip, skipStamp]}><Text style={styles.stampText}>МИМО</Text></Animated.View>
      </EventCover>
      </View>
      <View style={[styles.body, compact && styles.bodyCompact]}>
        <Text style={[styles.title, compact && styles.titleCompact]} numberOfLines={compact ? 2 : 3} maxFontSizeMultiplier={1.3}>{displayEventTitle(e.title) || 'Событие'}</Text>
        <View style={styles.facts}>
          <Fact Icon={Clock} text={f.when} bad={f.whenMissing} />
          <Fact Icon={MapPin} text={f.place} bad={f.placeMissing} />
          <Fact Icon={Ticket} text={f.price} bad={f.priceMissing} strong={!f.priceMissing} />
        </View>
        {!!about && <Text style={styles.about} numberOfLines={2} maxFontSizeMultiplier={1.3}>{about}</Text>}
        {social.text ? (
          <View style={styles.socialRow}>
            {social.faces.length > 0 && (
              <View style={{ flexDirection: 'row', paddingRight: 4 }}>
                {social.faces.map(({ p }, i) => <Avatar key={p.id} p={p} size={24} style={{ marginLeft: i ? -8 : 0, borderWidth: 2, borderColor: colors.card }} />)}
              </View>
            )}
            <Text style={styles.social} numberOfLines={1} maxFontSizeMultiplier={1.3}>{social.text}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

/** Карточка постоянного места: шапка цвета места с крупным объёмным значком, «постоянное место», статус и совет. */
function SpotFeedCard({ e, now, dx, stamp, height }: { e: EventItem; now: Date; dx?: SharedValue<number>; stamp?: SharedValue<number>; height: number }) {
  const a = e.spot ?? ATTRACTIONS.find((x) => x.id === e.spotId) ?? null;
  const goStamp = useAnimatedStyle(() => ({ opacity: stamp?.get() === 1 ? 1 : dx ? interpolate(dx.get(), [0, 90], [0, 1], Extrapolation.CLAMP) : 0 }));
  const skipStamp = useAnimatedStyle(() => ({ opacity: stamp?.get() === -1 ? 1 : dx ? interpolate(dx.get(), [-90, 0], [1, 0], Extrapolation.CLAMP) : 0 }));
  const [bad, setBad] = useState(0);
  if (!a) return <View style={[styles.card, { height }]} />;
  const color = KIND_COLOR[a.kind];
  const photo = a.photos?.[bad];
  const st = openStatus(a.hours, now);
  const compact = height < 440;
  return (
    <View style={[styles.card, { height }]} accessibilityLabel={`${a.name}. ${KIND_LABEL[a.kind]}. Свайп вправо — запланировать`}>
      <View style={[styles.media, { alignItems: 'center', justifyContent: 'center' }]}>
        <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" preserveAspectRatio="none">
          <Defs><LinearGradient id={`spotG${a.id}`} x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor={color} stopOpacity={1} /><Stop offset="1" stopColor={color} stopOpacity={0.6} /></LinearGradient></Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill={`url(#spotG${a.id})`} />
        </Svg>
        {photo ? (
          <>
            <Image source={imageSource(photo)} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" recyclingKey={photo} onError={() => setBad((b) => b + 1)} />
            <View pointerEvents="none" style={styles.spotCorner}><AttractionPin a={a} label={false} onPress={() => undefined} /></View>
          </>
        ) : <View pointerEvents="none" style={{ transform: [{ scale: 2.4 }] }}><AttractionPin a={a} label={false} onPress={() => undefined} /></View>}
        <MediaShade />
        {a.free && <View style={[styles.when, photo && { left: undefined, right: 14 }]}><Text style={styles.whenText}>БЕСПЛАТНО</Text></View>}
        <Animated.View pointerEvents="none" style={[styles.stamp, styles.stampGo, goStamp]}><Text style={[styles.stampText, { color: colors.accent }]}>ХОЧУ</Text></Animated.View>
        <Animated.View pointerEvents="none" style={[styles.stamp, styles.stampSkip, skipStamp]}><Text style={styles.stampText}>МИМО</Text></Animated.View>
      </View>
      <View style={[styles.body, compact && styles.bodyCompact]}>
        <Text style={[styles.title, compact && styles.titleCompact]} numberOfLines={compact ? 2 : 3} maxFontSizeMultiplier={1.3}>{a.name}</Text>
        <View style={styles.facts}>
          <Fact Icon={Clock} text={inSeason(a, now) ? (st.state === 'unknown' ? 'каждый день · часы в карточке' : st.text) : seasonText(a, now)} />
          <Fact Icon={MapPin} text={a.address ?? KIND_LABEL[a.kind]} />
          <Fact Icon={Ticket} text={a.free ? 'бесплатно' : a.priceFrom ? `от ${a.priceFrom.toLocaleString('ru-RU')} ₸` : 'цена в карточке'} strong={!!a.free || !!a.priceFrom} />
        </View>
        {!compact && <Text style={styles.about} numberOfLines={2} maxFontSizeMultiplier={1.3}>{a.tips?.[0] ?? a.about}</Text>}
      </View>
    </View>
  );
}

function Fact({ Icon, text, bad, strong }: { Icon: typeof Clock; text: string; bad?: boolean; strong?: boolean }) {
  return (
    <View style={styles.fact}>
      <Icon size={16} color={bad ? colors.muted3 : colors.ink} strokeWidth={1.9} />
      <Text style={[styles.factText, bad && { color: colors.muted3, fontFamily: fonts.body500 }, strong && { fontFamily: fonts.body700 }]} numberOfLines={1} maxFontSizeMultiplier={1.3}>{text}</Text>
    </View>
  );
}

/** Keep every poster legible; a cached, static backdrop fills its letterboxing without another video decoder. */
function FeedPhoto({ uri }: { uri: string }) {
  const [broken, setBroken] = useState(false);
  if (broken) return null;
  const source = imageSource(uri);
  return <View style={StyleSheet.absoluteFill} pointerEvents="none">
    <Image source={source} style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={22} cachePolicy="memory-disk" recyclingKey={`${uri}:backdrop`} />
    <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(23,22,26,0.25)' }]} />
    <Image source={source} style={StyleSheet.absoluteFill} contentFit="contain" cachePolicy="memory-disk" recyclingKey={uri} onError={() => setBroken(true)} />
  </View>;
}

function MediaShade() {
  return <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width="100%" height="100%" preserveAspectRatio="none">
    <Defs><LinearGradient id="feedShade" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={colors.ink} stopOpacity={0.3} /><Stop offset="0.35" stopColor={colors.ink} stopOpacity={0} /><Stop offset="0.8" stopColor={colors.ink} stopOpacity={0} /><Stop offset="1" stopColor={colors.ink} stopOpacity={0.3} /></LinearGradient></Defs>
    <Rect width="100%" height="100%" fill="url(#feedShade)" />
  </Svg>;
}

const styles = StyleSheet.create({
  // Жидкое стекло (FIX3 Ф12): светлая кромка сверху, блик внутри, глубокая мягкая тень; плашки на фото — полупрозрачные.
  // Карточка движется под пальцем каждый кадр — на Android без внутренней тени и с одной внешней (дешевле).
  card: { borderRadius: 30, overflow: 'hidden', backgroundColor: '#F3EFE6', ...edgeBorder, boxShadow: Platform.OS === 'android' ? 'none' : 'inset 0 1px 1px rgba(255,255,255,0.9), 0 22px 44px -20px rgba(23,22,26,0.5), 0 3px 10px rgba(23,22,26,0.06)' },
  media: { flex: 1, minHeight: 80, overflow: 'hidden' },
  cat: { position: 'absolute', left: 14, top: 14, maxWidth: '65%', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, backgroundColor: 'rgba(23,22,26,0.78)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' },
  catText: { fontFamily: fonts.mono600, fontSize: 10.5, letterSpacing: 0.7, color: '#FFFFFF' },
  kk: { position: 'absolute', right: 14, top: 14, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 9, backgroundColor: '#1E7BB8' },
  kkText: { fontFamily: fonts.mono600, fontSize: 10.5, letterSpacing: 0.8, color: '#FFFFFF' },
  when: { position: 'absolute', left: 14, bottom: 14, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, backgroundColor: 'rgba(23,22,26,0.5)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)' },
  whenText: { fontFamily: fonts.mono600, fontSize: 11, letterSpacing: 0.8, color: '#EEE9DE' },
  spotCorner: { position: 'absolute', left: 4, bottom: -4 },
  stamp: { position: 'absolute', top: 40, paddingVertical: 6, paddingHorizontal: 12, borderWidth: 3, borderRadius: 12, backgroundColor: 'rgba(251,250,246,0.92)' },
  stampGo: { left: 20, borderColor: colors.accent, transform: [{ rotate: '-12deg' }] },
  stampSkip: { right: 20, borderColor: colors.ink, transform: [{ rotate: '12deg' }] },
  stampText: { fontFamily: fonts.display800, fontSize: 26, letterSpacing: 0.5, color: colors.ink },
  body: { flexShrink: 0, paddingHorizontal: 18, paddingTop: 16, paddingBottom: 18, gap: 10 },
  bodyCompact: { paddingTop: 12, paddingBottom: 12, gap: 8 },
  title: { fontFamily: fonts.display700, fontSize: 25, lineHeight: 29, letterSpacing: -0.65, color: colors.ink },
  titleCompact: { fontSize: 22, lineHeight: 25 },
  facts: { gap: 7 },
  fact: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  factText: { flex: 1, fontFamily: fonts.body500, fontSize: 13.5, lineHeight: 18, color: colors.ink },
  about: { fontFamily: fonts.body400, fontSize: 13.5, lineHeight: 19, color: colors.muted },
  socialRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 2 },
  social: { flex: 1, fontFamily: fonts.body500, fontSize: 13.5, color: colors.muted },
  mediaArrow: { position: 'absolute', top: '42%', width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(23,22,26,0.65)' },
  mediaCount: { position: 'absolute', right: 12, bottom: 10, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: 'rgba(23,22,26,0.55)' },
  mediaCountText: { color: 'white', fontFamily: fonts.body600, fontSize: 12 },
});
