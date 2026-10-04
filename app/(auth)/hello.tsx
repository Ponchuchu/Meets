// Привет — design/png/V5Login.png. В альфе вход только по номеру (docs/ALPHA.md §1).
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Rect } from 'react-native-svg';
import { colors, fonts } from '../../src/theme';
import { AppleMark, GoogleMark } from '../../src/ui/v6/BrandIcons';
import { Hand } from '../../src/ui/v6/Hand';
import { MascotField } from '../../src/ui/v6/Mascot';
import { OrangeBg } from '../../src/ui/v6/OrangeBg';

export default function Hello() {
  const insets = useSafeAreaInsets();
  const [note, setNote] = useState<string | null>(null);
  const soon = (text: string) => { setNote(text); setTimeout(() => setNote(null), 2600); };

  return (
    <View style={styles.root}>
      <View style={[styles.top, { paddingTop: insets.top }]}>
        <OrangeBg />
        <View style={[styles.field, { top: insets.top }]}><MascotField variant="hello" /></View>
        <View style={styles.word}>
          <Hand text="привет" size={74} />
          <Text style={styles.lead}>Карта событий Алматы и друзья,{'\n'}которые рядом</Text>
        </View>
      </View>
      <View style={[styles.bottom, { paddingBottom: insets.bottom + 34 }]}>
        {note && (
          <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.note}>
            <Text style={styles.noteText}>{note}</Text>
          </Animated.View>
        )}
        <Pressable onPress={() => router.push('/phone')} style={({ pressed }) => [styles.main, pressed && styles.pressed]} accessibilityRole="button">
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
            <Rect x={6} y={2.5} width={12} height={19} rx={2.5} stroke={colors.paper} strokeWidth={1.8} />
            <Path d="M11 18h2" stroke={colors.paper} strokeWidth={1.8} strokeLinecap="round" />
          </Svg>
          <Text style={styles.mainText}>Войти по номеру</Text>
        </Pressable>
        <View style={styles.row}>
          <Pressable onPress={() => soon('В альфе вход только по номеру')} style={({ pressed }) => [styles.alt, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel="Войти через Apple">
            <AppleMark size={17} />
            <Text style={styles.altText}>Apple</Text>
          </Pressable>
          <Pressable onPress={() => soon('В альфе вход только по номеру')} style={({ pressed }) => [styles.alt, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel="Войти через Google">
            <GoogleMark size={17} />
            <Text style={styles.altText}>Google</Text>
          </Pressable>
        </View>
        <Pressable onPress={() => soon('В альфе карта открывается после входа')} style={styles.peek} accessibilityRole="button" hitSlop={8}>
          <Text style={styles.peekText}>Сначала посмотреть карту</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  top: { flex: 1, overflow: 'hidden', justifyContent: 'flex-end' },
  field: { position: 'absolute', left: '50%', marginLeft: -195, width: 390, height: 320 },
  word: { paddingHorizontal: 24, paddingBottom: 84, gap: 10 },
  lead: { fontFamily: fonts.body700, fontSize: 17, lineHeight: 24, color: '#FFFFFF' },
  bottom: { paddingHorizontal: 20, paddingTop: 80, gap: 10 },
  main: { height: 56, borderRadius: 16, backgroundColor: colors.ink, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  mainText: { fontFamily: fonts.body700, fontSize: 17, color: colors.paper },
  row: { flexDirection: 'row', gap: 10 },
  alt: { flex: 1, height: 52, borderRadius: 16, backgroundColor: colors.card, borderWidth: 1.5, borderColor: '#DDD8CC', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  altText: { fontFamily: fonts.body700, fontSize: 15, color: colors.ink },
  pressed: { transform: [{ scale: 0.98 }] },
  peek: { alignSelf: 'center', minHeight: 44, justifyContent: 'center', marginTop: 4 },
  peekText: { fontFamily: fonts.body700, fontSize: 15, color: colors.ink, textDecorationLine: 'underline' },
  note: { position: 'absolute', top: 18, left: 20, right: 20, alignItems: 'center' },
  noteText: { fontFamily: fonts.body600, fontSize: 13.5, color: colors.paper, backgroundColor: colors.ink, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, overflow: 'hidden' },
});
