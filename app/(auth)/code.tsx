// Код из SMS — design/png/SignUpCode.png. Настоящая SMS — через Supabase; без SMS-шлюза демо-код 4821.
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DEMO_CODE, onlyCode, RESEND_SECONDS } from '../../src/auth/rules';
import { authMode, sendCode, verifyCode } from '../../src/auth/service';
import { useSession } from '../../src/state/session';
import { colors, fonts } from '../../src/theme';
import { Glyph } from '../../src/ui/Glyph';
import { BackButton } from '../../src/ui/kit';
import { Appear } from '../../src/ui/motion';

export default function Code() {
  const insets = useSafeAreaInsets();
  const phone = useSession((s) => s.draft.phone) || '707 123 45 67';
  const signIn = useSession((s) => s.signIn);
  const [code, setCode] = useState('');
  const [error, setError] = useState(false);
  const [left, setLeft] = useState(RESEND_SECONDS);
  const input = useRef<TextInput>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shake = useSharedValue(0);
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));

  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft((v) => v - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/start'));

  const onCode = (raw: string) => {
    const v = onlyCode(raw);
    setCode(v);
    setError(false);
    if (v.length < 4) return;
    // Автопереход после 4 цифр — с короткой паузой, чтобы было видно последнюю цифру.
    timer.current = setTimeout(async () => {
      const ok = await verifyCode(phone, v).catch(() => false);
      if (ok) {
        signIn('phone');
        router.replace('/about');
      } else {
        setError(true);
        setCode('');
        shake.value = withSequence(withTiming(-8, { duration: 50 }), withTiming(8, { duration: 50 }), withTiming(-5, { duration: 50 }), withTiming(0, { duration: 50 }));
      }
    }, 350);
  };

  const mm = Math.floor(left / 60);
  const ss = String(left % 60).padStart(2, '0');

  return (
    <View style={[styles.root, { paddingTop: Math.max(50, insets.top + 12), paddingBottom: insets.bottom + 30 }]}>
      <BackButton onPress={back} />
      <Appear style={{ gap: 8 }}>
        <Text style={styles.h1} accessibilityRole="header">Код из SMS</Text>
        <Text style={styles.sub}>
          Отправили на +7 {phone}.{' '}
          <Text style={styles.link} onPress={back} accessibilityRole="link">Изменить</Text>
        </Text>
      </Appear>
      <Appear index={1}>
        <Animated.View style={[styles.boxes, shakeStyle]}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={[styles.box, { borderWidth: i === code.length ? 2 : 1, borderColor: i === code.length ? colors.ink : error ? colors.accentText : colors.line2 }]}>
              <Text style={styles.digit}>{code[i] ?? ''}</Text>
            </View>
          ))}
          <TextInput
            ref={input}
            value={code}
            onChangeText={onCode}
            autoFocus
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="sms-otp"
            maxLength={4}
            caretHidden
            accessibilityLabel="Код из SMS, 4 цифры"
            style={styles.hidden}
          />
        </Animated.View>
      </Appear>
      <Appear index={2} style={{ gap: 20 }}>
        {authMode() === 'demo' && (
          <Pressable onPress={() => onCode(DEMO_CODE)} style={styles.paste} accessibilityRole="button">
            <Glyph name="chat" size={16} color={colors.ink} strokeWidth={2} />
            <Text style={styles.pasteText}>Вставить код из сообщения: {DEMO_CODE}</Text>
          </Pressable>
        )}
        {error ? (
          <Text style={[styles.resend, { color: colors.accentText }]}>НЕВЕРНЫЙ КОД · ПОПРОБУЙ ЕЩЁ РАЗ</Text>
        ) : left > 0 ? (
          <Text style={styles.resend}>ОТПРАВИТЬ ЕЩЁ РАЗ ЧЕРЕЗ {mm}:{ss}</Text>
        ) : (
          <Pressable onPress={() => { setLeft(RESEND_SECONDS); void sendCode(phone); }} accessibilityRole="button" hitSlop={12} style={{ alignSelf: 'flex-start' }}>
            <Text style={[styles.resend, { color: colors.ink, textDecorationLine: 'underline' }]}>ОТПРАВИТЬ ЕЩЁ РАЗ</Text>
          </Pressable>
        )}
      </Appear>
      <View style={{ flex: 1 }} />
      <Pressable onPress={() => { signIn('google', { name: 'Данил', photo: 'danil' }); router.replace('/about'); }} style={styles.alt} accessibilityRole="button">
        <Text style={styles.altText}>Не приходит код? Войти через Google</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper, paddingHorizontal: 20, gap: 20 },
  h1: { fontFamily: fonts.display700, fontSize: 32, letterSpacing: -0.8, color: colors.ink },
  sub: { fontFamily: fonts.body400, fontSize: 15, lineHeight: 22.5, color: colors.muted },
  link: { fontFamily: fonts.body600, color: colors.ink, textDecorationLine: 'underline' },
  boxes: { flexDirection: 'row', gap: 10, position: 'relative' },
  box: { flex: 1, flexBasis: 0, height: 72, borderRadius: 18, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  digit: { fontFamily: fonts.display700, fontSize: 32, color: colors.ink },
  hidden: { position: 'absolute', left: 0, top: 0, width: '100%', height: 72, opacity: 0.011, color: 'transparent', fontSize: 16 },
  paste: { alignSelf: 'flex-start', height: 40, paddingHorizontal: 14, borderRadius: 20, backgroundColor: colors.sand, flexDirection: 'row', alignItems: 'center', gap: 8 },
  pasteText: { fontFamily: fonts.body600, fontSize: 14, color: colors.ink },
  resend: { fontFamily: fonts.mono600, fontSize: 11, letterSpacing: 0.55, color: colors.muted },
  alt: { height: 48, alignItems: 'center', justifyContent: 'center' },
  altText: { fontFamily: fonts.body600, fontSize: 14, color: colors.muted },
});
