// Плавное раскрытие карточки: пока она растёт из мини-карточки на весь экран, показываем лёгкую «шапку» (фото, время, название —
// как верх настоящей страницы), а саму тяжёлую страницу события монтируем, когда раскрытие почти закончено.
// Раньше страница монтировалась в середине жеста, и анимация дёргалась.
import { useState, type ComponentProps } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAnimatedReaction, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import type { EventItem } from '../data/types';
import { stampOf } from '../map/ui/EventSheet';
import { colors, fonts } from '../theme';
import { EventCover } from '../ui/EventCover';
import { EventPage } from './EventPage';

function Hero({ e, now }: { e: EventItem; now: Date }) {
  return (
    <View style={styles.root}>
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
        <View style={styles.text}>
          <View style={styles.stamp}><Text style={styles.stampText}>{stampOf(e, now)}</Text></View>
          <Text style={styles.h1}>{e.title}</Text>
        </View>
      </EventCover>
    </View>
  );
}

export function LazyEventPage({ progress, ...props }: ComponentProps<typeof EventPage> & { progress: SharedValue<number> }) {
  const [ready, setReady] = useState(false);
  useAnimatedReaction(
    () => progress.get() >= 0.97,
    (on, prev) => { if (on && on !== prev) scheduleOnRN(setReady, true); },
  );
  return ready ? <EventPage {...props} /> : <Hero e={props.e} now={props.now} />;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  cover: { height: 470, justifyContent: 'flex-end' },
  text: { padding: 18, gap: 10 },
  stamp: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, backgroundColor: 'rgba(23,22,26,0.55)' },
  stampText: { fontFamily: fonts.mono600, fontSize: 11.5, letterSpacing: 0.9, color: '#EEE9DE' },
  h1: { fontFamily: fonts.display800, fontSize: 30, letterSpacing: -0.9, lineHeight: 33, color: '#FFFFFF' },
});
