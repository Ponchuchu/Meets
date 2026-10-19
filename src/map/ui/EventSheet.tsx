// Шторка события на карте (V6.md §3.1): на половину экрана — обложка, «СЕГОДНЯ · 20:00», название, чипсы,
// кто идёт, «Пойду» и «Позвать». Тап или свайп вверх — полная карточка (§4.2), свайп вниз — спрятать.
import { Clock, MapPin, Ticket } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { SlideInDown, SlideOutDown, useAnimatedStyle, useSharedValue, withSpring, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import type { EventItem, Person } from '../../data/types';
import { almaty, dayIndex } from '../../lib/clock';
import { formatPrice } from '../../lib/format';
import { distM } from '../../live/geo';
import { colors, fonts } from '../../theme';
import { Avatar } from '../../ui/Avatar';
import { EventCover } from '../../ui/EventCover';
import { glass } from '../../ui/glass';
import { socialLine } from '../social';

const hm = (iso: string) => { const d = almaty(iso); return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`; };
const WD = ['ВС', 'ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ'];

/** «СЕГОДНЯ · 20:00», «ЗАВТРА · 07:00», «СБ · 19:30»; длинное идущее — «ИДЁТ · ДО 21:00». */
export function stampOf(e: EventItem, now: Date): string {
  const start = new Date(e.startsAt).getTime();
  if (start <= now.getTime() && e.endsAt) return `ИДЁТ · ДО ${hm(e.endsAt)}`;
  const d = dayIndex(e.startsAt) - dayIndex(now);
  const day = d === 0 ? 'СЕГОДНЯ' : d === 1 ? 'ЗАВТРА' : WD[almaty(e.startsAt).getUTCDay()];
  return `${day} · ${hm(e.startsAt)}`;
}

export const kmText = (m: number) => (m < 1000 ? `${Math.round(m / 10) * 10} м` : `${(m / 1000).toFixed(1).replace('.', ',')} км`);

export function EventSheet({ e, now, people, me, going, onOpen, onGo, onInvite, onHide, expand, onReveal, onRevealEnd }: {
  e: EventItem; now: Date; people: Person[]; me: { lat: number; lon: number } | null; going: boolean;
  expand: SharedValue<number>; onReveal: () => void; onRevealEnd: (commit: boolean) => void;
  onOpen: () => void; onGo: () => void; onInvite: () => void; onHide: () => void;
}) {
  const friends = e.friendsGoing.map((id) => people.find((p) => p.id === id)).filter(Boolean) as Person[];
  const price = formatPrice(e.priceMin, e.priceMax, e.isFree);
  const dist = me && !e.needsPin ? kmText(distM(me, e)) : null;
  const y = useSharedValue(0);
  const revealing = useSharedValue(false);
  const pan = Gesture.Pan().activeOffsetY([-8, 12]).failOffsetX([-40, 40])
    .onUpdate((g) => {
      if (g.translationY < -8 && -g.translationY > Math.abs(g.translationX) * 1.1 && !revealing.get()) { revealing.set(true); scheduleOnRN(onReveal); }
      if (revealing.get()) expand.set(Math.max(0, Math.min(1, -g.translationY / 300)));
      else y.set(Math.max(0, g.translationY));
    })
    .onEnd((g) => {
      if (revealing.get()) { revealing.set(false); scheduleOnRN(onRevealEnd, expand.get() > 0.12 || g.velocityY < -350); }
      else if (g.translationY > 70 || g.velocityY > 800) scheduleOnRN(onHide);
      y.set(withSpring(0, { damping: 28, stiffness: 240, overshootClamping: true }));
    }).onFinalize((_e,success)=>{if(!success&&revealing.get()){revealing.set(false);scheduleOnRN(onRevealEnd,false);}});
  const st = useAnimatedStyle(() => ({ transform: [{ translateY: y.get() }] }));
  return (
    <GestureDetector gesture={pan}>
      <Animated.View entering={SlideInDown.duration(280)} exiting={SlideOutDown.duration(220)} style={[styles.sheet, st]}>
        <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel={`${e.title}. ${stampOf(e, now)}. Открыть событие`} accessibilityHint="Потяни вверх, чтобы раскрыть">
          <EventCover cover={e.cover} category={e.category} color={e.coverColor} style={styles.cover} iconSize={110}>
            <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" preserveAspectRatio="none">
              <Defs>
                <LinearGradient id="evShade" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0.35" stopColor="#17161A" stopOpacity="0" />
                  <Stop offset="1" stopColor="#17161A" stopOpacity="0.78" />
                </LinearGradient>
              </Defs>
              <Rect x="0" y="0" width="100%" height="100%" fill="url(#evShade)" />
            </Svg>
            <View style={styles.grab} />
            <View style={styles.coverText}>
              <View style={styles.stamp}><Text style={styles.stampText}>{stampOf(e, now)}</Text></View>
              <Text style={styles.title} numberOfLines={2}>{e.title}</Text>
            </View>
          </EventCover>
          <View style={styles.body}>
            <View style={styles.chips}>
              <View style={styles.chip}><Clock size={15} color={colors.ink} strokeWidth={1.9} /><Text style={styles.chipText}>{hm(e.startsAt)}</Text></View>
              {!!price && <View style={styles.chip}><Ticket size={15} color={colors.ink} strokeWidth={1.9} /><Text style={styles.chipText}>{price}</Text></View>}
              {dist && <View style={styles.chip}><MapPin size={15} color={colors.ink} strokeWidth={1.9} /><Text style={styles.chipText}>{dist}</Text></View>}
            </View>
            <View style={styles.who}>
              {friends.length > 0 && (
                <View style={{ flexDirection: 'row', marginRight: 2 }}>
                  {friends.slice(0, 3).map((p, i) => <Avatar key={p.id} p={p} size={28} style={{ marginLeft: i ? -9 : 0, borderWidth: 2, borderColor: '#EEE9DE' }} />)}
                </View>
              )}
              <Text style={styles.whoText} numberOfLines={1}>{socialLine(e, people)}</Text>
            </View>
          </View>
        </Pressable>
        <View style={styles.actions}>
          <Pressable onPress={onGo} style={({ pressed }) => [styles.go, going && styles.goOn, pressed && styles.pressed]} accessibilityRole="button" accessibilityState={{ selected: going }}>
            <Text style={[styles.goText, going && { color: colors.paper }]}>{going ? 'В планах' : 'Пойду'}</Text>
          </Pressable>
          <Pressable onPress={onInvite} style={({ pressed }) => [styles.invite, pressed && styles.pressed]} accessibilityRole="button">
            <Text style={styles.inviteText}>Позвать</Text>
          </Pressable>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  sheet: { borderRadius: 28, ...glass, backgroundColor: '#F1ECE2', overflow: 'hidden' },
  cover: { height: 178, justifyContent: 'flex-end' },
  grab: { position: 'absolute', top: 8, alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.75)' },
  coverText: { padding: 16, gap: 8 },
  stamp: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 9, backgroundColor: 'rgba(23,22,26,0.55)' },
  stampText: { fontFamily: fonts.mono600, fontSize: 11, letterSpacing: 0.8, color: '#EEE9DE' },
  title: { fontFamily: fonts.display800, fontSize: 25, lineHeight: 28, letterSpacing: -0.7, color: '#FFFFFF' },
  body: { paddingHorizontal: 16, paddingTop: 12, gap: 10 },
  chips: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 32, paddingHorizontal: 10, borderRadius: 10, backgroundColor: '#DDD7CA' },
  chipText: { fontFamily: fonts.body700, fontSize: 13.5, color: colors.ink },
  who: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 28 },
  whoText: { flex: 1, fontFamily: fonts.body600, fontSize: 14.5, color: colors.ink },
  actions: { flexDirection: 'row', gap: 8, padding: 16, paddingTop: 12 },
  go: { flex: 1, height: 52, borderRadius: 16, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  goOn: { backgroundColor: colors.ink },
  goText: { fontFamily: fonts.body700, fontSize: 16.5, color: colors.ink },
  invite: { height: 52, paddingHorizontal: 22, borderRadius: 16, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  inviteText: { fontFamily: fonts.body700, fontSize: 16.5, color: colors.paper },
  pressed: { transform: [{ scale: 0.97 }] },
});
