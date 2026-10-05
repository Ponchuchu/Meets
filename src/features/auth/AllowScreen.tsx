// Разрешения — design/png/V5LoginAllow.png: геолокация и уведомления. Можно пропустить — «Готово».
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useSession } from '../../state/session';
import { colors, fonts } from '../../theme';
import { LoginFrame, StepButton } from '../../ui/v6/LoginFrame';

type St = 'ask' | 'ok' | 'no';

function Card({ tint, icon, title, text, state, onPress }: { tint: string; icon: React.ReactNode; title: string; text: string; state: St; onPress: () => void }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={[styles.icon, { backgroundColor: tint }]}>{icon}</View>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.text}>{text}</Text>
        </View>
      </View>
      <Pressable onPress={state === 'ok' ? undefined : onPress} style={({ pressed }) => [styles.btn, state === 'ok' && styles.btnOk, pressed && { transform: [{ scale: 0.98 }] }]}
        accessibilityRole="button" accessibilityState={{ checked: state === 'ok' }}>
        {state === 'ok' && <Svg width={18} height={18} viewBox="0 0 24 24" fill="none"><Path d="M5 12l5 5 9-10" stroke={colors.ink} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" /></Svg>}
        <Text style={[styles.btnText, state === 'ok' && { color: colors.ink }]}>{state === 'ok' ? 'Разрешено' : state === 'no' ? 'Открыть настройки' : 'Разрешить'}</Text>
      </Pressable>
    </View>
  );
}

export default function Allow() {
  const setLocationAsked = useSession((s) => s.setLocationAsked);
  const [geo, setGeo] = useState<St>('ask');
  const [push, setPush] = useState<St>('ask');

  useEffect(() => {
    Location.getForegroundPermissionsAsync().then((p) => p.granted && setGeo('ok')).catch(() => undefined);
    Notifications.getPermissionsAsync().then((p) => p.granted && setPush('ok')).catch(() => undefined);
  }, []);

  const askGeo = async () => {
    try {
      const p = await Location.requestForegroundPermissionsAsync();
      setLocationAsked();
      if (p.granted) {
        setGeo('ok');
        // Фон — отдельным запросом («Всё время» на Android), в А2 при первом включении «делиться».
      } else setGeo('no');
    } catch { setGeo('no'); }
  };
  const askPush = async () => {
    try {
      const p = await Notifications.requestPermissionsAsync();
      setPush(p.granted ? 'ok' : 'no');
    } catch { setPush('no'); }
  };

  return (
    <LoginFrame step={5} onBack={() => router.back()} title="Последнее"
      footer={<StepButton label="Готово" onPress={() => router.push('/done')} />}>
      <View style={{ paddingHorizontal: 20, gap: 12 }}>
        <Card tint="#FBDCCB" title="Геолокация" text="Чтобы показать, что рядом. Друзья видят тебя, только если включишь." state={geo} onPress={() => void askGeo()}
          icon={<Svg width={22} height={22} viewBox="0 0 24 24" fill="none"><Path d="M12 21s-7-6.2-7-12a7 7 0 0114 0c0 5.8-7 12-7 12z" stroke={colors.ink} strokeWidth={1.8} strokeLinejoin="round" /><Circle cx={12} cy={9} r={2.4} stroke={colors.ink} strokeWidth={1.8} /></Svg>} />
        <Card tint={colors.softBlue} title="Уведомления" text="Сообщения, стикеры, «тебя зовут». Ночью — тишина." state={push} onPress={() => void askPush()}
          icon={<Svg width={22} height={22} viewBox="0 0 24 24" fill="none"><Path d="M6 16V11a6 6 0 0112 0v5l1.5 2h-15zM10 20.5a2 2 0 004 0" stroke={colors.ink} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" /></Svg>} />
      </View>
    </LoginFrame>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 22, borderWidth: 1.5, borderColor: '#E5E0D4', backgroundColor: colors.card, padding: 16, gap: 14 },
  cardTop: { flexDirection: 'row', gap: 12 },
  icon: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: fonts.display700, fontSize: 18, color: colors.ink },
  text: { fontFamily: fonts.body400, fontSize: 14, lineHeight: 19.5, color: colors.muted2 },
  btn: { height: 46, borderRadius: 13, backgroundColor: colors.ink, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  btnOk: { backgroundColor: colors.softGreen },
  btnText: { fontFamily: fonts.body700, fontSize: 15.5, color: colors.paper },
});
