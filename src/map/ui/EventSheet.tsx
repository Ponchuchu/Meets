// Шторка события на карте (V6.md §3.1): на половину экрана — обложка, «СЕГОДНЯ · 20:00», название, чипсы,
// кто идёт, «Пойду» и «Позвать». Тап или свайп вверх — полная карточка (§4.2), свайп вниз — спрятать.
import { Clock, MapPin, Ticket } from 'lucide-react-native';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { photo } from '../../data/photos';
import type { EventItem, Person } from '../../data/types';
import { almaty, dayIndex } from '../../lib/clock';
import { formatPrice } from '../../lib/format';
import { distM } from '../../live/geo';
import { colors, fonts } from '../../theme';
import { Avatar } from '../../ui/Avatar';
import { Ic } from '../../ui/Ic';
import { CAT_COLOR, CAT_ICON, catFg } from '../icons';
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

export function EventSheet({ e, now, people, me, going, onOpen, onGo, onInvite, onHide }: {
  e: EventItem; now: Date; people: Person[]; me: { lat: number; lon: number } | null; going: boolean;
  onOpen: () => void; onGo: () => void; onInvite: () => void; onHide: () => void;
}) {
  const friends = e.friendsGoing.map((id) => people.find((p) => p.id === id)).filter(Boolean) as Person[];
  const price = formatPrice(e.priceMin, e.priceMax, e.isFree);
  const dist = me && !e.needsPin ? kmText(distM(me, e)) : null;
  const bg = CAT_COLOR[e.category];
  const y = useSharedValue(0);
  const pan = Gesture.Pan().activeOffsetY([-12, 12]).runOnJS(true)
    .onUpdate((g) => y.set(Math.max(-60, g.translationY)))
    .onEnd((g) => {
      if (g.translationY < -50 || g.velocityY < -700) onOpen();
      else if (g.translationY > 70 || g.velocityY > 800) onHide();
      y.set(withSpring(0, { damping: 18 }));
    });
  const st = useAnimatedStyle(() => ({ transform: [{ translateY: y.get() }] }));
  return (
    <GestureDetector gesture={pan}>
      <Animated.View entering={FadeInDown.duration(260)} style={[styles.sheet, st]}>
        <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel={`${e.title}. ${stampOf(e, now)}. Открыть событие`} accessibilityHint="Потяни вверх, чтобы раскрыть">
          <View style={[styles.cover, { backgroundColor: bg }]}>
            {e.cover ? <Image source={photo(e.cover)} style={StyleSheet.absoluteFill} resizeMode="cover" /> : (
              <View style={styles.bigIcon}><Ic d={CAT_ICON[e.category]} size={96} color={catFg(e.category) === colors.ink ? 'rgba(23,22,26,0.16)' : 'rgba(255,255,255,0.28)'} w={1.5} /></View>
            )}
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
          </View>
          <View style={styles.body}>
            <View style={styles.chips}>
              <View style={styles.chip}><Clock size={15} color={colors.ink} strokeWidth={1.9} /><Text style={styles.chipText}>{hm(e.startsAt)}</Text></View>
              {!!price && <View style={styles.chip}><Ticket size={15} color={colors.ink} strokeWidth={1.9} /><Text style={styles.chipText}>{price}</Text></View>}
              {dist && <View style={styles.chip}><MapPin size={15} color={colors.ink} strokeWidth={1.9} /><Text style={styles.chipText}>{dist}</Text></View>}
            </View>
            <View style={styles.who}>
              {friends.length > 0 && (
                <View style={{ flexDirection: 'row', marginRight: 2 }}>
                  {friends.slice(0, 3).map((p, i) => <Avatar key={p.id} p={p} size={28} style={{ marginLeft: i ? -9 : 0, borderWidth: 2, borderColor: '#FBFAF6' }} />)}
                </View>
              )}
              <Text style={styles.whoText} numberOfLines={1}>{socialLine(e, people)}</Text>
            </View>
          </View>
        </Pressable>
        <View style={styles.actions}>
          <Pressable onPress={onGo} style={({ pressed }) => [styles.go, going && styles.goOn, pressed && styles.pressed]} accessibilityRole="button" accessibilityState={{ selected: going }}>
            <Text style={[styles.goText, going && { color: colors.paper }]}>{going ? 'Иду ✓' : 'Пойду'}</Text>
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
  sheet: { borderRadius: 28, backgroundColor: '#FBFAF6', overflow: 'hidden', shadowColor: colors.ink, shadowOpacity: 0.18, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 12 },
  cover: { height: 178, justifyContent: 'flex-end' },
  bigIcon: { position: 'absolute', right: 18, top: 22 },
  grab: { position: 'absolute', top: 8, alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.75)' },
  coverText: { padding: 16, gap: 8 },
  stamp: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 9, backgroundColor: 'rgba(23,22,26,0.55)' },
  stampText: { fontFamily: fonts.mono600, fontSize: 11, letterSpacing: 0.8, color: '#FBFAF6' },
  title: { fontFamily: fonts.display800, fontSize: 25, lineHeight: 28, letterSpacing: -0.7, color: '#FFFFFF' },
  body: { paddingHorizontal: 16, paddingTop: 12, gap: 10 },
  chips: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 32, paddingHorizontal: 10, borderRadius: 10, backgroundColor: '#EFEBE1' },
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
