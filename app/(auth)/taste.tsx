// Интересы — design/png/V5LoginTaste.png. Минимум три, лента начнёт с них (start_answers + стартовый вкус).
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { interestsOf, MIN_TASTE, TASTE_CHIPS } from '../../src/auth/taste';
import { saveTaste } from '../../src/live/api';
import { useSession } from '../../src/state/session';
import { colors, fonts } from '../../src/theme';
import { LoginFrame, StepButton } from '../../src/ui/v6/LoginFrame';

export default function Taste() {
  const update = useSession((s) => s.update);
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const ok = picked.length >= MIN_TASTE;

  const next = async () => {
    setBusy(true);
    setError(false);
    try {
      await saveTaste(picked);
      update({ interests: interestsOf(picked) });
      router.push('/allow');
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <LoginFrame step={4} onBack={() => router.back()} title="Что вытаскивает тебя из дома?" sub="Хотя бы три — лента начнёт с них."
      footer={<StepButton label={ok ? `Дальше · выбрано ${picked.length}` : `Выбери ещё ${MIN_TASTE - picked.length}`} onPress={() => void next()} disabled={!ok} busy={busy} />}>
      <View style={styles.chips}>
        {TASTE_CHIPS.map((c) => {
          const on = picked.includes(c.id);
          return (
            <Pressable key={c.id} onPress={() => toggle(c.id)} style={({ pressed }) => [styles.chip, on && styles.on, pressed && { transform: [{ scale: 0.96 }] }]}
              accessibilityRole="checkbox" accessibilityState={{ checked: on }}>
              <Text style={[styles.text, on && { color: colors.paper }]}>{c.label}</Text>
            </Pressable>
          );
        })}
      </View>
      {error ? <Text style={styles.error}>Не получилось сохранить. Проверь связь</Text> : null}
    </LoginFrame>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 20 },
  chip: { height: 48, paddingHorizontal: 16, borderRadius: 24, borderWidth: 1.5, borderColor: '#DDD8CC', backgroundColor: colors.card, justifyContent: 'center' },
  on: { backgroundColor: colors.ink, borderColor: colors.ink },
  text: { fontFamily: fonts.body700, fontSize: 15, color: colors.ink },
  error: { fontFamily: fonts.body600, fontSize: 13.5, color: colors.accentText, paddingHorizontal: 24, marginTop: 14 },
});
