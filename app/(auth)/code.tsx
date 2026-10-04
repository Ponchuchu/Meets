// Код — design/png/V5LoginCode.png. Клетки по длине кода из alpha-login?probe, автопереход, неверный — тряска.
// Повтора кода нет: в альфе код даёт разработчик (docs/ALPHA.md §1).
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { login } from '../../src/live/auth';
import { useSession } from '../../src/state/session';
import { colors, fonts } from '../../src/theme';
import { LoginFrame, StepButton } from '../../src/ui/v6/LoginFrame';

const MSG = {
  bad_code: 'Неверный код. Попробуй ещё раз',
  too_many: 'Слишком много попыток. Подожди 10 минут',
  not_tester: 'Пока вход только для тестеров. Напиши Данилу',
  error: 'Нет связи с сервером. Попробуй ещё раз',
} as const;

export default function Code() {
  const { len } = useLocalSearchParams<{ len?: string }>();
  const size = Math.min(8, Math.max(4, Number(len) || 4));
  const phone = useSession((s) => s.draft.phone);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<keyof typeof MSG | null>(null);
  const input = useRef<TextInput>(null);
  const shake = useSharedValue(0);
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.get() }] }));
  const back = () => (router.canGoBack() ? router.back() : router.replace('/phone'));

  const submit = async (v: string) => {
    if (v.length < size || busy) return;
    setBusy(true);
    const r = await login(phone, v);
    setBusy(false);
    if (r === 'ok') { router.replace('/name'); return; }
    setError(r);
    setCode('');
    shake.set(withSequence(withTiming(-10, { duration: 50 }), withTiming(10, { duration: 50 }), withTiming(-6, { duration: 50 }), withTiming(6, { duration: 50 }), withTiming(0, { duration: 50 })));
    input.current?.focus();
  };

  const cell = size > 6 ? 40 : size > 4 ? 52 : 72;
  return (
    <LoginFrame step={2} onBack={back} title="Код из SMS" sub={`Для номера +7 ${phone}`} keyboard
      footer={<View style={{ paddingBottom: 16 }}><StepButton label="Дальше" onPress={() => void submit(code)} disabled={code.length < size} busy={busy} /></View>}>
      <Pressable onPress={() => input.current?.focus()} accessibilityLabel={`Код, ${size} цифры`}>
        <Animated.View style={[styles.boxes, shakeStyle]}>
          {Array.from({ length: size }, (_, i) => {
            const active = i === code.length && !busy;
            return (
              <View key={i} style={[styles.box, { width: cell, height: cell * 1.2, borderColor: error ? colors.accent : active || code[i] ? colors.ink : '#CFC9BB', borderWidth: active ? 2.5 : 1.5 }]}>
                <Text style={[styles.digit, { fontSize: cell * 0.5 }]}>{code[i] ?? ''}</Text>
              </View>
            );
          })}
        </Animated.View>
      </Pressable>
      <TextInput ref={input} value={code} autoFocus keyboardType="number-pad" textContentType="oneTimeCode" autoComplete="sms-otp" maxLength={size} caretHidden
        onChangeText={(t) => { const v = t.replace(/\D/g, '').slice(0, size); setError(null); setCode(v); if (v.length === size) void submit(v); }} style={styles.hidden} accessibilityLabel="Код" />
      <View style={styles.hint}>
        <Text style={styles.hintText}>{error ? MSG[error] : 'Код дал разработчик'}</Text>
      </View>
    </LoginFrame>
  );
}

const styles = StyleSheet.create({
  boxes: { flexDirection: 'row', gap: 12, paddingHorizontal: 24 },
  box: { borderRadius: 16, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  digit: { fontFamily: fonts.display700, color: colors.ink },
  hidden: { position: 'absolute', width: 1, height: 1, opacity: 0.01 },
  hint: { alignSelf: 'flex-start', marginLeft: 24, marginTop: 16, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, backgroundColor: '#FBDCCB' },
  hintText: { fontFamily: fonts.body700, fontSize: 13, color: colors.accentText },
});
