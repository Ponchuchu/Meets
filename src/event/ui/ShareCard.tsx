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

// 4:5, как пост в Instagram: снимок 1080×1350 без скруглений (скруглённые углы в мессенджерах становились чёрными).
const W = 324, H = 405;
const SCALE = 1080 / W;

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

/** Первая фраза описания целиком (до ~140 знаков), без обрыва на полуслове. */
export function shortAbout(about: string, max = 140): string {
  const t = about.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const sentence = t.slice(0, max).match(/^.*[.!?](?=\s|$)/)?.[0];
  if (sentence && sentence.length > 50) return sentence;
  const cut = t.slice(0, max).replace(/[\s,;:—-]+\S*$/, '');
  return `${cut}…`;
}

/** Сама карточка — её же снимаем в картинку. */
export function ShareCard({ e, now }: { e: EventItem; now: Date }) {
  const f = eventFacts(e);
  const venue = e.venueName?.trim() || f.place;
  const address = e.venueName?.trim() && e.address?.trim() && e.address.trim() !== venue ? e.address.trim() : null;
  const about = e.about.trim() ? shortAbout(e.about) : '';
  return (
    <View style={styles.card} collapsable={false}>
      <View style={styles.photo}>
        <EventCover cover={e.cover} category={e.category} color={e.coverColor} style={StyleSheet.absoluteFill} iconSize={130}>
          <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" preserveAspectRatio="none">
            <Defs><LinearGradient id="shareShade" x1="0" y1="0" x2="0" y2="1"><Stop offset="0.5" stopColor="#17161A" stopOpacity={0} /><Stop offset="1" stopColor="#17161A" stopOpacity={0.5} /></LinearGradient></Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#shareShade)" />
          </Svg>
          <View style={styles.cat}><Text style={styles.catText}>{CAT_LABEL[e.category]}</Text></View>
          <View style={styles.stamp}><Text style={styles.stampText}>{stampOf(e, now)}</Text></View>
        </EventCover>
      </View>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={3} adjustsFontSizeToFit minimumFontScale={0.7}>{e.title}</Text>
        <View style={styles.fact}><Clock size={13} color={colors.ink} strokeWidth={2} /><Text style={styles.factText}>{f.when}</Text></View>
        <View style={[styles.fact, { alignItems: 'flex-start' }]}>
          <MapPin size={13} color={colors.ink} strokeWidth={2} style={{ marginTop: 2 }} />
          <View style={{ flex: 1 }}>
            <Text style={styles.factText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{venue}</Text>
            {address && <Text style={styles.addr} numberOfLines={2}>{address}</Text>}
          </View>
        </View>
        <View style={styles.fact}><Ticket size={13} color={colors.ink} strokeWidth={2} /><Text style={[styles.factText, { fontFamily: fonts.body700 }]}>{f.price}</Text></View>
        {!!about && <Text style={styles.about} numberOfLines={3}>{about}</Text>}
      </View>
      <View style={styles.brand}>
        <Image source={require('../../../assets/icon/icon.png')} style={styles.logo} />
        <Text style={styles.brandName}>Meets</Text>
        <Text style={styles.brandSub} numberOfLines={1}>события Алматы и друзья рядом</Text>
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
        const uri = await n.shot.captureRef(ref, { format: 'png', quality: 1, result: 'tmpfile', width: W * SCALE, height: H * SCALE });
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
      <View style={styles.shadow}><View style={styles.clip}><View ref={ref} collapsable={false}><ShareCard e={e} now={now} /></View></View></View>
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
  shadow: { borderRadius: 22, boxShadow: '0 18px 36px -18px rgba(23,22,26,0.55)' },
  clip: { borderRadius: 22, overflow: 'hidden' },
  card: { width: W, height: H, backgroundColor: '#F3EFE6' },
  photo: { height: H * 0.47, margin: 10, marginBottom: 0, borderRadius: 18, overflow: 'hidden' },
  cat: { position: 'absolute', left: 10, top: 10, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 9, backgroundColor: 'rgba(255,255,255,0.8)' },
  catText: { fontFamily: fonts.mono600, fontSize: 9.5, letterSpacing: 0.9, color: colors.ink },
  stamp: { position: 'absolute', left: 10, bottom: 10, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 9, backgroundColor: 'rgba(23,22,26,0.6)' },
  stampText: { fontFamily: fonts.mono600, fontSize: 10, letterSpacing: 0.8, color: '#EEE9DE' },
  body: { flex: 1, paddingHorizontal: 16, paddingTop: 10, gap: 5, overflow: 'hidden' },
  title: { fontFamily: fonts.display800, fontSize: 20, lineHeight: 23, letterSpacing: -0.5, color: colors.ink, marginBottom: 2 },
  fact: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  factText: { flexShrink: 1, fontFamily: fonts.body600, fontSize: 12.5, color: colors.ink },
  addr: { fontFamily: fonts.body400, fontSize: 11.5, lineHeight: 14, color: colors.muted2 },
  about: { fontFamily: fonts.body400, fontSize: 11.5, lineHeight: 15, color: colors.muted2, marginTop: 1 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, height: 44, backgroundColor: colors.ink },
  logo: { width: 26, height: 26, borderRadius: 7 },
  brandName: { fontFamily: fonts.display800, fontSize: 15, letterSpacing: -0.3, color: '#FFFFFF' },
  brandSub: { flex: 1, fontFamily: fonts.body500, fontSize: 10.5, color: '#BDB8AD' },
  actions: { flexDirection: 'row', gap: 8, alignSelf: 'stretch' },
  btn: { flexDirection: 'row', gap: 8, height: 54, borderRadius: 17, backgroundColor: '#EDE8DD', alignItems: 'center', justifyContent: 'center' },
  main: { flex: 1, backgroundColor: colors.accent },
  square: { width: 54 },
  btnText: { fontFamily: fonts.body700, fontSize: 16, color: colors.ink },
  pressed: { transform: [{ scale: 0.97 }] },
});
