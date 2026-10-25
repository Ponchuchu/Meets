// Витрина профиля (26 октября, по мотивам Steam): уровень с полосой опыта, три главные награды на подставках
// и счётчики «км пешком · событий · % города», которые набегают при открытии. Одинаковая у меня и у друга.
import { router } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { colors, fonts } from '../../theme';
import { BadgeMedal } from '../../ui/BadgeMedal';

export interface ShowcaseBadge { id: string; name: string; got: boolean; progress: number; goal: number }

export interface ShowcaseStat { n?: number; text?: string; label: string; decimals?: number }

export function Showcase({ level, points = 0, nextAt = 1, badges, total, stats, onLevel, onAwards }: {
  level?: number; points?: number; nextAt?: number; badges: ShowcaseBadge[]; total: number; stats: ShowcaseStat[];
  onLevel?: () => void; onAwards?: () => void;
}) {
  const got = badges.filter((b) => b.got);
  const featured = [...got, ...badges.filter((b) => !b.got)].slice(0, 3);
  const xp = useSharedValue(0);
  useEffect(() => { xp.set(withDelay(200, withTiming(Math.min(1, points / Math.max(1, nextAt)), { duration: 900, easing: Easing.out(Easing.cubic) }))); }, [xp, points, nextAt]);
  const bar = useAnimatedStyle(() => ({ width: `${xp.get() * 100}%` }));
  return (
    <View style={styles.card}>
      {level != null && <Pressable onPress={onLevel} disabled={!onLevel} style={styles.levelRow} accessibilityRole="button" accessibilityLabel={`Уровень ${level}, ${points} из ${nextAt} очков`}>
        <View style={styles.hex}><Text style={styles.hexN}>{level}</Text></View>
        <View style={{ flex: 1, gap: 6 }}>
          <View style={styles.rowBetween}>
            <Text style={styles.levelTitle}>Уровень {level}</Text>
            <Text style={styles.levelXp}>{points.toLocaleString('ru-RU')} / {nextAt.toLocaleString('ru-RU')}</Text>
          </View>
          <View style={styles.track}><Animated.View style={[styles.fill, bar]} /></View>
        </View>
      </Pressable>}

      <Pressable onPress={onAwards} disabled={!onAwards} style={styles.rowBetween} accessibilityRole="button">
        <Text style={styles.cap}>{featured.length ? 'ВИТРИНА НАГРАД' : 'НАГРАД ПОКА НЕТ'}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
          <Text style={styles.capVal}>{got.length} из {total}</Text>
          {onAwards && <ChevronRight size={16} color="#BDB8AD" strokeWidth={2} />}
        </View>
      </Pressable>
      {featured.length > 0 && <View style={styles.shelf}>
        {featured.map((b, i) => (
          <Pressable key={b.id} onPress={onAwards} disabled={!onAwards} style={styles.slot} accessibilityRole="button" accessibilityLabel={`${b.name}${b.got ? '' : ', ещё не получена'}`}>
            <Floating delay={i * 300} still={!b.got}><BadgeMedal id={b.id} got={b.got} progress={b.progress / Math.max(1, b.goal)} size={74} /></Floating>
            <View style={styles.stand} />
            <Text style={styles.badgeName} numberOfLines={2}>{b.name}</Text>
          </Pressable>
        ))}
      </View>}

      {stats.length > 0 && <View style={styles.stats}>
        {stats.map((x, i) => (
          <View key={x.label} style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
            {i > 0 && <View style={styles.sep} />}
            {x.text != null ? <View style={styles.stat}><Text style={styles.statN}>{x.text}</Text><Text style={styles.statL}>{x.label}</Text></View> : <Stat n={x.n ?? 0} label={x.label} decimals={x.decimals} />}
          </View>
        ))}
      </View>}
    </View>
  );
}

/** Награда на полке мягко парит и поблёскивает (неполученная — стоит). */
function Floating({ children, delay, still }: { children: React.ReactNode; delay: number; still: boolean }) {
  const t = useSharedValue(0);
  useEffect(() => { if (!still) t.set(withDelay(delay, withRepeat(withSequence(withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.sin) }), withTiming(0, { duration: 1600, easing: Easing.inOut(Easing.sin) })), -1, false))); }, [t, delay, still]);
  const st = useAnimatedStyle(() => ({ transform: [{ translateY: -t.get() * 5 }, { rotate: `${(t.get() - 0.5) * 6}deg` }] }));
  return <Animated.View style={st}>{children}</Animated.View>;
}

/** Число набегает от нуля при открытии. */
function Stat({ n, label, decimals = 0 }: { n: number; label: string; decimals?: number }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf = 0; const start = Date.now();
    const tick = () => { const k = Math.min(1, (Date.now() - start) / 900); setV(n * (1 - (1 - k) ** 3)); if (k < 1) raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [n]);
  return <View style={styles.stat}><Text style={styles.statN}>{v.toFixed(decimals).replace('.', ',')}</Text><Text style={styles.statL}>{label}</Text></View>;
}

export const goLevel = () => router.push('/profile/level');
export const goAwards = () => router.push('/profile/awards');

const styles = StyleSheet.create({
  card: { borderRadius: 26, backgroundColor: '#1D1C22', padding: 16, gap: 14, boxShadow: '0 16px 30px -18px rgba(23,22,26,0.8)' },
  levelRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  hex: { width: 48, height: 48, borderRadius: 14, transform: [{ rotate: '45deg' }], backgroundColor: '#F0521F', alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#FFB48A' },
  hexN: { transform: [{ rotate: '-45deg' }], fontFamily: fonts.display800, fontSize: 19, color: '#FFFFFF' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  levelTitle: { fontFamily: fonts.display800, fontSize: 18, color: '#F4F1EA' },
  levelXp: { fontFamily: fonts.mono600, fontSize: 11.5, color: '#BDB8AD' },
  track: { height: 8, borderRadius: 4, backgroundColor: '#35343B', overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4, backgroundColor: '#F7A47E' },
  cap: { fontFamily: fonts.mono600, fontSize: 10.5, letterSpacing: 0.9, color: '#BDB8AD' },
  capVal: { fontFamily: fonts.mono600, fontSize: 11.5, color: '#F4F1EA' },
  shelf: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  slot: { flex: 1, alignItems: 'center', gap: 4 },
  stand: { width: 44, height: 6, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.45)', marginTop: 1 },
  badgeName: { fontFamily: fonts.body600, fontSize: 12, lineHeight: 15, color: '#E7E2D8', textAlign: 'center' },
  stats: { flexDirection: 'row', alignItems: 'center', paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  statN: { fontFamily: fonts.display800, fontSize: 20, color: '#FFFFFF' },
  statL: { fontFamily: fonts.body500, fontSize: 11.5, color: '#BDB8AD' },
  sep: { width: 1, height: 28, backgroundColor: 'rgba(255,255,255,0.1)' },
});
