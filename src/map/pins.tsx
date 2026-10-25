// Точки на карте по макету Main: события, друзья, моя точка. Каждый пин центрирован на своей координате.
import { memo, useEffect, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { agoShort } from './ago';
import { Avatar } from '../ui/Avatar';
import { frameById } from '../profile/frames';
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

/**
 * Значок события (FIX5, система значков карты — docs/MAP-ICONS.md). Как точки интереса в Apple Maps:
 *  · издалека — маленькая точка цвета раздела;
 *  · обычный — круг цвета раздела с белым значком, белая кромка и мягкая тень; «горячие» и свои — крупнее;
 *  · вблизи — справа название (2 строки, белый ореол — читается на любом фоне);
 *  · выбранный — «капля» с хвостиком, крупный значок и тёмная плашка с названием и временем;
 *  · идёт друг — его мини-аватарка на краю значка; идёт сейчас — мягкая пульсация.
 */
export const EventPin = memo(function EventPin({ e, kind, phase, label, showCompany, dark, onPress, scale = 1, count = 1, selected, compact, name, friend, when }: {
  e: EventItem; kind: PinKind; phase: Phase; label?: string; showCompany: boolean; dark: boolean; onPress: () => void;
  /** Масштаб от зума карты (src/map/zoom.ts). */
  scale?: number;
  /** Сколько событий в этой точке: больше одного — бейдж с числом, тап открывает список. */
  count?: number;
  /** Выбранная точка: «капля» с подписью. */
  selected?: boolean;
  /** Издалека — точка вместо значка. */
  compact?: boolean;
  /** Вблизи — название справа. */
  name?: string;
  /** Друг, который идёт, — мини-аватарка на значке. */
  friend?: Person;
  /** Время для плашки выбранного: «сегодня 19:30». */
  when?: string;
}) {
  const soon = phase === 'soon';
  // Пульсирует только разовое событие «идёт сейчас»; выставки и маркеты открыты весь день — без пульса.
  const live = phase === 'live' && !e.isLong;
  const bg = CAT_COLOR[e.category];
  const fg = catFg(e.category);
  const looking = e.lookingCount;
  const a11y = `${e.title}${count > 1 ? `, ещё ${count - 1} в этом месте` : ''}${friend ? `, идёт ${friend.name}` : ''}`;
  if (compact && !selected) {
    return (
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={a11y} style={styles.hit} hitSlop={6}>
        <View style={styles.anchor}>
          <View style={[styles.dot, { backgroundColor: bg, borderColor: dark ? colors.paper : '#FFFFFF' }]} />
          {count > 1 && <View pointerEvents="none" style={styles.dotCount}><Text style={styles.dotCountText}>{count}</Text></View>}
        </View>
      </Pressable>
    );
  }
  if (selected) {
    return (
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={a11y} style={styles.hit} hitSlop={6}>
        <View style={[styles.anchor, { transform: [{ scale: Math.max(1, scale * 1.05) }] }]}>
          {live && <Pulse size={86} color={bg} />}
          {/* Капля: круг с хвостиком, кончик — точно на месте события (поднята на свою высоту). */}
          <View style={styles.balloon}>
            <Svg width={56} height={68} viewBox="0 0 56 68" style={StyleSheet.absoluteFill}>
              <Path d="M28 66C26 66 6 46 4.5 30A23.5 23.5 0 1 1 51.5 30C50 46 30 66 28 66Z" fill={bg} stroke="#FFFFFF" strokeWidth={3} />
            </Svg>
            <View style={styles.balloonGlyph}><Ico d={CAT_ICON[e.category]} size={26} color={fg} w={2.2} /></View>
          </View>
          {friend && <View style={[styles.friendBadge, { left: 10, top: -60 }]}><Avatar p={friend} size={22} /></View>}
          <Tag x={0} y={10} align="center">
            <View style={styles.selCard}>
              <Text style={styles.selTitle} numberOfLines={2}>{label ?? e.title}</Text>
              {!!when && <Text style={styles.selWhen}>{when}</Text>}
            </View>
          </Tag>
        </View>
      </Pressable>
    );
  }
  const size = kind === 'hot' || kind === 'popular' ? 38 : kind === 'labeled' ? 35 : soon ? 33 : 31;
  const icon = Math.round(size * 0.5);
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={a11y} style={styles.hit} hitSlop={6}>
      <View style={[styles.anchor, { transform: [{ scale }] }]}>
        {live && <Pulse size={size + 26} color={bg} />}
        <View style={[styles.glyph, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg, borderColor: kind === 'hot' ? colors.ink : '#FFFFFF', opacity: e.isLong && kind === 'plain' ? 0.92 : 1 }]}>
          <Ico d={CAT_ICON[e.category]} size={icon} color={fg} w={2.1} />
        </View>
        {friend ? (
          <View pointerEvents="none" style={[styles.friendBadge, { left: size / 2 - 9, top: -size / 2 - 7 }]}><Avatar p={friend} size={18} /></View>
        ) : count > 1 ? (
          <View pointerEvents="none" style={[styles.stack, { left: size / 2 - 8, top: -size / 2 - 7 }]}><Text style={styles.stackText}>{count}</Text></View>
        ) : null}
        {!!name && (
          <Tag x={size / 2 + 5} y={-15}>
            <Text style={[styles.name, dark && styles.nameDark]} numberOfLines={2}>{name}</Text>
          </Tag>
        )}
        {showCompany && looking > 0 && !name && (
          <Tag x={size / 2 - 10} y={size / 2 - 8}>
            <View style={[styles.looking, { backgroundColor: colors.cardAlt, borderColor: colors.ink }]}>
              <Text style={styles.lookingText}>{kind === 'plain' ? looking : `${formatK(looking)} ИЩУТ`}</Text>
            </View>
          </Tag>
        )}
      </View>
    </Pressable>
  );
}, (a, b) => a.e === b.e && a.kind === b.kind && a.phase === b.phase && a.label === b.label && a.showCompany === b.showCompany && a.dark === b.dark
  && a.scale === b.scale && a.count === b.count && a.selected === b.selected && a.compact === b.compact && a.name === b.name && a.friend?.id === b.friend?.id && a.when === b.when);
// Нажатие не сравниваем: обработчик новый на каждой отрисовке карты, а значок от этого не меняется (FIX5 — меньше работы при зуме).

/**
 * Друг на карте (FIX5, как в Zenly): крупное фото в белой рамке с хвостиком к точке, ободок — цвет его рамки,
 * мягкая тень на земле. Сверху — плашка: заряд и «5 мин» или скорость со стрелкой. Давно не обновлялся — бледнее, серый ободок.
 */
export function FriendBubble({ person, size = 46, ring, faded }: { person: Person; size?: number; ring?: string; faded?: boolean }) {
  const color = ring ?? frameById(person.mapFrame).color;
  const total = size + 8;
  return (
    <View style={{ alignItems: 'center', marginTop: -(total + 8) }} pointerEvents="none">
      <View style={[styles.bubble, { width: total, height: total, borderRadius: total / 2, borderColor: color }]}>
        <View style={{ opacity: faded ? 0.55 : 1 }}><Avatar p={person} size={size} /></View>
      </View>
      <Svg width={18} height={11} viewBox="0 0 18 11" style={{ marginTop: -3 }}>
        <Path d="M1 0h16L9.9 9.6a1.2 1.2 0 0 1-1.8 0z" fill="#FFFFFF" />
      </Svg>
      <View style={styles.bubbleGround} />
    </View>
  );
}

export function FriendPin({ person, spot, dim, onPress }: { person: Person; spot: FriendSpot; dim?: boolean; onPress: () => void }) {
  const moving = spot.state === 'moving';
  const paused = spot.state === 'paused';
  const label = `${person.name}, ${moving ? `${spot.place.toLowerCase()}, ${spot.speedKmh} километров в час` : spot.place.toLowerCase()}`;
  const ago = spot.minutesAgo != null && spot.minutesAgo >= 2 ? agoShort(spot.minutesAgo) : null;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={[styles.hitTall, { opacity: dim ? 0.35 : 1 }]}>
      <View style={styles.anchor}>
        <FriendBubble person={person} ring={paused ? '#A8A195' : undefined} faded={paused} />
        {/* Плашка состояния над головой: заряд · скорость или «давно». */}
        {(spot.battery != null || moving || ago) && (
          <Tag x={4} y={-78}>
            <View style={styles.status}>
              {spot.battery != null && !paused && <BatteryTag level={spot.battery} charging={!!spot.charging} bare />}
              {moving ? (
                <View style={styles.statusPart}>
                  <Text style={[styles.statusText, { color: colors.friend }]}>{spot.speedKmh} км/ч</Text>
                  <Svg width={10} height={10} viewBox="0 0 24 24" style={{ transform: [{ rotate: `${(spot.heading ?? 90) - 90}deg` }] }}>
                    <Path d="M5 12h14M13 6l6 6-6 6" stroke={colors.friend} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" fill="none" />
                  </Svg>
                </View>
              ) : ago ? <Text style={[styles.statusText, paused && { color: colors.muted2 }]}>{ago}</Text> : null}
            </View>
          </Tag>
        )}
      </View>
    </Pressable>
  );
}

/** Заряд друга (FIX5, как в Zenly): маленькая батарейка с процентом; заряжается — зелёная с молнией, мало — красная. */
export function BatteryTag({ level, charging, bare }: { level: number; charging: boolean; bare?: boolean }) {
  const low = level <= 20 && !charging;
  const fill = charging ? '#2FA35A' : low ? '#E5383B' : colors.ink;
  return (
    <View style={[styles.batt, bare && styles.battBare]} accessibilityLabel={`Заряд ${level}%${charging ? ', заряжается' : ''}`}>
      <View style={styles.battBody}>
        <View style={{ width: `${Math.max(8, Math.min(100, level))}%`, height: '100%', borderRadius: 1.5, backgroundColor: fill }} />
        {charging && <View style={styles.bolt}><Ico d="M13 2L4 14h7l-1 8 9-12h-7z" size={9} color="#FFFFFF" w={2.6} /></View>}
      </View>
      <View style={styles.battCap} />
      <Text style={[styles.battText, low && { color: '#C2272A' }, charging && { color: '#1F7A40' }]}>{level}%</Text>
    </View>
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
  return <Animated.View style={[{ marginLeft: i ? -14 : 0, zIndex: 3 - i }, st]}><Avatar p={p} size={40} style={{ borderWidth: 2.5, borderColor: '#FFFFFF' }} /></Animated.View>;
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
  meet: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingLeft: 4, paddingRight: 8, borderRadius: 18, backgroundColor: colors.ink, borderWidth: 2, borderColor: '#FFFFFF', marginTop: -20,
    boxShadow: '0 8px 16px -6px rgba(23,22,26,0.55)' },
  meetTime: { height: 26, paddingHorizontal: 8, borderRadius: 13, backgroundColor: colors.accent, justifyContent: 'center' },
  meetTimeText: { fontFamily: fonts.mono600, fontSize: 11.5, color: colors.ink },
  meetTail: { width: 0, height: 0, marginTop: -1, borderLeftWidth: 6, borderRightWidth: 6, borderTopWidth: 8, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: colors.ink },
  city: { width: 56, height: 56, borderRadius: 19, borderWidth: 3, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    boxShadow: 'inset 0 -3px 0 rgba(0,0,0,0.2), 0 10px 20px -6px rgba(23,22,26,0.5)', transform: [{ rotate: '-6deg' }] },
  cityShine: { position: 'absolute', top: 0, left: 0, right: 0, height: '46%', backgroundColor: 'rgba(255,255,255,0.24)' },
  cityTag: { alignItems: 'center', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 10, backgroundColor: 'rgba(252,251,248,0.96)', boxShadow: '0 4px 10px -4px rgba(23,22,26,0.4)' },
  cityTitle: { fontFamily: fonts.body700, fontSize: 11.5, color: colors.ink, maxWidth: 150 },
  cityWhen: { fontFamily: fonts.mono600, fontSize: 9.5, letterSpacing: 0.3, color: colors.accentText },
  wave: { position: 'absolute', width: 84, height: 84, borderRadius: 42, backgroundColor: 'rgba(240,82,31,0.16)', borderWidth: 2, borderColor: 'rgba(240,82,31,0.45)' },
  together: { flexDirection: 'row', alignItems: 'center', padding: 3, borderRadius: 30, backgroundColor: 'rgba(252,251,248,0.95)',
    boxShadow: '0 8px 18px -6px rgba(23,22,26,0.45), inset 0 1px 1px rgba(255,255,255,0.9)' },
  togetherTag: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 20, paddingHorizontal: 8, borderRadius: 10, backgroundColor: colors.accent },
  togetherText: { fontFamily: fonts.mono600, fontSize: 10, letterSpacing: 0.4, color: colors.ink },
  // Нулевой якорь: всё содержимое центрируется на координате.
  anchor: { width: 0, height: 0, alignItems: 'center', justifyContent: 'center', overflow: 'visible' },
  dot: { width: 13, height: 13, borderRadius: 7, borderWidth: 2, boxShadow: '0 1px 3px rgba(23,22,26,0.45)' },
  dotCount: { position: 'absolute', left: 3, top: -15, minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 9, borderWidth: 1.5, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  dotCountText: { fontFamily: fonts.mono600, fontSize: 9.5, color: colors.paper },
  glyph: { alignItems: 'center', justifyContent: 'center', borderWidth: 2.5, boxShadow: '0 3px 8px -1px rgba(23,22,26,0.42)' },
  balloon: { width: 56, height: 68, marginTop: -66, alignItems: 'center', filter: 'drop-shadow(0 6px 6px rgba(23,22,26,0.35))' },
  balloonGlyph: { position: 'absolute', top: 15, left: 0, right: 0, alignItems: 'center' },
  selCard: { maxWidth: 200, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, backgroundColor: colors.ink, alignItems: 'center', boxShadow: '0 6px 14px -6px rgba(23,22,26,0.6)' },
  selTitle: { fontFamily: fonts.body700, fontSize: 12.5, lineHeight: 15, color: colors.paper, textAlign: 'center' },
  selWhen: { fontFamily: fonts.mono600, fontSize: 10, color: colors.accent, marginTop: 1 },
  friendBadge: { position: 'absolute', borderRadius: 12, borderWidth: 2, borderColor: '#FFFFFF', boxShadow: '0 2px 4px rgba(23,22,26,0.35)' },
  name: { maxWidth: 118, fontFamily: fonts.body700, fontSize: 11.5, lineHeight: 14, color: colors.ink, textShadowColor: 'rgba(252,251,248,0.95)', textShadowRadius: 3, textShadowOffset: { width: 0, height: 0 } },
  nameDark: { color: colors.paper, textShadowColor: 'rgba(23,22,26,0.9)' },
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
  battBare: { backgroundColor: 'transparent', boxShadow: 'none', paddingLeft: 0, paddingRight: 0, height: 16 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 22, paddingHorizontal: 8, borderRadius: 11, backgroundColor: 'rgba(255,255,255,0.97)', boxShadow: '0 2px 6px rgba(23,22,26,0.22)' },
  statusPart: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  statusText: { fontFamily: fonts.body700, fontSize: 10.5, color: colors.ink },
  bubble: { backgroundColor: '#FFFFFF', borderWidth: 3, alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 12px -4px rgba(23,22,26,0.45)' },
  bubbleGround: { width: 10, height: 4, borderRadius: 3, marginTop: -1, backgroundColor: 'rgba(23,22,26,0.14)' },
  hitTall: { width: 72, height: 72, alignItems: 'center', justifyContent: 'center' },
  batt: { flexDirection: 'row', alignItems: 'center', height: 18, paddingLeft: 5, paddingRight: 6, borderRadius: 9, backgroundColor: 'rgba(255,255,255,0.96)', boxShadow: '0 2px 6px rgba(23,22,26,0.22)' },
  battBody: { width: 17, height: 9, padding: 1, borderRadius: 3, borderWidth: 1.3, borderColor: colors.ink, justifyContent: 'center' },
  battCap: { width: 1.6, height: 4, marginLeft: 0.5, borderTopRightRadius: 1, borderBottomRightRadius: 1, backgroundColor: colors.ink },
  bolt: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  battText: { marginLeft: 4, fontFamily: fonts.body700, fontSize: 10, color: colors.ink },
  ago: { paddingHorizontal: 7, paddingVertical: 2.5, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.94)', boxShadow: '0 2px 6px rgba(23,22,26,0.18)' },
  agoText: { fontFamily: fonts.body700, fontSize: 10.5, color: colors.muted2 },
  meHalo: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(23,22,26,0.1)', alignItems: 'center', justifyContent: 'center' },
  me: { width: 16, height: 16, borderRadius: 8, backgroundColor: colors.ink, borderWidth: 3, borderColor: '#FFFFFF' },
});

/** Друг в фокусе (MapFocus): крупнее, мягкий круг и пульсирующее кольцо, над ним — облачко стикера. */
/** Где центр лица друга в фокусе относительно точки (вверх): хвостик 8 + половина круга 33. */
export const FOCUS_FACE = 41;

export function FocusPin({ person, ring, bubble, speed }: { person: Person; ring: string; bubble: { label: string; bg: string; fg: string } | null; speed?: string }) {
  const pop = useSharedValue(0);
  useEffect(() => {
    if (bubble) { pop.value = 0; pop.value = withTiming(1, { duration: 400, easing: Easing.out(Easing.back(2)) }); }
  }, [bubble, pop]);
  const popStyle = useAnimatedStyle(() => ({ opacity: Math.min(1, pop.value * 1.6), transform: [{ scale: 0.2 + 0.8 * pop.value }, { rotate: '-6deg' }] }));
  return (
    <View style={styles.anchor} pointerEvents="none">
      {/* Ореол — вокруг лица (оно стоит над точкой на своём хвостике). */}
      <View style={{ position: 'absolute', top: -FOCUS_FACE - 40, left: -40, width: 80, height: 80, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ position: 'absolute', width: 92, height: 92, borderRadius: 46, backgroundColor: 'rgba(36,71,184,0.12)' }} />
        <Pulse size={92} color={colors.friend} />
      </View>
      <FriendBubble person={person} size={58} ring={ring === colors.friend ? undefined : ring} />
      {speed && (
        <Tag x={-34} y={8}>
          <View style={[styles.speed, { height: 22, paddingHorizontal: 8 }]}>
            <Text style={[styles.speedText, { fontSize: 10 }]}>{speed}</Text>
            <Svg width={10} height={10} viewBox="0 0 24 24"><Path d="M5 12h14M13 6l6 6-6 6" stroke="#FFFFFF" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" fill="none" /></Svg>
          </View>
        </Tag>
      )}
      {bubble && (
        <Tag x={18} y={-FOCUS_FACE - 70}>
          <Animated.View style={[{ height: 36, paddingHorizontal: 12, borderRadius: 12, borderWidth: 2, borderColor: '#FFFFFF', backgroundColor: bubble.bg, justifyContent: 'center', shadowColor: colors.ink, shadowOpacity: 0.25, shadowRadius: 7, shadowOffset: { width: 0, height: 6 }, elevation: 6 }, popStyle]}>
            <Text style={{ fontFamily: fonts.display800, fontSize: 14, color: bubble.fg }}>{bubble.label}</Text>
          </Animated.View>
        </Tag>
      )}
    </View>
  );
}

/** Большое событие города («Год в Алматы»): крупный значок со своей иконкой, глянцем и мягким ореолом,
 *  под ним — название и «через 4 дня». Ореол пульсирует несколько раз при появлении и затихает. */
export function CityPin({ title, when, color, Icon, onPress }: { title: string; when: string; color: string; Icon: import('lucide-react-native').LucideIcon; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${title}, ${when}`} style={styles.hitWide}>
      <View style={styles.anchor} pointerEvents="none">
        <Pulse size={78} color={color} />
        <View style={[styles.city, { backgroundColor: color }]}>
          <View style={styles.cityShine} />
          <Icon size={26} color="#FFFFFF" strokeWidth={2.1} />
        </View>
        <Tag x={0} y={33} align="center">
          <View style={styles.cityTag}>
            <Text style={styles.cityTitle} numberOfLines={1}>{title}</Text>
            <Text style={styles.cityWhen} numberOfLines={1}>{when}</Text>
          </View>
        </Tag>
      </View>
    </Pressable>
  );
}

/** Своя встреча на карте: тёмная капля со временем и лицами тех, кого позвали; выбранная — крупнее с названием. */
export function MeetupPin({ e, people, selected, onPress }: { e: EventItem; people: Person[]; selected: boolean; onPress: () => void }) {
  const faces = (e.meetup?.invited ?? []).map((id) => people.find((p) => p.id === id)).filter(Boolean).slice(0, 3) as Person[];
  const at = new Date(Date.parse(e.startsAt) + 5 * 3600e3);
  const time = `${String(at.getUTCHours()).padStart(2, '0')}:${String(at.getUTCMinutes()).padStart(2, '0')}`;
  return (
    <Pressable onPress={onPress} style={styles.hitWide} accessibilityRole="button" accessibilityLabel={`Встреча: ${e.title}, ${time}`}>
      <View style={styles.anchor} pointerEvents="none">
        <View style={[styles.meet, selected && { transform: [{ scale: 1.12 }] }]}>
          <View style={styles.meetTime}><Text style={styles.meetTimeText}>{time}</Text></View>
          {faces.length > 0 ? (
            <View style={{ flexDirection: 'row' }}>{faces.map((p, i) => <View key={p.id} style={{ marginLeft: i ? -8 : 0 }}><Avatar p={p} size={24} style={{ borderWidth: 1.5, borderColor: '#FFFFFF' }} /></View>)}</View>
          ) : <Ico d="M16 20v-1.5a3.5 3.5 0 00-3.5-3.5h-1A3.5 3.5 0 008 18.5V20M12 12a3 3 0 100-6 3 3 0 000 6z" size={18} color="#FFFFFF" />}
        </View>
        <View style={styles.meetTail} />
        {selected && <Tag x={0} y={22} align="center"><View style={styles.cityTag}><Text style={styles.cityTitle} numberOfLines={1}>{e.title}</Text></View></Tag>}
      </View>
    </Pressable>
  );
}
