// Плавное раскрытие карточки: пока она растёт из мини-карточки на весь экран, показываем лёгкую «шапку» (фото, время, название —
// как верх настоящей страницы), а саму тяжёлую страницу события монтируем, когда раскрытие почти закончено.
// Раньше страница монтировалась в середине жеста, и анимация дёргалась.
import { useState, type ComponentProps } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Extrapolation, interpolate, useAnimatedReaction, useAnimatedStyle, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import type { EventItem } from '../data/types';
import { stampOf } from '../map/ui/EventSheet';
import { Clock, Ticket } from 'lucide-react-native';
import { formatPrice } from '../lib/format';
import { whenTitle } from './text';
import { colors, fonts } from '../theme';
import { plate } from '../ui/glass';
import { EventCover } from '../ui/EventCover';
import { EventPage } from './EventPage';

const COVER_H = 470;

/** Фото растёт из высоты фото карточки до 470, текст проявляется и поднимается — «шапка» как у настоящей страницы. */
function Hero({ e, now, progress, coverFrom }: { e: EventItem; now: Date; progress: SharedValue<number>; coverFrom: number }) {
  const cover = useAnimatedStyle(() => ({ height: interpolate(progress.get(), [0, 1], [coverFrom, COVER_H], Extrapolation.CLAMP) }));
  const text = useAnimatedStyle(() => ({
    opacity: interpolate(progress.get(), [0.3, 0.85], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(progress.get(), [0.3, 1], [18, 0], Extrapolation.CLAMP) }],
  }));
  const price = formatPrice(e.priceMin, e.priceMax, e.isFree);
  return (
    <View style={styles.root}>
      <Animated.View style={[{ overflow: 'hidden' }, cover]}>
      <EventCover cover={e.cover} category={e.category} color={e.coverColor} style={styles.cover} iconSize={240}>
        <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" preserveAspectRatio="none" pointerEvents="none">
          <Defs>
            <LinearGradient id="heroShade" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#17161A" stopOpacity="0.25" />
              <Stop offset="0.45" stopColor="#17161A" stopOpacity="0" />
              <Stop offset="1" stopColor="#17161A" stopOpacity="0.8" />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#heroShade)" />
        </Svg>
        <Animated.View style={[styles.text, text]}>
          <View style={styles.stamp}><Text style={styles.stampText}>{stampOf(e, now)}</Text></View>
          <Text style={styles.h1}>{e.title}</Text>
        </Animated.View>
      </EventCover>
      </Animated.View>
      {/* Первые строки страницы — те же, что у настоящей: когда она появится, ничего не прыгает. */}
      <Animated.View style={[styles.body, text]}>
        <View style={styles.chips}>
          <View style={styles.chip}><Clock size={16} color={colors.ink} strokeWidth={1.9} /><Text style={styles.chipText}>{whenTitle(e, now)}</Text></View>
          {!!price && <View style={styles.chip}><Ticket size={16} color={colors.ink} strokeWidth={1.9} /><Text style={styles.chipText}>{price}</Text></View>}
        </View>
        {!!e.about && <Text style={styles.about} numberOfLines={6}>{e.about}</Text>}
      </Animated.View>
    </View>
  );
}

export function LazyEventPage({ progress, coverFrom = COVER_H, ...props }: ComponentProps<typeof EventPage> & { progress: SharedValue<number>; coverFrom?: number }) {
  const [ready, setReady] = useState(false);
  const shown = useSharedValue(false);
  // Раскрылась — настоящая страница; начала сворачиваться — снова лёгкая шапка, чтобы страница не сжималась кадр за кадром.
  useAnimatedReaction(
    () => progress.get(),
    (v, prev) => {
      if (v >= 0.97 && !shown.get()) { shown.set(true); scheduleOnRN(setReady, true); }
      else if (shown.get() && prev != null && v < prev && v < 0.97) { shown.set(false); scheduleOnRN(setReady, false); }
    },
  );
  return ready ? <EventPage {...props} /> : <Hero e={props.e} now={props.now} progress={progress} coverFrom={coverFrom} />;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  cover: { flex: 1, justifyContent: 'flex-end' },
  text: { padding: 18, gap: 10 },
  stamp: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, backgroundColor: 'rgba(23,22,26,0.55)' },
  stampText: { fontFamily: fonts.mono600, fontSize: 11.5, letterSpacing: 0.9, color: '#EEE9DE' },
  body: { paddingTop: 16, paddingHorizontal: 18, gap: 14 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 7, height: 36, paddingHorizontal: 12, borderRadius: 12, ...plate },
  chipText: { fontFamily: fonts.body700, fontSize: 14, color: colors.ink },
  about: { fontFamily: fonts.body400, fontSize: 15, lineHeight: 23.25, color: colors.muted2 },
  h1: { fontFamily: fonts.display800, fontSize: 30, letterSpacing: -0.9, lineHeight: 33, color: '#FFFFFF' },
});
