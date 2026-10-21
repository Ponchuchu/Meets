// «Поделиться» картинкой (21 октября): вместо выбора мессенджера — красивая карточка события.
// Фото, дата и время, где, цена, пара строк описания, а внизу — значок и надпись Meets со ссылкой: тот, кому прислали,
// видит событие целиком и узнаёт приложение. Отправка — системным меню телефона (WhatsApp, Telegram, Instagram…).
import * as Clipboard from 'expo-clipboard';
import { Clock, Copy, MapPin, Send, Ticket } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { Image, Platform, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import type { EventItem } from '../../data/types';
import { CAT_LABEL } from '../../map/icons';
import { stampOf } from '../../map/ui/EventSheet';
import { colors, fonts } from '../../theme';
import { EventCover } from '../../ui/EventCover';
import { eventFacts } from '../facts';

const W = 340, H = 460;

type Shot = { captureRef: (ref: unknown, opts: object) => Promise<string> };
type Sharing = { isAvailableAsync: () => Promise<boolean>; shareAsync: (uri: string, opts?: object) => Promise<void> };
// Нативных модулей нет в старой APK — тогда отправляем ссылку текстом, как раньше.
function native(): { shot: Shot; sharing: Sharing } | null {
  if (Platform.OS === 'web') return null;
  try {
    /* eslint-disable @typescript-eslint/no-require-imports */
    return { shot: require('react-native-view-shot') as Shot, sharing: require('expo-sharing') as Sharing };
    /* eslint-enable @typescript-eslint/no-require-imports */
  } catch { return null; }
}

/** Сама карточка — её же снимаем в картинку 3× (1020×1380). */
export function ShareCard({ e, now, link }: { e: EventItem; now: Date; link: string }) {
  const f = eventFacts(e);
  return (
    <View style={styles.card} collapsable={false}>
      <EventCover cover={e.cover} category={e.category} color={e.coverColor} style={{ height: H * 0.5 }} iconSize={150}>
        <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" preserveAspectRatio="none">
          <Defs><LinearGradient id="shareShade" x1="0" y1="0" x2="0" y2="1"><Stop offset="0.45" stopColor="#17161A" stopOpacity={0} /><Stop offset="1" stopColor="#17161A" stopOpacity={0.55} /></LinearGradient></Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#shareShade)" />
        </Svg>
        <View style={styles.cat}><Text style={styles.catText}>{CAT_LABEL[e.category]}</Text></View>
        <View style={styles.stamp}><Text style={styles.stampText}>{stampOf(e, now)}</Text></View>
      </EventCover>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={2}>{e.title}</Text>
        <View style={styles.fact}><Clock size={14} color={colors.ink} strokeWidth={2} /><Text style={styles.factText} numberOfLines={1}>{f.when}</Text></View>
        <View style={styles.fact}><MapPin size={14} color={colors.ink} strokeWidth={2} /><Text style={styles.factText} numberOfLines={1}>{f.place}</Text></View>
        <View style={styles.fact}><Ticket size={14} color={colors.ink} strokeWidth={2} /><Text style={[styles.factText, { fontFamily: fonts.body700 }]} numberOfLines={1}>{f.price}</Text></View>
        {!!e.about.trim() && <Text style={styles.about} numberOfLines={2}>{e.about.trim()}</Text>}
      </View>
      <View style={styles.brand}>
        <Image source={require('../../../assets/icon/icon.png')} style={styles.logo} />
        <View style={{ flex: 1 }}>
          <Text style={styles.brandName}>Meets</Text>
          <Text style={styles.brandSub} numberOfLines={1}>события Алматы и друзья рядом · {link.replace(/^https?:\/\//, '')}</Text>
        </View>
      </View>
    </View>
  );
}

/** Шторка «Поделиться»: превью картинки, «Отправить» и «Скопировать ссылку». */
export function ShareCardSheet({ e, now, link, text, onDone }: { e: EventItem; now: Date; link: string; text: string; onDone: (msg?: string) => void }) {
  const ref = useRef<View>(null);
  const [busy, setBusy] = useState(false);
  const send = async () => {
    if (busy) return;
    setBusy(true);
    const n = native();
    try {
      if (n && (await n.sharing.isAvailableAsync())) {
        const uri = await n.shot.captureRef(ref, { format: 'png', quality: 1, result: 'tmpfile', width: W * 3, height: H * 3 });
        await n.sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: e.title, UTI: 'public.png' });
        onDone();
        return;
      }
    } catch { /* снимок не получился — отправим ссылкой */ }
    finally { setBusy(false); }
    await Share.share({ message: `${text} ${link}` }).catch(() => undefined);
    onDone();
  };
  return (
    <View style={{ gap: 14, alignItems: 'center' }}>
      <Text style={styles.sheetTitle} accessibilityRole="header">Поделиться</Text>
      <View ref={ref} collapsable={false} style={styles.shadow}><ShareCard e={e} now={now} link={link} /></View>
      <View style={styles.actions}>
        <Pressable onPress={() => void send()} style={({ pressed }) => [styles.btn, styles.main, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel="Отправить картинку события">
          <Send size={18} color={colors.ink} strokeWidth={2.2} /><Text style={styles.btnText}>{busy ? 'Готовлю картинку…' : 'Отправить'}</Text>
        </Pressable>
        <Pressable onPress={() => { void Clipboard.setStringAsync(`${text} ${link}`).then(() => onDone('Ссылка скопирована')); }} style={({ pressed }) => [styles.btn, styles.square, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel="Скопировать ссылку">
          <Copy size={18} color={colors.ink} strokeWidth={2} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sheetTitle: { alignSelf: 'flex-start', fontFamily: fonts.display700, fontSize: 22, color: colors.ink },
  shadow: { borderRadius: 26, boxShadow: '0 18px 36px -18px rgba(23,22,26,0.55)' },
  card: { width: W, height: H, borderRadius: 26, overflow: 'hidden', backgroundColor: '#F3EFE6' },
  cat: { position: 'absolute', left: 14, top: 14, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.75)' },
  catText: { fontFamily: fonts.mono600, fontSize: 10, letterSpacing: 0.9, color: colors.ink },
  stamp: { position: 'absolute', left: 14, bottom: 12, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, backgroundColor: 'rgba(23,22,26,0.55)' },
  stampText: { fontFamily: fonts.mono600, fontSize: 10.5, letterSpacing: 0.8, color: '#EEE9DE' },
  body: { flex: 1, paddingHorizontal: 16, paddingTop: 12, gap: 6 },
  title: { fontFamily: fonts.display800, fontSize: 21, lineHeight: 24, letterSpacing: -0.5, color: colors.ink, marginBottom: 2 },
  fact: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  factText: { flex: 1, fontFamily: fonts.body600, fontSize: 13, color: colors.ink },
  about: { fontFamily: fonts.body400, fontSize: 12, lineHeight: 16, color: colors.muted2, marginTop: 2 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 11, backgroundColor: colors.ink },
  logo: { width: 34, height: 34, borderRadius: 9 },
  brandName: { fontFamily: fonts.display800, fontSize: 17, letterSpacing: -0.3, color: '#FFFFFF' },
  brandSub: { fontFamily: fonts.body500, fontSize: 10.5, color: '#BDB8AD' },
  actions: { flexDirection: 'row', gap: 8, alignSelf: 'stretch' },
  btn: { flexDirection: 'row', gap: 8, height: 54, borderRadius: 17, backgroundColor: '#EDE8DD', alignItems: 'center', justifyContent: 'center' },
  main: { flex: 1, backgroundColor: colors.accent },
  square: { width: 54 },
  btnText: { fontFamily: fonts.body700, fontSize: 16, color: colors.ink },
  pressed: { transform: [{ scale: 0.97 }] },
});
