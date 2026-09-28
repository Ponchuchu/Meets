// Шаг 3/3 «Когда тебя проще вытащить?» — design/png/SignUpRhythm.png. Потом — запрос геолокации и карта.
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { saveProfile } from '../../src/auth/service';
import { registerPush } from '../../src/notify/register';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { Budget, TimeSlot, WithWho } from '../../src/reco/startTaste';
import { useSession } from '../../src/state/session';
import { colors, fonts } from '../../src/theme';
import { Glyph } from '../../src/ui/Glyph';
import { Button, Chip, Segments, Steps } from '../../src/ui/kit';
import { Appear } from '../../src/ui/motion';
import { StepScreen } from '../../src/ui/StepScreen';

const TIMES: [TimeSlot, string][] = [
  ['weekday', 'Будни вечером'], ['friday', 'Пятница'], ['weekend', 'Выходные днём'], ['weekendNight', 'Выходные вечером'], ['now', 'Спонтанно, прямо сейчас'],
];

export default function Rhythm() {
  const draft = useSession((s) => s.draft);
  const update = useSession((s) => s.update);
  const finish = useSession((s) => s.finish);
  const setLocationAsked = useSession((s) => s.setLocationAsked);
  const [busy, setBusy] = useState(false);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/interests'));
  const toggle = (k: TimeSlot) => update({ times: draft.times.includes(k) ? draft.times.filter((x) => x !== k) : [...draft.times, k] });

  // Геолокация — последней и с объяснением. Отказ ничего не ломает: просто без «рядом».
  const done = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await Location.requestForegroundPermissionsAsync();
    } catch {
      // нет геолокации на устройстве — идём дальше
    }
    setLocationAsked();
    finish();
    void saveProfile(useSession.getState().draft).then((ok) => (ok ? registerPush() : null));
    router.replace('/');
  };

  return (
    <StepScreen
      titleSize={30}
      top={<Steps step={3} onBack={back} />}
      title="Когда тебя проще вытащить?"
      subtitle="Первая подборка будет по этим ответам, дальше подстроится сама."
      footer={<Button label="Готово — показать, что рядом" variant="accent" onPress={done} />}
    >
      <Appear index={1} style={styles.block}>
        <Text style={styles.label}>Когда обычно свободен</Text>
        <View style={styles.chips} accessibilityLabel="Когда обычно свободен">
          {TIMES.map(([k, label]) => <Chip key={k} label={label} on={draft.times.includes(k)} onPress={() => toggle(k)} />)}
        </View>
      </Appear>
      <Appear index={2} style={styles.block}>
        <Text style={styles.label}>С кем обычно ходишь</Text>
        <Segments<WithWho> label="С кем обычно ходишь" value={draft.withWho} onChange={(withWho) => update({ withWho })}
          options={[['friends', 'С друзьями'], ['alone', 'Один'], ['mixed', 'По-разному']]} />
      </Appear>
      <Appear index={3} style={styles.block}>
        <Text style={styles.label}>Сколько готов тратить за вечер</Text>
        <Segments<Budget> label="Бюджет" value={draft.budget} onChange={(budget) => update({ budget })}
          options={[['free', 'Бесплатно'], ['mid', 'До 5 000 ₸'], ['any', 'Не важно']]} />
      </Appear>
      <Appear index={4} style={styles.note}>
        <View style={styles.noteIcon}><Glyph name="send" size={18} color="#FFFFFF" strokeWidth={2} /></View>
        <Text style={styles.noteText}>Дальше спросим доступ к геолокации — чтобы показать, что рядом. Друзья тебя не увидят, пока сам не включишь.</Text>
      </Appear>
    </StepScreen>
  );
}

const styles = StyleSheet.create({
  block: { gap: 8 },
  label: { fontFamily: fonts.body600, fontSize: 13, color: colors.muted2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  note: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', padding: 14, borderRadius: 18, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  noteIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: colors.friend, alignItems: 'center', justifyContent: 'center' },
  noteText: { flex: 1, fontFamily: fonts.body400, fontSize: 13, lineHeight: 18.85, color: colors.muted2 },
});
