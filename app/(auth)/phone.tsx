// Номер — design/png/V5LoginPhone.png. Своя клавиатура, как в макете. Номер не из списка тестеров — без SMS.
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { formatPhone, isPhoneComplete } from '../../src/auth/rules';
import { probe } from '../../src/live/auth';
import { useSession } from '../../src/state/session';
import { colors, fonts } from '../../src/theme';
import { LoginFrame, StepButton } from '../../src/ui/v6/LoginFrame';

const KEYS: [string, string][] = [['1', ''], ['2', 'ABC'], ['3', 'DEF'], ['4', 'GHI'], ['5', 'JKL'], ['6', 'MNO'], ['7', 'PQRS'], ['8', 'TUV'], ['9', 'WXYZ'], ['', ''], ['0', '+'], ['del', '']];

type Probe = { phone: string; tester: boolean; codeLength: number } | null;

export default function Phone() {
  const insets = useSafeAreaInsets();
  const update = useSession((s) => s.update);
  const [phone, setPhone] = useState(useSession.getState().draft.phone);
  const [checked, setChecked] = useState<Probe>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const done = isPhoneComplete(phone);

  // Номер набран — сразу спрашиваем функцию: есть ли он в списке тестеров и сколько цифр в коде.
  const press = (k: string) => {
    if (!k || k === '+') return;
    const digits = phone.replace(/\D/g, '');
    const v = formatPhone(k === 'del' ? digits.slice(0, -1) : digits + k);
    if (v === phone) return;
    setPhone(v);
    setError(null);
    setChecked(null);
    if (isPhoneComplete(v)) probe(v).then((r) => setChecked({ phone: v, ...r })).catch(() => undefined);
  };

  const next = async () => {
    if (!done) return;
    setBusy(true);
    try {
      const r = checked?.phone === phone ? checked : { phone, ...(await probe(phone)) };
      if (!r.tester) { setError('Пока вход только для тестеров. Напиши Данилу'); return; }
      update({ phone, provider: 'phone' });
      router.push({ pathname: '/code', params: { len: String(r.codeLength) } });
    } catch {
      setError('Нет связи с сервером. Попробуй ещё раз');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <LoginFrame step={1} onBack={() => (router.canGoBack() ? router.back() : router.replace('/hello'))} title="Твой номер" sub="Пришлём код. Номер никто не увидит.">
        <View style={styles.fields}>
          <View style={styles.cc} accessibilityLabel="Казахстан, плюс 7"><Text style={styles.ccText}>KZ +7</Text></View>
          <View style={styles.num} accessibilityLabel={`Номер телефона ${phone || 'пусто'}`}>
            <Text style={[styles.numText, !phone && { color: '#A8A296' }]}>{phone || '700 000 00 00'}</Text>
          </View>
        </View>
        {error ? (
          <Animated.View entering={FadeIn} style={[styles.chip, styles.chipWarn]}><Text style={[styles.chipText, { color: colors.accentText }]}>{error}</Text></Animated.View>
        ) : checked?.tester && checked.phone === phone ? (
          <Animated.View entering={FadeIn} style={styles.chip}>
            <Svg width={14} height={14} viewBox="0 0 24 24" fill="none"><Path d="M8 7l-5 5 5 5M16 7l5 5-5 5M13.5 5l-3 14" stroke={colors.accent} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></Svg>
            <Text style={styles.chipText}>Есть в базе · тестер альфы</Text>
          </Animated.View>
        ) : null}
      </LoginFrame>
      <View style={[styles.pad, { paddingBottom: insets.bottom + 8 }]}>
        <StepButton label="Получить код" onPress={() => void next()} disabled={!done} busy={busy} />
        <View style={styles.keys}>
          {KEYS.map(([k, sub], i) => (
            <Pressable key={i} onPress={() => press(k)} disabled={!k} style={({ pressed }) => [styles.key, !k && { backgroundColor: 'transparent' }, k === 'del' && { backgroundColor: 'transparent' }, pressed && k ? { backgroundColor: '#D6D0C3' } : null]}
              accessibilityRole="button" accessibilityLabel={k === 'del' ? 'Стереть' : k || undefined}>
              {k === 'del' ? (
                <Svg width={26} height={26} viewBox="0 0 24 24" fill="none"><Path d="M9 5h11a1 1 0 011 1v12a1 1 0 01-1 1H9l-6-7z M12 9.5l5 5M17 9.5l-5 5" stroke={colors.ink} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" /></Svg>
              ) : k ? (
                <>
                  <Text style={styles.keyText}>{k}</Text>
                  {sub ? <Text style={styles.keySub}>{sub}</Text> : null}
                </>
              ) : null}
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fields: { flexDirection: 'row', gap: 8, paddingHorizontal: 24 },
  cc: { width: 79, height: 60, borderRadius: 16, borderWidth: 1.5, borderColor: '#DDD8CC', backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  ccText: { fontFamily: fonts.mono600, fontSize: 17, color: colors.ink },
  num: { flex: 1, height: 60, borderRadius: 16, borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.card, justifyContent: 'center', paddingHorizontal: 16 },
  numText: { fontFamily: fonts.mono600, fontSize: 21, color: colors.ink, letterSpacing: 0.4 },
  chip: { alignSelf: 'flex-start', marginLeft: 24, marginTop: 14, height: 32, paddingHorizontal: 12, borderRadius: 10, backgroundColor: colors.ink, flexDirection: 'row', alignItems: 'center', gap: 8 },
  chipWarn: { backgroundColor: '#FBDCCB', height: undefined, paddingVertical: 8, marginRight: 24 },
  chipText: { fontFamily: fonts.body700, fontSize: 13, color: colors.paper },
  pad: { backgroundColor: '#E7E2D6', paddingHorizontal: 10, paddingTop: 10, gap: 8 },
  keys: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  key: { flexBasis: '30%', flexGrow: 1, height: 50, borderRadius: 8, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  keyText: { fontFamily: fonts.body400, fontSize: 23, lineHeight: 26, color: colors.ink },
  keySub: { fontFamily: fonts.body700, fontSize: 9, letterSpacing: 1.2, color: colors.muted },
});
