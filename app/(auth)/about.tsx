// Шаг 1/3 «Давай знакомиться» — design/png/SignUpProfile.png
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { BIRTH_ERRORS, checkBirthDate, maskBirthDate } from '../../src/auth/rules';
import { photo } from '../../src/data/photos';
import { useSession } from '../../src/state/session';
import { colors, fonts } from '../../src/theme';
import { Glyph, InstagramGlyph } from '../../src/ui/Glyph';
import { Button, Field, FieldLabel, Steps } from '../../src/ui/kit';
import { Appear } from '../../src/ui/motion';
import { StepScreen } from '../../src/ui/StepScreen';

export default function About() {
  const draft = useSession((s) => s.draft);
  const update = useSession((s) => s.update);
  const [touched, setTouched] = useState(false);
  const fromProvider = draft.provider === 'google' || draft.provider === 'apple';
  const birth = checkBirthDate(draft.birthDate);
  const ready = draft.name.trim().length > 0 && birth.ok;
  const showError = !birth.ok && (touched || draft.birthDate.length === 10) && birth.reason !== 'empty';

  const pickFromGallery = async () => {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8 });
      if (!res.canceled && res.assets[0]) update({ photo: res.assets[0].uri });
    } catch {
      update({ photo: 'danil' });
    }
  };
  // Демо: «Взять из Instagram» подставляет фото Данила (настоящий импорт — этап 8).
  const fromInstagram = () => update({ photo: 'danil' });

  const next = () => {
    setTouched(true);
    if (ready) router.push('/interests');
  };

  return (
    <StepScreen
      top={<Steps step={1} />}
      title="Давай знакомиться"
      subtitle={fromProvider ? `Имя и фото взяли из ${draft.provider === 'apple' ? 'Apple' : 'Google'} — поменяй, если хочешь` : 'Так тебя увидят люди на событиях'}
      footer={<Button label="Дальше" variant="dark" disabled={!ready && touched} onPress={next} />}
    >
      <Appear index={1} style={styles.photoRow}>
        {draft.photo ? (
          <Image source={photo(draft.photo)} style={styles.photo} accessibilityLabel="Фото профиля" />
        ) : (
          <Pressable onPress={pickFromGallery} style={[styles.photo, styles.photoEmpty]} accessibilityRole="button" accessibilityLabel="Добавить фото">
            <Glyph name="camera" size={28} color={colors.muted} />
          </Pressable>
        )}
        <View style={{ gap: 8 }}>
          <Pressable onPress={fromInstagram} style={[styles.pill, { backgroundColor: colors.sand }]} accessibilityRole="button">
            <InstagramGlyph color={colors.ink} />
            <Text style={styles.pillText}>Взять из Instagram</Text>
          </Pressable>
          <Pressable onPress={pickFromGallery} style={[styles.pill, { borderWidth: 1, borderColor: colors.line2 }]} accessibilityRole="button">
            <Glyph name="gallery" size={15} color={colors.ink} strokeWidth={2} />
            <Text style={styles.pillText}>Из галереи</Text>
          </Pressable>
        </View>
      </Appear>
      <Appear index={2} style={{ gap: 6 }}>
        <FieldLabel>Имя</FieldLabel>
        <Field value={draft.name} onChangeText={(name) => update({ name })} placeholder="Как к тебе обращаться"
          textContentType="givenName" autoComplete="name-given" accessibilityLabel="Имя" invalid={touched && !draft.name.trim()} />
      </Appear>
      <Appear index={3} style={{ gap: 6 }}>
        <FieldLabel>Дата рождения</FieldLabel>
        <Field value={draft.birthDate} onChangeText={(t) => update({ birthDate: maskBirthDate(t) })} placeholder="ДД.ММ.ГГГГ"
          keyboardType="number-pad" maxLength={10} accessibilityLabel="Дата рождения" invalid={showError || (touched && !birth.ok)}
          onBlur={() => draft.birthDate && setTouched(true)} />
        <Text style={[styles.hint, (showError || (touched && !birth.ok)) && { color: colors.accentText }]}>
          {birth.ok || (!showError && !touched) ? BIRTH_ERRORS.empty : BIRTH_ERRORS[birth.reason]}
        </Text>
      </Appear>
    </StepScreen>
  );
}

const styles = StyleSheet.create({
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  photo: { width: 96, height: 96, borderRadius: 30 },
  photoEmpty: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#B9B2A3', alignItems: 'center', justifyContent: 'center' },
  pill: { height: 38, paddingHorizontal: 12, borderRadius: 19, flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start' },
  pillText: { fontFamily: fonts.body600, fontSize: 13.5, color: colors.ink },
  hint: { fontFamily: fonts.body400, fontSize: 12.5, color: colors.muted },
});
