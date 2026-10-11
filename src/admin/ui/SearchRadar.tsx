// Анимация поиска: из лупы расходятся круги, внизу бежит полоска; под ней — что сейчас читается и сколько идёт.
// «Уменьшить движение» — круги стоят, полоска без бега.
import { Search } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withTiming } from 'react-native-reanimated';
import { colors, fonts } from '../../theme';
import { elapsed } from '../rules';
import { Banner } from './kit';

/** Запуск на GitHub живёт не дольше 20 минут; дольше — скорее всего завис. */
const STUCK_MS = 25 * 60_000;

function Ring({ delay, reduce }: { delay: number; reduce: boolean }) {
  const t = useSharedValue(0);
  useEffect(() => {
    if (reduce) { t.set(0.5); return; }
    t.set(withDelay(delay, withRepeat(withTiming(1, { duration: 2400, easing: Easing.out(Easing.quad) }), -1, false)));
  }, [reduce, delay, t]);
  const st = useAnimatedStyle(() => ({ opacity: 0.5 * (1 - t.get()), transform: [{ scale: 0.5 + t.get() * 1.5 }] }));
  return <Animated.View pointerEvents="none" style={[styles.ring, st]} />;
}

function Bar({ reduce }: { reduce: boolean }) {
  const t = useSharedValue(0);
  useEffect(() => {
    if (reduce) { t.set(0.5); return; }
    t.set(withRepeat(withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.cubic) }), -1, false));
  }, [reduce, t]);
  const st = useAnimatedStyle(() => ({ left: `${t.get() * 100 - 30}%`, width: '30%' }));
  return <View style={styles.track}><Animated.View style={[styles.fill, st]} /></View>;
}

export function SearchRadar({ since, sources, line }: { since: string; sources: string[]; line?: string }) {
  const reduce = useReducedMotion();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);
  return (
    <View style={styles.box} accessibilityRole="progressbar" accessibilityLabel="Идёт поиск событий" accessibilityLiveRegion="polite">
      <View style={styles.stage}>
        <Ring delay={0} reduce={reduce} /><Ring delay={800} reduce={reduce} /><Ring delay={1600} reduce={reduce} />
        <View style={styles.lens}><Search size={22} color={colors.paper} strokeWidth={2} /></View>
      </View>
      <Bar reduce={reduce} />
      <Text style={styles.now}>Читаю: {sources.join(' · ')}</Text>
      <Text style={styles.sub}>{elapsed(since, now)}{line ? ` · ${line}` : ''}</Text>
      {now - Date.parse(since) > STUCK_MS && <View style={{ alignSelf: 'stretch' }}><Banner tone="warn" title="Поиск идёт дольше обычного" hint="Нажми «Стоп» и запусти снова. Если повторится — смотри журнал." /></View>}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', gap: 10, paddingVertical: 8 },
  stage: { width: 120, height: 120, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', width: 120, height: 120, borderRadius: 60, borderWidth: 2, borderColor: colors.accent, backgroundColor: 'rgba(240,82,31,0.08)' },
  lens: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  track: { alignSelf: 'stretch', height: 4, borderRadius: 2, backgroundColor: colors.sand, overflow: 'hidden' },
  fill: { position: 'absolute', top: 0, bottom: 0, borderRadius: 2, backgroundColor: colors.accent },
  now: { fontFamily: fonts.body700, fontSize: 14, color: colors.ink, textAlign: 'center' },
  sub: { fontFamily: fonts.mono500, fontSize: 11.5, color: colors.muted, textAlign: 'center' },
});
