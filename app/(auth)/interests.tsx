// Шаг 2/3 «Что вытаскивает тебя из дома?» — design/png/Onboarding.png. Минимум 3 интереса.
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MIN_INTERESTS } from '../../src/auth/rules';
import type { Interest } from '../../src/reco/startTaste';
import { useSession } from '../../src/state/session';
import { colors, fonts } from '../../src/theme';
import { Glyph } from '../../src/ui/Glyph';
import { Button, Steps } from '../../src/ui/kit';
import { Appear } from '../../src/ui/motion';
import { StepScreen } from '../../src/ui/StepScreen';

const OPTIONS: [Interest, string][] = [
  ['music', 'Живая музыка'], ['standup', 'Посмеяться'], ['hike', 'Горы и природа'], ['sport', 'Бег и вело'], ['people', 'Новые люди'],
  ['games', 'Настолки'], ['art', 'Выставки'], ['food', 'Еда и маркеты'], ['party', 'Вечеринки'], ['talks', 'Лекции и кино'],
];

export default function Interests() {
  const selected = useSession((s) => s.draft.interests);
  const update = useSession((s) => s.update);
  const n = selected.length;
  const ok = n >= MIN_INTERESTS;
  const toggle = (k: Interest) => update({ interests: selected.includes(k) ? selected.filter((x) => x !== k) : [...selected, k] });
  const back = () => (router.canGoBack() ? router.back() : router.replace('/about'));

  return (
    <StepScreen
      gap={16}
      top={<Steps step={2} onBack={back} />}
      title="Что вытаскивает тебя из дома?"
      subtitle="С этого начнутся «Рекомендации». Дальше подборка подстроится под твои свайпы сама."
      footer={<Button label="Дальше" variant="dark" disabled={!ok} onPress={() => router.push('/rhythm')} />}
    >
      <Appear index={1}>
        <View style={styles.grid} accessibilityLabel="Что вытаскивает из дома">
          {OPTIONS.map(([k, label]) => {
            const on = selected.includes(k);
            return (
              <Pressable key={k} onPress={() => toggle(k)} accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={label}
                style={({ pressed }) => [styles.card, { backgroundColor: on ? colors.ink : colors.card, borderColor: on ? colors.ink : colors.line2, transform: [{ scale: pressed ? 0.97 : 1 }] }]}>
                <Glyph name={k} size={20} color={on ? colors.paper : colors.ink} />
                <Text style={[styles.cardText, { color: on ? colors.paper : colors.ink }]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
      </Appear>
      <Appear index={2}>
        <Text style={[styles.count, { color: ok ? colors.muted : colors.accentText }]} accessibilityLiveRegion="polite">
          {ok ? `ВЫБРАНО ${n} · МОЖНО СКОЛЬКО УГОДНО` : `ВЫБЕРИ ХОТЯ БЫ ${MIN_INTERESTS} · СЕЙЧАС ${n}`}
        </Text>
      </Appear>
    </StepScreen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  card: { width: '48.9%', flexGrow: 1, flexBasis: '45%', height: 74, paddingVertical: 12, paddingHorizontal: 14, borderWidth: 1, borderRadius: 18, justifyContent: 'space-between' },
  cardText: { fontFamily: fonts.body600, fontSize: 14.5 },
  count: { fontFamily: fonts.mono600, fontSize: 11, letterSpacing: 0.66 },
});
