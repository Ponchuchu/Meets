// Точки на карте по макету Main: события, друзья, моя точка. Каждый пин центрирован на своей координате.
import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { MapAvatar } from './MapAvatar';
import type { EventItem, FriendSpot, Person } from '../data/types';
import { colors, fonts } from '../theme';
import { CAT_COLOR, CAT_ICON, catFg } from './icons';
import type { Phase } from './lifecycle';

export type PinKind = 'hot' | 'popular' | 'labeled' | 'plain';

function Ico({ d, size, color, w = 2 }: { d: string; size: number; color: string; w?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d={d} stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}

/** Мягко пульсирующее кольцо «идёт сейчас». */
function Pulse({ size, color }: { size: number; color: string }) {
  const t = useSharedValue(0);
  useEffect(() => {
    // Несколько волн и тишина: бесконечная анимация в пине держит карту в постоянной перерисовке (нагрев).
    t.value = withRepeat(withTiming(1, { duration: 1800, easing: Easing.out(Easing.quad) }), 4, false);
  }, [t]);
  const s = useAnimatedStyle(() => ({ opacity: 0.55 * (1 - t.value), transform: [{ scale: 0.6 + 1.1 * t.value }] }));
  return <Animated.View pointerEvents="none" style={[{ position: 'absolute', width: size, height: size, borderRadius: size / 2, borderWidth: 2, borderColor: color }, s]} />;
}

/** Бейдж возле точки: x, y — от координаты пина; align — к какой стороне бейджа привязан x. */
function Tag({ x, y, align = 'left', children }: { x: number; y: number; align?: 'left' | 'center' | 'right'; children: ReactNode }) {
  const W = 240;
  const left = align === 'left' ? x : align === 'center' ? x - W / 2 : x - W;
  const justify = align === 'left' ? 'flex-start' : align === 'center' ? 'center' : 'flex-end';
  return <View pointerEvents="none" style={{ position: 'absolute', left, top: y, width: W, flexDirection: 'row', justifyContent: justify }}>{children}</View>;
}

function formatK(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1).replace('.', ',').replace(',0', '')}K` : String(n);
}

export function EventPin({ e, kind, phase, label, showCompany, dark, onPress, scale = 1, count = 1, selected }: {
  e: EventItem; kind: PinKind; phase: Phase; label?: string; showCompany: boolean; dark: boolean; onPress: () => void;
  /** Масштаб от зума карты (src/map/zoom.ts). */
  scale?: number;
  /** Сколько событий в этой точке: больше одного — бейдж с числом, тап открывает список. */
  count?: number;
  /** Выбранная точка: крупнее, с оранжевой обводкой и подписью. Остальные — без текста, чтобы не налезали. */
  selected?: boolean;
}) {
  const soon = phase === 'soon';
  // Пульсирует только разовое событие «идёт сейчас»; выставки и маркеты открыты весь день — без пульса.
  const live = phase === 'live' && !e.isLong;
  const outline = dark ? colors.ink : colors.cardAlt;
  const size = kind === 'hot' ? 44 : kind === 'popular' ? 46 : kind === 'labeled' ? 40 : soon ? 38 : 34;
  const radius = kind === 'hot' ? 15 : kind === 'popular' ? 16 : kind === 'labeled' ? 14 : 11;
  const bg = CAT_COLOR[e.category];
  const fg = catFg(e.category);
  // Свои и дружеские события сегодня — с тёмной обводкой, остальные — со светлой.
  const ring = selected ? colors.accent : kind === 'hot' ? (dark ? colors.paper : colors.ink) : outline;
  const looking = e.lookingCount;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${e.title}${count > 1 ? `, ещё ${count - 1} в этом месте` : ''}${label ? `, ${label}` : ''}`} style={styles.hit} hitSlop={6}>
      <View style={[styles.anchor, { transform: [{ scale: selected ? Math.max(1.1, scale * 1.2) : scale }] }]}>
        {kind === 'popular' && <View pointerEvents="none" style={[styles.halo, { backgroundColor: dark ? 'rgba(243,240,232,0.08)' : 'rgba(23,22,26,0.06)' }]} />}
        {live && <Pulse size={size + 22} color={bg} />}
        <View style={{ width: size + 6, height: size + 6, borderRadius: radius + 3, backgroundColor: ring, alignItems: 'center', justifyContent: 'center', opacity: e.isLong && kind === 'plain' ? 0.9 : 1 }}>
          <View style={{ width: size, height: size, borderRadius: radius, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
            <Ico d={CAT_ICON[e.category]} size={kind === 'plain' ? (soon ? 18 : 17) : kind === 'popular' ? 22 : 20} color={fg} w={kind === 'hot' ? 2.2 : 2} />
          </View>
        </View>
        {count > 1 && (
          <View pointerEvents="none" style={[styles.stack, { left: size / 2 - 4, top: -size / 2 - 8, borderColor: outline }]}>
            <Text style={styles.stackText}>{count}</Text>
          </View>
        )}
        {kind === 'popular' && count === 1 && selected && (
          <Tag x={size / 2 + 12} y={-size / 2 - 9} align="right">
            <View style={styles.count}><Text style={styles.countText}>{formatK(e.goingCount)}</Text></View>
          </Tag>
        )}
        {label && (
          <Tag x={size / 2 + 11} y={-11}>
            <View style={[styles.label, { backgroundColor: dark ? colors.paper : colors.ink }]}>
              <Text style={[styles.labelText, { color: dark ? colors.ink : colors.paper }]}>{label}</Text>
            </View>
          </Tag>
        )}
        {showCompany && looking > 0 && !label && (
          <Tag x={kind === 'plain' ? 4 : -size / 2 - 12} y={kind === 'plain' ? -size / 2 - 12 : size / 2 - 10}>
            <View style={[styles.looking, { backgroundColor: colors.cardAlt, borderColor: colors.ink }]}>
              <Text style={styles.lookingText}>{kind === 'plain' ? looking : `${formatK(looking)} ИЩУТ`}</Text>
            </View>
          </Tag>
        )}
      </View>
    </Pressable>
  );
}

export function FriendPin({ person, spot, dim, onPress }: { person: Person; spot: FriendSpot; dim?: boolean; onPress: () => void }) {
  const moving = spot.state === 'moving';
  const paused = spot.state === 'paused';
  const rad = ((spot.heading ?? 90) * Math.PI) / 180;
  const label = `${person.name}, ${moving ? `${spot.place.toLowerCase()}, ${spot.speedKmh} километров в час` : spot.place.toLowerCase()}`;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={[styles.hit, { opacity: dim ? 0.35 : 1 }]}>
    <View style={styles.anchor}>
      {moving && person.mapTrail !== 'none' && [10, 19, 27].map((dx, i) => (
        <View key={dx} pointerEvents="none" style={{ position: 'absolute', width: 5 - i, height: 5 - i, borderRadius: 3, backgroundColor: colors.friend, opacity: [0.5, 0.3, 0.18][i], transform: [{ translateX: -Math.sin(rad) * (dx + 17) }, { translateY: Math.cos(rad) * (dx + 17) }] }} />
      ))}
      <View style={{ alignItems: 'center' }} pointerEvents="none">
        <MapAvatar person={person} ring={paused ? '#8C8577' : undefined} />
      </View>
      {moving && (
        <Tag x={-26} y={21}>
          <View style={styles.speed}>
            <Text style={styles.speedText}>{spot.speedKmh} КМ/Ч</Text>
            <Svg width={10} height={10} viewBox="0 0 24 24" style={{ transform: [{ rotate: `${(spot.heading ?? 90) - 90}deg` }] }}>
              <Path d="M5 12h14M13 6l6 6-6 6" stroke="#FFFFFF" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </Svg>
          </View>
        </Tag>
      )}
      {paused && spot.minutesAgo != null && (
        <Tag x={0} y={20} align="center">
          <View style={styles.ago}><Text style={styles.agoText}>{spot.minutesAgo} МИН</Text></View>
        </Tag>
      )}
    </View>
    </Pressable>
  );
}

/** Друзья (и ты) в одном месте: аватарки при появлении «съезжаются» друг к другу, вокруг расходятся тёплые волны,
 *  снизу — плашка «вместе · N». Волн несколько и потом тишина: бесконечная анимация на карте греет телефон. */
export function TogetherPin({ people, onPress }: { people: Person[]; onPress: (id: string) => void }) {
  const [index, setIndex] = useState(0);
  const meet = useSharedValue(0);
  const wave = useSharedValue(0);
  const key = people.map(p => p.id).join(',');
  useEffect(() => {
    meet.set(0);
    meet.set(withTiming(1, { duration: 650, easing: Easing.bezier(0.3, 1.4, 0.5, 1) }));
    wave.set(0);
    wave.set(withRepeat(withTiming(1, { duration: 1600, easing: Easing.out(Easing.quad) }), 4, false));
  }, [key, meet, wave]);
  const shown = people.slice(0, 3);
  const mid = (shown.length - 1) / 2;
  const w1 = useAnimatedStyle(() => ({ opacity: 0.5 * (1 - wave.get()), transform: [{ scale: 0.7 + 1.2 * wave.get() }] }));
  const w2 = useAnimatedStyle(() => { const t = (wave.get() + 0.5) % 1; return { opacity: 0.35 * (1 - t), transform: [{ scale: 0.7 + 1.2 * t }] }; });
  const tag = useAnimatedStyle(() => ({ opacity: meet.get(), transform: [{ translateY: 6 * (1 - meet.get()) }, { scale: 0.8 + 0.2 * meet.get() }] }));
  return (
    <Pressable onPress={() => { onPress(people[index % people.length].id); setIndex(index + 1); }} accessibilityRole="button" accessibilityLabel={`Вместе: ${people.map(p => p.name).join(', ')}`} style={styles.hitWide}>
      <View style={styles.anchor} pointerEvents="none">
        <Animated.View style={[styles.wave, w1]} />
        <Animated.View style={[styles.wave, w2]} />
        <View style={styles.together}>
          {shown.map((p, i) => <Face key={p.id} p={p} i={i} mid={mid} meet={meet} />)}
        </View>
        <Tag x={0} y={30} align="center">
          <Animated.View style={[styles.togetherTag, tag]}>
            <Ico d="M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z" size={11} color={colors.ink} w={2.4} />
            <Text style={styles.togetherText}>ВМЕСТЕ · {people.length}</Text>
          </Animated.View>
        </Tag>
      </View>
    </Pressable>
  );
}

function Face({ p, i, mid, meet }: { p: Person; i: number; mid: number; meet: import('react-native-reanimated').SharedValue<number> }) {
  const side = i - mid;
  const st = useAnimatedStyle(() => ({ transform: [{ translateX: side * 16 * (1 - meet.get()) }, { scale: 0.85 + 0.15 * meet.get() }] }));
  return <Animated.View style={[{ marginLeft: i ? -14 : 0, zIndex: 3 - i }, st]}><MapAvatar person={p} size={44} /></Animated.View>;
}

export function MePin({ onPress }: { onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel="Это ты. Настроить свой значок на карте" style={styles.hit} hitSlop={10}>
      <View style={styles.meHalo}>
        <View style={styles.me} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Область нажатия — настоящего размера: Android не передаёт касания за границы родителя, поэтому кнопка
  // вокруг нулевого якоря, а не внутри него (раньше из-за этого нажатие на друга на карте не срабатывало).
  hit: { width: 60, height: 60, alignItems: 'center', justifyContent: 'center' },
  hitWide: { width: 120, height: 64, alignItems: 'center', justifyContent: 'center' },
  wave: { position: 'absolute', width: 84, height: 84, borderRadius: 42, backgroundColor: 'rgba(240,82,31,0.16)', borderWidth: 2, borderColor: 'rgba(240,82,31,0.45)' },
  together: { flexDirection: 'row', alignItems: 'center', padding: 3, borderRadius: 30, backgroundColor: 'rgba(252,251,248,0.95)',
    boxShadow: '0 8px 18px -6px rgba(23,22,26,0.45), inset 0 1px 1px rgba(255,255,255,0.9)' },
  togetherTag: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 20, paddingHorizontal: 8, borderRadius: 10, backgroundColor: colors.accent },
  togetherText: { fontFamily: fonts.mono600, fontSize: 10, letterSpacing: 0.4, color: colors.ink },
  // Нулевой якорь: всё содержимое центрируется на координате.
  anchor: { width: 0, height: 0, alignItems: 'center', justifyContent: 'center', overflow: 'visible' },
  halo: { position: 'absolute', width: 96, height: 96, borderRadius: 48 },
  count: { height: 20, paddingHorizontal: 6, borderRadius: 10, backgroundColor: colors.cardAlt, justifyContent: 'center', shadowColor: colors.ink, shadowOpacity: 0.18, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 2 },
  countText: { fontFamily: fonts.mono600, fontSize: 10, color: colors.ink },
  label: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 7 },
  labelText: { fontFamily: fonts.mono600, fontSize: 11, letterSpacing: 0.2 },
  looking: { height: 22, paddingHorizontal: 5, borderRadius: 11, borderWidth: 2, justifyContent: 'center' },
  lookingText: { fontFamily: fonts.mono600, fontSize: 9.5, color: colors.ink },
  friendRingOuter: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', shadowColor: colors.ink, shadowOpacity: 0.25, shadowRadius: 3, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  friendPhoto: { width: 34, height: 34, borderRadius: 17, borderWidth: 3 },
  letter: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  letterText: { fontFamily: fonts.body700, fontSize: 12, color: colors.ink },
  speed: { height: 20, paddingHorizontal: 6, borderRadius: 10, backgroundColor: colors.friend, flexDirection: 'row', alignItems: 'center', gap: 3 },
  speedText: { fontFamily: fonts.mono600, fontSize: 9.5, color: '#FFFFFF' },
  stack: { position: 'absolute', minWidth: 22, height: 22, paddingHorizontal: 5, borderRadius: 11, borderWidth: 2, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  stackText: { fontFamily: fonts.mono600, fontSize: 10.5, color: colors.paper },
  ago: { paddingHorizontal: 5, paddingVertical: 2, borderRadius: 5, backgroundColor: colors.cardAlt },
  agoText: { fontFamily: fonts.mono600, fontSize: 9.5, color: colors.muted },
  meHalo: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(23,22,26,0.1)', alignItems: 'center', justifyContent: 'center' },
  me: { width: 16, height: 16, borderRadius: 8, backgroundColor: colors.ink, borderWidth: 3, borderColor: '#FFFFFF' },
});

/** Друг в фокусе (MapFocus): крупнее, мягкий круг и пульсирующее кольцо, над ним — облачко стикера. */
export function FocusPin({ person, ring, bubble, speed }: { person: Person; ring: string; bubble: { label: string; bg: string; fg: string } | null; speed?: string }) {
  const pop = useSharedValue(0);
  useEffect(() => {
    if (bubble) { pop.value = 0; pop.value = withTiming(1, { duration: 400, easing: Easing.out(Easing.back(2)) }); }
  }, [bubble, pop]);
  const popStyle = useAnimatedStyle(() => ({ opacity: Math.min(1, pop.value * 1.6), transform: [{ scale: 0.2 + 0.8 * pop.value }, { rotate: '-6deg' }] }));
  return (
    <View style={styles.anchor} pointerEvents="none">
      <View style={{ position: 'absolute', width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(36,71,184,0.14)', borderWidth: 1, borderColor: 'rgba(36,71,184,0.3)' }} />
      <Pulse size={80} color={colors.friend} />
      <MapAvatar person={person} size={60} ring={ring === colors.friend ? undefined : ring} />
      {speed && (
        <Tag x={-34} y={30}>
          <View style={[styles.speed, { height: 22, paddingHorizontal: 8 }]}>
            <Text style={[styles.speedText, { fontSize: 10 }]}>{speed}</Text>
            <Svg width={10} height={10} viewBox="0 0 24 24"><Path d="M5 12h14M13 6l6 6-6 6" stroke="#FFFFFF" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" fill="none" /></Svg>
          </View>
        </Tag>
      )}
      {bubble && (
        <Tag x={14} y={-60}>
          <Animated.View style={[{ height: 36, paddingHorizontal: 12, borderRadius: 12, borderWidth: 2, borderColor: '#FFFFFF', backgroundColor: bubble.bg, justifyContent: 'center', shadowColor: colors.ink, shadowOpacity: 0.25, shadowRadius: 7, shadowOffset: { width: 0, height: 6 }, elevation: 6 }, popStyle]}>
            <Text style={{ fontFamily: fonts.display800, fontSize: 14, color: bubble.fg }}>{bubble.label}</Text>
          </Animated.View>
        </Tag>
      )}
    </View>
  );
}
