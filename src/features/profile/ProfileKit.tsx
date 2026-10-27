// Общий формат профиля (26 октября, по мотивам лучших профилей с Pinterest: Hinge, BeReal, Partiful, bento-сетки).
// Сверху — большое фото на всю ширину, имя крупно прямо на фото, снизу фото уходит в цвет рамки.
// Ниже — плитки разного размера (bento): друзья, шаги, награды, город. Одинаково у меня и у друга.
import { Image } from 'expo-image';
import { X } from 'lucide-react-native';
import { useMemo, useState, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { photo as photoSrc } from '../../data/photos';
import { colors, fonts } from '../../theme';

export const HERO_H = 452;

/** Прокрутка экрана профиля для PhotoHero: позиция (на потоке анимаций) и жест прокрутки. */
export interface HeroScroll { y: SharedValue<number>; native: ReturnType<typeof Gesture.Native> }
export function useHeroScroll() {
  const y = useSharedValue(0);
  const native = useMemo(() => Gesture.Native(), []);
  const onScroll = useAnimatedScrollHandler((ev) => { y.set(ev.contentOffset.y); });
  return { scroll: { y, native } as HeroScroll, onScroll };
}

/** Большое фото профиля. Несколько фото — полоски сверху, нажатие справа/слева листает, удержание — на весь экран.
 *  Свайп вниз по фото (экран в самом верху) или нажатие на единственное фото — все фото на весь экран, листаются вбок. */
export function PhotoHero({ photos, initial, tint, accent, top, name, nameExtra, meta, corner, onPhoto, photoLabel, viewerAction, scroll }: {
  photos: string[]; initial: string; tint: string; accent: string; top: ReactNode; name: string; nameExtra?: ReactNode;
  meta?: ReactNode; corner?: ReactNode; onPhoto?: () => void; photoLabel?: string; viewerAction?: { label: string; onPress: () => void };
  /** Прокрутка экрана (useHeroScroll): жест «потянуть вниз» работает вместе с ней, а не теряется в ней (APK 30). */
  scroll?: HeroScroll;
}) {
  const [viewer, setViewer] = useState(false);
  const pull = useSharedValue(0);
  const openViewer = () => { if (photos.length) setViewer(true); else onPhoto?.(); };
  // Тянуть вниз имеет смысл только когда экран в самом верху — иначе это обычная прокрутка назад.
  // В воркер попадает только число-«общее значение»: объект scroll с жестом внутри не сериализуется и ронял приложение (APK 32).
  const scrollY = scroll?.y;
  const atTop = () => { 'worklet'; return !scrollY || scrollY.get() <= 2; };
  const pan = Gesture.Pan().activeOffsetY(14).failOffsetY(-10).failOffsetX([-22, 22])
    .onUpdate((ev) => { if (atTop()) pull.set(Math.max(0, ev.translationY)); })
    .onEnd((ev) => { if (atTop() && (ev.translationY > 60 || ev.velocityY > 700)) runOnJS(openViewer)(); pull.set(withTiming(0, { duration: 220 })); });
  const swipe = scroll ? pan.simultaneousWithExternalGesture(scroll.native) : pan;
  const pullSt = useAnimatedStyle(() => ({ transform: [{ scale: 1 + Math.min(pull.get(), 140) / 900 }] }));
  const insets = useSafeAreaInsets();
  const [i, setI] = useState(0);
  const h = HERO_H + insets.top;
  const cur = photos[i % Math.max(1, photos.length)];
  // Одно фото — нажатие открывает его на весь экран; несколько — края листают, удержание открывает.
  const tap = (right: boolean) => {
    if (photos.length > 1) setI((x) => (x + (right ? 1 : photos.length - 1)) % photos.length);
    else openViewer();
  };
  return (
    <GestureDetector gesture={swipe}>
    <View style={[styles.hero, { height: h }]}>
      <Animated.View style={[StyleSheet.absoluteFill, pullSt]}>
        {cur ? <Image source={photoSrc(cur)} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" transition={160} accessibilityIgnoresInvertColors />
          : <View style={[StyleSheet.absoluteFill, styles.noPhoto, { backgroundColor: tint }]}><Text style={styles.bigInitial}>{initial}</Text></View>}
      </Animated.View>
      <Svg style={StyleSheet.absoluteFill} width="100%" height={h} pointerEvents="none">
        <Defs>
          <LinearGradient id="shade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#0B0B0D" stopOpacity={0.38} />
            <Stop offset="0.2" stopColor="#0B0B0D" stopOpacity={0} />
            <Stop offset="0.5" stopColor="#0B0B0D" stopOpacity={0} />
            <Stop offset="1" stopColor="#0B0B0D" stopOpacity={0.86} />
          </LinearGradient>
          <LinearGradient id="tintG" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0.55" stopColor={accent} stopOpacity={0} />
            <Stop offset="1" stopColor={accent} stopOpacity={0.45} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height={h} fill="url(#shade)" />
        <Rect x="0" y="0" width="100%" height={h} fill="url(#tintG)" />
      </Svg>
      {/* Зоны нажатия: левая половина — назад, правая — вперёд (как в сторис). */}
      <View style={StyleSheet.absoluteFill}>
        <View style={{ flex: 1, flexDirection: 'row' }}>
          <Pressable style={{ flex: 1 }} onPress={() => tap(false)} onLongPress={openViewer} delayLongPress={300} accessibilityRole="button" accessibilityLabel={photos.length > 1 ? 'Предыдущее фото' : photoLabel ?? 'Фото'} />
          <Pressable style={{ flex: 1 }} onPress={() => tap(true)} onLongPress={openViewer} delayLongPress={300} accessibilityRole="button" accessibilityLabel={photos.length > 1 ? 'Следующее фото' : photoLabel ?? 'Фото'} />
        </View>
      </View>
      {photos.length > 1 && (
        <View style={[styles.bars, { top: insets.top + 6 }]} pointerEvents="none">
          {photos.map((_, k) => <View key={k} style={[styles.bar, k === i % photos.length && styles.barOn]} />)}
        </View>
      )}
      <View style={[styles.top, { top: insets.top + (photos.length > 1 ? 16 : 10) }]} pointerEvents="box-none">{top}</View>
      <View style={styles.bottom} pointerEvents="box-none">
        <View style={{ flex: 1, gap: 8 }} pointerEvents="box-none">
          <View style={styles.nameRow} pointerEvents="box-none">
            <Text style={styles.name} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.7}>{name}</Text>
            {nameExtra}
          </View>
          {meta && <View style={styles.meta} pointerEvents="box-none">{meta}</View>}
        </View>
        {corner}
      </View>
      {viewer && <PhotoViewer photos={photos} start={i % Math.max(1, photos.length)} onClose={() => setViewer(false)} action={viewerAction} />}
    </View>
    </GestureDetector>
  );
}

/** Фото на весь экран: листаются вбок, счётчик сверху, свайп вниз или крестик — закрыть. */
export function PhotoViewer({ photos, start, onClose, action, title }: { photos: string[]; start: number; onClose: () => void; action?: { label: string; onPress: () => void }; title?: string }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [page, setPage] = useState(start);
  const y = useSharedValue(0);
  const close = Gesture.Pan().activeOffsetY(14).failOffsetX([-14, 14])
    .onUpdate((ev) => { y.set(Math.max(0, ev.translationY)); })
    .onEnd((ev) => { if (ev.translationY > 120 || ev.velocityY > 900) runOnJS(onClose)(); else y.set(withTiming(0, { duration: 200 })); });
  const st = useAnimatedStyle(() => ({ transform: [{ translateY: y.get() }], opacity: 1 - Math.min(y.get(), 300) / 500 }));
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#000000' }}>
        <GestureDetector gesture={close}>
          <Animated.View style={[{ flex: 1 }, st]}>
            <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} contentOffset={{ x: start * width, y: 0 }}
              onMomentumScrollEnd={(ev) => setPage(Math.round(ev.nativeEvent.contentOffset.x / width))}>
              {photos.map((ph, k) => (
                <View key={`${ph}-${k}`} style={{ width, height, justifyContent: 'center' }}>
                  <Image source={photoSrc(ph)} style={{ width, height: height * 0.8 }} contentFit="contain" cachePolicy="memory-disk" accessibilityLabel={`Фото ${k + 1} из ${photos.length}`} />
                </View>
              ))}
            </ScrollView>
          </Animated.View>
        </GestureDetector>
        <View style={[styles.viewerTop, { top: insets.top + 10 }]} pointerEvents="box-none">
          <View style={{ flex: 1 }}>
            {!!title && <Text style={styles.viewerTitle} numberOfLines={1}>{title}</Text>}
            <Text style={styles.viewerCount}>{photos.length > 1 ? `${page + 1} из ${photos.length}` : ''}</Text>
          </View>
          <GlassBtn onPress={onClose} label="Закрыть"><X size={22} color="#FFFFFF" strokeWidth={2.2} /></GlassBtn>
        </View>
        {photos.length > 1 && (
          <View style={[styles.dots, { bottom: insets.bottom + (action ? 92 : 30) }]} pointerEvents="none">
            {photos.map((_, k) => <View key={k} style={[styles.dot, k === page && styles.dotOn]} />)}
          </View>
        )}
        {action && (
          <Pressable onPress={() => { onClose(); action.onPress(); }} style={[styles.viewerBtn, { bottom: insets.bottom + 24 }]} accessibilityRole="button">
            <Text style={styles.viewerBtnText}>{action.label}</Text>
          </Pressable>
        )}
      </GestureHandlerRootView>
    </Modal>
  );
}

/** Круглая «стеклянная» кнопка поверх фото. */
export function GlassBtn({ onPress, label, children, size = 44, badge }: { onPress: () => void; label: string; children: ReactNode; size?: number; badge?: ReactNode }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.glass, { width: size, height: size, borderRadius: size / 2 }, pressed && { opacity: 0.7 }]} accessibilityRole="button" accessibilityLabel={label} hitSlop={4}>
      {children}{badge}
    </Pressable>
  );
}

/** Плашка на фото: «в сети», «@ник», уровень, день рождения. */
export function HeroChip({ children, dot, icon }: { children: string; dot?: string; icon?: ReactNode }) {
  return (
    <View style={styles.chip}>
      {dot && <View style={[styles.chipDot, { backgroundColor: dot }]} />}
      {icon}
      <Text style={styles.chipText} numberOfLines={1}>{children}</Text>
    </View>
  );
}

/** Плитка сетки. */
export function Tile({ onPress, label, dark, accent, style, children }: { onPress?: () => void; label?: string; dark?: boolean; accent?: string; style?: StyleProp<ViewStyle>; children: ReactNode }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} accessibilityRole={onPress ? 'button' : undefined} accessibilityLabel={label}
      style={({ pressed }) => [styles.tile, dark && styles.tileDark, accent ? { backgroundColor: accent } : null, style, pressed && { transform: [{ scale: 0.97 }] }]}>
      {children}
    </Pressable>
  );
}

export function TileCap({ children, light }: { children: string; light?: boolean }) {
  return <Text style={[styles.cap, light && { color: 'rgba(255,255,255,0.72)' }]}>{children}</Text>;
}

export function Ring({ value, size, stroke, color, track }: { value: number; size: number; stroke: number; color: string; track: string }) {
  const r = (size - stroke) / 2;
  const len = 2 * Math.PI * r;
  return (
    <Svg width={size} height={size}>
      <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
      <Circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round"
        strokeDasharray={`${Math.max(1, len * Math.min(1, value))} ${len}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
    </Svg>
  );
}

/** «Активность» (26 окт.): одна спокойная карточка вместо цветных плиток — до трёх цифр в ряд.
 *  У каждой — значок в тонком кольце (кольцо — прогресс, если он есть), число и подпись. Нажатие — подробности. */
export interface StatItem { key: string; icon: ReactNode; value: string; label: string; progress?: number; color: string; onPress?: () => void }
export function StatsCard({ items }: { items: StatItem[] }) {
  if (!items.length) return null;
  // Одна цифра — строкой, а не огромной пустой карточкой.
  if (items.length === 1) {
    const it = items[0];
    return (
      <Pressable onPress={it.onPress} disabled={!it.onPress} style={({ pressed }) => [styles.stats, styles.statsOne, pressed && { opacity: 0.7 }]} accessibilityRole={it.onPress ? 'button' : 'text'} accessibilityLabel={`${it.value} ${it.label}`}>
        <View style={styles.statRing}>
          <Ring value={it.progress ?? 1} size={46} stroke={3.5} color={it.progress == null ? 'rgba(23,22,26,0.08)' : it.color} track="rgba(23,22,26,0.08)" />
          <View style={StyleSheet.absoluteFill}><View style={styles.statIcon}>{it.icon}</View></View>
        </View>
        <Text style={styles.statN}>{it.value}</Text>
        <Text style={[styles.statL, { flex: 1, fontSize: 14 }]} numberOfLines={1}>{it.label}</Text>
      </Pressable>
    );
  }
  return (
    <View style={styles.stats}>
      {items.slice(0, 3).map((it, k) => (
        <Pressable key={it.key} onPress={it.onPress} disabled={!it.onPress} style={({ pressed }) => [styles.stat, k > 0 && styles.statSep, pressed && { opacity: 0.6 }]}
          accessibilityRole={it.onPress ? 'button' : 'text'} accessibilityLabel={`${it.value} ${it.label}`}>
          <View style={styles.statRing}>
            <Ring value={it.progress ?? 1} size={46} stroke={3.5} color={it.progress == null ? 'rgba(23,22,26,0.08)' : it.color} track="rgba(23,22,26,0.08)" />
            <View style={StyleSheet.absoluteFill}><View style={styles.statIcon}>{it.icon}</View></View>
          </View>
          <Text style={styles.statN} numberOfLines={1} adjustsFontSizeToFit>{it.value}</Text>
          <Text style={styles.statL} numberOfLines={1}>{it.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export const kit = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10 },
  actions: { flexDirection: 'row', gap: 10, marginTop: -26, paddingHorizontal: 16 },
  primary: { flex: 1, flexDirection: 'row', gap: 8, minHeight: 54, borderRadius: 27, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center', boxShadow: '0 12px 24px -12px rgba(23,22,26,0.7)' },
  primaryText: { fontFamily: fonts.body700, fontSize: 16, color: '#FFFFFF' },
  secondary: { flex: 1, flexDirection: 'row', gap: 8, minHeight: 54, borderRadius: 27, backgroundColor: '#FBFAF6', alignItems: 'center', justifyContent: 'center', boxShadow: '0 12px 24px -14px rgba(23,22,26,0.5)' },
  secondaryText: { fontFamily: fonts.body700, fontSize: 16, color: colors.ink },
  square: { width: 54, minHeight: 54, borderRadius: 27, backgroundColor: '#FBFAF6', alignItems: 'center', justifyContent: 'center', boxShadow: '0 12px 24px -14px rgba(23,22,26,0.5)' },
  faces: { flexDirection: 'row', alignItems: 'center' },
});

const styles = StyleSheet.create({
  hero: { width: '100%', overflow: 'hidden', borderBottomLeftRadius: 36, borderBottomRightRadius: 36, backgroundColor: '#2A2930' },
  noPhoto: { alignItems: 'center', justifyContent: 'center' },
  bigInitial: { fontFamily: fonts.display800, fontSize: 180, color: 'rgba(23,22,26,0.18)' },
  bars: { position: 'absolute', left: 12, right: 12, flexDirection: 'row', gap: 4 },
  bar: { flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.35)' },
  barOn: { backgroundColor: '#FFFFFF' },
  top: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bottom: { position: 'absolute', left: 20, right: 16, bottom: 46, flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { flexShrink: 1, fontFamily: fonts.display800, fontSize: 44, lineHeight: 46, letterSpacing: -1.2, color: '#FFFFFF', textShadowColor: 'rgba(0,0,0,0.25)', textShadowRadius: 12 },
  meta: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  glass: { backgroundColor: 'rgba(20,19,24,0.38)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 30, paddingHorizontal: 12, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)' },
  chipDot: { width: 8, height: 8, borderRadius: 4 },
  chipText: { fontFamily: fonts.body600, fontSize: 13.5, color: '#FFFFFF' },
  viewerTop: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  viewerTitle: { fontFamily: fonts.body700, fontSize: 17, color: '#FFFFFF' },
  viewerCount: { fontFamily: fonts.body600, fontSize: 15, color: '#FFFFFF' },
  dots: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.35)' },
  dotOn: { backgroundColor: '#FFFFFF', width: 18 },
  viewerBtn: { position: 'absolute', left: 24, right: 24, height: 52, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.16)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center' },
  viewerBtnText: { fontFamily: fonts.body700, fontSize: 16, color: '#FFFFFF' },
  stats: { flexDirection: 'row', borderRadius: 26, backgroundColor: '#FBFAF6', paddingVertical: 14, boxShadow: '0 10px 22px -18px rgba(23,22,26,0.6)' },
  statsOne: { alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 10 },
  stat: { flex: 1, alignItems: 'center', gap: 4, paddingHorizontal: 6, minHeight: 44 },
  statSep: { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: colors.line2 },
  statRing: { width: 46, height: 46, marginBottom: 2 },
  statIcon: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  statN: { fontFamily: fonts.display800, fontSize: 21, letterSpacing: -0.5, color: colors.ink },
  statL: { fontFamily: fonts.body500, fontSize: 12.5, color: colors.muted },
  tile: { flex: 1, minHeight: 148, borderRadius: 28, padding: 16, backgroundColor: '#F4F0E7', justifyContent: 'space-between', overflow: 'hidden' },
  tileDark: { backgroundColor: '#1D1C22' },
  cap: { fontFamily: fonts.body600, fontSize: 13, color: colors.muted },
  num: { fontFamily: fonts.display800, letterSpacing: -1, color: colors.ink },
  sub: { fontFamily: fonts.body500, fontSize: 13.5, color: colors.muted },
});
