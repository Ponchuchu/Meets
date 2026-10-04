// Старт регистрации — design/png/SignUp.png
import { router } from 'expo-router';
import { sendCode as requestSms, signInWithApple } from '../../src/auth/service';
import { useRef, useState } from 'react';
import { Image, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MapBase } from '../../src/components/MapBase';
import { formatPhone, isPhoneComplete } from '../../src/auth/rules';
import { photos } from '../../src/data/photos';
import { useSession } from '../../src/state/session';
import { colors, fonts } from '../../src/theme';
import { Glyph } from '../../src/ui/Glyph';
import { Button, Field } from '../../src/ui/kit';
import { Appear, Float } from '../../src/ui/motion';

const HERO = 400;

export default function Start() {
  const insets = useSafeAreaInsets();
  const draft = useSession((s) => s.draft);
  const signIn = useSession((s) => s.signIn);
  const update = useSession((s) => s.update);
  const [phone, setPhone] = useState(draft.phone);
  const phoneRef = useRef<TextInput>(null);

  // Apple на iPhone — настоящий вход через Supabase. Google и web — пока демо: пускают как «Данил» (ключи — docs/KEYS.md).
  const withProvider = async (provider: 'google' | 'apple') => {
    const apple = provider === 'apple' ? await signInWithApple() : null;
    signIn(provider, apple ? { name: apple.name ?? '' } : { name: 'Данил', photo: 'danil' });
    router.push('/about');
  };
  const sendCode = () => {
    if (!isPhoneComplete(phone)) { phoneRef.current?.focus(); return; }
    update({ phone });
    void requestSms(phone);
    router.push('/code');
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior="padding">
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }} keyboardShouldPersistTaps="handled" bounces={false}>
        <View style={[styles.hero, { height: HERO + insets.top }]}>
          <View style={[styles.map, { top: -150 + insets.top }]} pointerEvents="none">
            <MapBase theme="night" width="100%" />
          </View>
          <View style={styles.shade} />
          <View style={{ position: 'absolute', left: '50%', marginLeft: -195, top: insets.top, width: 390, height: HERO }} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Float style={[styles.abs, { left: 160, top: 96 }]}>
              <View style={styles.pinRow}>
                <View style={styles.hotPin}><Glyph name="note" size={19} color={colors.ink} strokeWidth={2.2} /></View>
                <Text style={styles.pinLabel}>ДЖАЗ · 19:30</Text>
              </View>
            </Float>
            <View style={[styles.abs, styles.smallPin, { left: 57, top: 167 }]}><Glyph name="peak" size={15} color={colors.ink} strokeWidth={2.2} /></View>
            <View style={[styles.abs, styles.smallPin, { left: 297, top: 147 }]}><Glyph name="mic" size={15} color={colors.ink} strokeWidth={2.2} /></View>
            <Float style={[styles.abs, { left: 238, top: 198 }]} duration={5000}><Avatar src="igor" size={40} /></Float>
            <Float style={[styles.abs, { left: 108, top: 58 }]} duration={6000} delay={700}><Avatar src="ainura" size={36} /></Float>
            <Float style={[styles.abs, { left: 316, top: 74 }]} duration={5500} delay={1200}><Avatar src="denis" size={34} /></Float>
          </View>
          <Appear style={styles.brand}>
            <Text style={styles.logo} accessibilityRole="header">рядом<Text style={{ color: colors.accent }}>.</Text></Text>
            <Text style={styles.slogan}>Куда пойти сегодня — и с кем</Text>
          </Appear>
        </View>

        <View style={styles.form}>
          <Appear index={1}><Text style={styles.h1}>Войти или создать аккаунт</Text></Appear>
          <Appear index={2}>
            <Button variant="light" height={52} label="Продолжить с Google" onPress={() => void withProvider('google')}
              icon={<View style={styles.g}><Text style={styles.gText}>G</Text></View>} />
          </Appear>
          <Appear index={3}>
            <Button variant="dark" height={52} label="Продолжить с Apple" onPress={() => void withProvider('apple')}
              icon={<Glyph name="lock" size={20} color={colors.paper} strokeWidth={1.9} />} />
          </Appear>
          <Appear index={4}>
            <View style={styles.or} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <View style={styles.orLine} /><Text style={styles.orText}>ИЛИ ПО НОМЕРУ</Text><View style={styles.orLine} />
            </View>
          </Appear>
          <Appear index={5}>
            <View style={styles.phoneRow}>
              <Pressable style={styles.cc} accessibilityRole="button" accessibilityLabel="Код страны: Казахстан, +7">
                <Text style={styles.ccText}>+7</Text>
                <Glyph name="chevronDown" size={12} color={colors.ink} strokeWidth={2.6} />
              </Pressable>
              <Field
                ref={phoneRef}
                style={{ flex: 1 }}
                value={phone}
                onChangeText={(t) => setPhone(formatPhone(t))}
                placeholder="707 123 45 67"
                keyboardType="phone-pad"
                textContentType="telephoneNumber"
                autoComplete="tel"
                accessibilityLabel="Номер телефона"
                returnKeyType="done"
                onSubmitEditing={sendCode}
              />
            </View>
          </Appear>
          <Appear index={6}><Button variant="accent" height={52} label="Получить код" onPress={sendCode} /></Appear>
          <Appear index={7}>
            <Text style={styles.legal}>Только 18+. Продолжая, ты принимаешь правила сообщества и политику конфиденциальности.</Text>
          </Appear>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Avatar({ src, size }: { src: keyof typeof photos; size: number }) {
  return (
    <View style={{ width: size + 4, height: size + 4, borderRadius: (size + 4) / 2, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' }}>
      <Image source={photos[src]} style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 3, borderColor: colors.friendLight }} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  hero: { backgroundColor: colors.ink, borderBottomLeftRadius: 32, borderBottomRightRadius: 32, overflow: 'hidden' },
  map: { position: 'absolute', left: 0, right: 0, height: 844, opacity: 0.95 },
  shade: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(23,22,26,0.25)' },
  abs: { position: 'absolute' },
  pinRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  hotPin: { width: 46, height: 46, borderRadius: 17, backgroundColor: colors.accent, borderWidth: 3, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center', margin: -3 },
  pinLabel: { fontFamily: fonts.mono600, fontSize: 11, backgroundColor: colors.paper, color: colors.ink, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 7, overflow: 'hidden', marginLeft: 3 },
  smallPin: { width: 36, height: 36, borderRadius: 13, backgroundColor: colors.paper, borderWidth: 3, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  brand: { position: 'absolute', left: 24, right: 24, bottom: 28, gap: 6 },
  logo: { fontFamily: fonts.display800, fontSize: 60, letterSpacing: -3, lineHeight: 60, color: colors.paper },
  slogan: { fontFamily: fonts.body400, fontSize: 17, lineHeight: 23, color: '#E4E0D6' },
  form: { paddingHorizontal: 20, paddingTop: 22, gap: 10 },
  h1: { fontFamily: fonts.display700, fontSize: 22, letterSpacing: -0.2, color: colors.ink, marginBottom: 4 },
  g: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  gText: { fontFamily: fonts.display800, fontSize: 13, color: colors.paper },
  or: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  orLine: { flex: 1, height: 1, backgroundColor: colors.line },
  orText: { fontFamily: fonts.mono600, fontSize: 10.5, letterSpacing: 0.63, color: colors.muted },
  phoneRow: { flexDirection: 'row', gap: 8 },
  cc: { width: 76, height: 52, borderWidth: 1, borderColor: colors.line2, borderRadius: 16, backgroundColor: colors.card, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  ccText: { fontFamily: fonts.body600, fontSize: 15.5, color: colors.ink },
  legal: { paddingTop: 2, textAlign: 'center', fontFamily: fonts.body400, fontSize: 12, lineHeight: 17.4, color: colors.muted },
});
