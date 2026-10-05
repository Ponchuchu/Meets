// «Это ты?» — design/png/V5LoginName.png. Имя и ник уже в базе (alpha-login), фото — в бакет avatars.
import { useQuery } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { getProfile, isStaff, saveProfile, uploadAvatar } from '../../live/api';
import { useSession } from '../../state/session';
import { colors, fonts } from '../../theme';
import { LoginFrame, StepButton } from '../../ui/v6/LoginFrame';

export default function Name() {
  const update = useSession((s) => s.update);
  const prof = useQuery({ queryKey: ['me', 'profile'], queryFn: () => getProfile() });
  const staff = useQuery({ queryKey: ['me', 'staff'], queryFn: () => isStaff() });
  const [edited, setName] = useState<string | null>(null);
  const [picked, setPhoto] = useState<string | null>(null);
  const name = edited ?? prof.data?.name ?? '';
  const photo = picked ?? prof.data?.photo_url ?? null;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.7 });
    if (!res.canceled && res.assets[0]) setPhoto(res.assets[0].uri);
  };

  const next = async () => {
    const n = name.trim();
    if (!n) return;
    setBusy(true);
    setError(null);
    try {
      await saveProfile({ name: n, handle: prof.data?.handle ?? null });
      if (photo && photo !== prof.data?.photo_url) {
        const url = await uploadAvatar(photo);
        update({ photo: url });
      }
      update({ name: n, handle: prof.data?.handle ?? undefined });
      router.push('/taste');
    } catch {
      setError('Не получилось сохранить. Проверь связь');
    } finally {
      setBusy(false);
    }
  };

  const found = !!prof.data;
  return (
    <LoginFrame step={3} onBack={() => router.replace('/phone')} title="Это ты?"
      sub={found ? 'Нашли тебя в базе — проверь и добавь фото.' : 'Как тебя зовут? Добавь фото — так друзья узнают тебя на карте.'}
      footer={<StepButton label="Да, это я" onPress={() => void next()} disabled={!name.trim()} busy={busy} />}>
      <View style={styles.center}>
        <Pressable onPress={() => void pick()} style={styles.ring} accessibilityRole="button" accessibilityLabel="Выбрать фото">
          {photo ? <Image source={{ uri: photo }} style={styles.face} /> : (
            <View style={[styles.face, styles.empty]}><Text style={styles.letter}>{(name.trim()[0] ?? '·').toUpperCase()}</Text></View>
          )}
          <View style={styles.cam}>
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
              <Path d="M4 8h3l2-2.5h6L17 8h3a1 1 0 011 1v9a1 1 0 01-1 1H4a1 1 0 01-1-1V9a1 1 0 011-1z" stroke={colors.paper} strokeWidth={1.8} strokeLinejoin="round" />
              <Circle cx={12} cy={13} r={3.2} stroke={colors.paper} strokeWidth={1.8} />
            </Svg>
          </View>
        </Pressable>
      </View>
      <View style={styles.form}>
        <Text style={styles.label}>Имя</Text>
        <TextInput value={name} onChangeText={setName} style={styles.input} placeholder="Как тебя зовут" placeholderTextColor="#A8A296"
          maxLength={40} returnKeyType="done" accessibilityLabel="Имя" />
        <View style={styles.chips}>
          {prof.data?.handle ? <View style={styles.handle}><Text style={styles.handleText}>@{prof.data.handle}</Text></View> : null}
          {staff.data ? (
            <View style={styles.dev}>
              <Svg width={14} height={14} viewBox="0 0 24 24" fill="none"><Path d="M8 7l-5 5 5 5M16 7l5 5-5 5M13.5 5l-3 14" stroke={colors.accent} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></Svg>
              <Text style={styles.devText}>Разработчик</Text>
            </View>
          ) : null}
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
    </LoginFrame>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', paddingBottom: 22 },
  ring: { width: 146, height: 146, borderRadius: 73, borderWidth: 3, borderColor: colors.accent, padding: 4 },
  face: { flex: 1, borderRadius: 66 },
  empty: { backgroundColor: '#F6B597', alignItems: 'center', justifyContent: 'center' },
  letter: { fontFamily: fonts.display800, fontSize: 60, color: colors.ink },
  cam: { position: 'absolute', right: -2, bottom: 4, width: 48, height: 48, borderRadius: 24, backgroundColor: colors.ink, borderWidth: 3, borderColor: colors.paper, alignItems: 'center', justifyContent: 'center' },
  form: { paddingHorizontal: 24, gap: 8 },
  label: { fontFamily: fonts.body700, fontSize: 13, color: colors.muted },
  input: { height: 56, borderRadius: 16, borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.card, paddingHorizontal: 16, fontFamily: fonts.body700, fontSize: 18, color: colors.ink },
  chips: { flexDirection: 'row', gap: 8, marginTop: 4 },
  handle: { height: 40, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1.5, borderColor: '#DDD8CC', backgroundColor: colors.card, justifyContent: 'center' },
  handleText: { fontFamily: fonts.mono600, fontSize: 14, color: colors.ink },
  dev: { height: 40, paddingHorizontal: 14, borderRadius: 12, backgroundColor: colors.ink, flexDirection: 'row', alignItems: 'center', gap: 8 },
  devText: { fontFamily: fonts.body700, fontSize: 13.5, color: colors.paper },
  error: { fontFamily: fonts.body600, fontSize: 13.5, color: colors.accentText, marginTop: 6 },
});
