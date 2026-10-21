// Анимация поиска: из лупы расходятся круги, внизу бежит полоска; под ней — что сейчас читается и сколько идёт.
// «Уменьшить движение» — круги стоят, полоска без бега. Монтируется только пока поиск идёт; секундомер тикает в своём маленьком Clock.
import { Search } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withTiming } from 'react-native-reanimated';
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
    return () => cancelAnimation(t);
  }, [reduce, delay, t]);
  const st = useAnimatedStyle(() => ({ opacity: 0.5 * (1 - t.get()), transform: [{ scale: 0.5 + t.get() * 1.5 }] }));
  return <Animated.View pointerEvents="none" style={[styles.ring, st]} />;
}

function Bar({ reduce }: { reduce: boolean }) {
  const t = useSharedValue(0);
  useEffect(() => {
    if (reduce) { t.set(0.5); return; }
    t.set(withRepeat(withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.cubic) }), -1, false));
    return () => cancelAnimation(t);
  }, [reduce, t]);
  const [w, setW] = useState(0);
  // Двигаем только transform (без пересчёта раскладки на каждом кадре).
  const st = useAnimatedStyle(() => ({ transform: [{ translateX: (t.get() * 1.3 - 0.3) * w }] }));
  return <View style={styles.track} onLayout={(e) => setW(e.nativeEvent.layout.width)}><Animated.View style={[styles.fill, { width: '30%' }, st]} /></View>;
}

/** Секундомер и «идёт дольше обычного»: тикает только эта маленькая часть, а не вся панель. */
function Clock({ since, line }: { since: string; line?: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);
  return (
    <>
      <Text style={styles.sub}>{elapsed(since, now)}{line ? ` · ${line}` : ''}</Text>
      {now - Date.parse(since) > STUCK_MS && <View style={{ alignSelf: 'stretch' }}><Banner tone="warn" title="Поиск идёт дольше обычного" hint="Нажми «Стоп» и запусти снова. Если повторится — смотри журнал." /></View>}
    </>
  );
}

export function SearchRadar({ since, sources, line, found = 0, queued = 0, logs = [] }: { since: string; sources: string[]; line?: string; found?: number; queued?: number; logs?: { text: string; level: string }[] }) {
  const reduce = useReducedMotion();
  return (
    <View style={styles.box} accessibilityRole="progressbar" accessibilityLabel="Идёт поиск событий" accessibilityLiveRegion="polite">
      <View style={styles.stage}>
        <Ring delay={0} reduce={reduce} /><Ring delay={800} reduce={reduce} /><Ring delay={1600} reduce={reduce} />
        <View style={styles.lens}><Search size={22} color={colors.paper} strokeWidth={2} /></View>
      </View>
      <Bar reduce={reduce} />
      <View style={{ flexDirection: 'row', gap: 20 }}><View><Text style={{ fontFamily: fonts.display700, fontSize: 28, color: colors.ink }}>{found}</Text><Text style={styles.sub}>найдено</Text></View><View><Text style={{ fontFamily: fonts.display700, fontSize: 28, color: colors.accentText }}>{queued}</Text><Text style={styles.sub}>в очереди</Text></View></View>
      {sources.map(source => { const done = logs.find(l => l.text.toLowerCase().includes(source.toLowerCase()) && (l.text.startsWith('Источник · ') || /готов|найден|прочитан|событ|ошиб|нет новых/i.test(l.text))); return <Text key={source} style={styles.sub}>{done ? done.text : `${source} · ждём ответ`}</Text>; })}
      {found === 0 && <Text style={styles.sub}>Пока новых находок нет. Счётчик обновляется по ответам источников</Text>}
      <Text style={styles.now}>Читаю: {sources.join(' · ')}</Text>
      <Clock since={since} line={line} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', gap: 10, paddingVertical: 8 },
  stage: { width: 120, height: 120, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', width: 120, height: 120, borderRadius: 60, borderWidth: 2, borderColor: colors.accent, backgroundColor: 'rgba(240,82,31,0.08)' },
  lens: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  track: { alignSelf: 'stretch', height: 4, borderRadius: 2, backgroundColor: colors.sand, overflow: 'hidden' },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 2, backgroundColor: colors.accent },
  now: { fontFamily: fonts.body700, fontSize: 14, color: colors.ink, textAlign: 'center' },
  sub: { fontFamily: fonts.mono500, fontSize: 11.5, color: colors.muted, textAlign: 'center' },
});
