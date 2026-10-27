// Плавное раскрытие карточки: пока она растёт из мини-карточки на весь экран, показываем лёгкую «шапку» (фото, время, название —
// как верх настоящей страницы), а саму тяжёлую страницу события монтируем, когда раскрытие почти закончено.
// Раньше страница монтировалась в середине жеста, и анимация дёргалась.
import { useCallback, useState, type ComponentProps } from 'react';
import { useFocusEffect } from 'expo-router';
import { Image } from 'expo-image';
import { StatusBar, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { Extrapolation, interpolate, useAnimatedReaction, useAnimatedStyle, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import type { EventItem } from '../data/types';
import { photo } from '../data/photos';
import { eventMedia } from '../ui/EventMedia';
import { colors, fonts } from '../theme';
import { EventCover, openCoverH } from '../ui/EventCover';
import { EventPage } from './EventPage';
import { EventFacts } from './ui/EventFacts';


/** Фото растёт из высоты фото карточки до высоты на странице, текст проявляется и поднимается — «шапка» как у настоящей страницы. */
function Hero({ e, now, progress, coverFrom }: { e: EventItem; now: Date; progress: SharedValue<number>; coverFrom: number }) {
  const { width } = useWindowDimensions();
  const COVER_H = openCoverH(width, useSafeAreaInsets().top);
  const cover = useAnimatedStyle(() => ({ height: interpolate(progress.get(), [0, 1], [coverFrom, COVER_H], Extrapolation.CLAMP) }));
  const text = useAnimatedStyle(() => ({
    opacity: interpolate(progress.get(), [0.3, 0.85], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(progress.get(), [0.3, 1], [18, 0], Extrapolation.CLAMP) }],
  }));
  const media = eventMedia(e);
  const first = media[0];
  const poster = first?.type === 'video' ? first.poster || e.cover : first?.url;
  return (
    <View style={styles.root}>
      <Animated.View style={[{ overflow: 'hidden' }, cover]}>
      <EventCover cover={null} category={e.category} color={e.coverColor} style={styles.cover} iconSize={240}>
        {media.length > 0 && <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.ink }]}>
          {!!poster && <Image source={photo(poster)} style={StyleSheet.absoluteFill} contentFit="contain" cachePolicy="memory-disk" recyclingKey={poster} />}
        </View>}
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
        <Animated.View style={[styles.text, media.length > 1 && { paddingRight: 76 }, text]}>
          <Text style={styles.h1}>{e.title}</Text>
        </Animated.View>
      </EventCover>
      </Animated.View>
      {/* Та же композиция фактов, что на странице; старые дата поверх фото и чипсы здесь не возвращаются. */}
      <Animated.View style={[styles.body, text]}>
        <EventFacts e={e} now={now} />
      </Animated.View>
    </View>
  );
}

export function LazyEventPage({ progress, coverFrom, ...props }: ComponentProps<typeof EventPage> & { progress: SharedValue<number>; coverFrom?: number }) {
  useFocusEffect(useCallback(() => {
    const status = StatusBar.pushStackEntry({ barStyle: 'light-content' });
    return () => StatusBar.popStackEntry(status);
  }, []));
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
  return ready ? <EventPage {...props} /> : <Hero e={props.e} now={props.now} progress={progress} coverFrom={coverFrom ?? 300} />;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  cover: { flex: 1, justifyContent: 'flex-end' },
  text: { padding: 18, paddingBottom: 38, gap: 10 },
  body: { marginTop: -24, paddingTop: 20, paddingHorizontal: 18, gap: 14, backgroundColor: colors.paper, borderTopLeftRadius: 26, borderTopRightRadius: 26 },
  h1: { fontFamily: fonts.display800, fontSize: 30, letterSpacing: -0.9, lineHeight: 33, color: '#FFFFFF' },
});
