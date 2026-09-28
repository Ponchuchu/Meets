// «Предложить событие» — design/png/Suggest.png. Ссылка или скрин → поля заполняются → человек проверяет → в очередь модерации.
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { MapBase } from '../src/components/MapBase';
import { useProfile } from '../src/state/profile';
import { colors, fonts } from '../src/theme';
import { Ic, IC } from '../src/ui/Ic';
import { BackButton, Chip } from '../src/ui/kit';

type Source = 'link' | 'shot';

// Демо-разбор: ИИ-пайплайн (этап 9) вытащит поля из поста. Пока — пример из макета.
const EXTRACTED = { title: 'Винил-вечер: пластинки 70-х', date: 'Пт, 2 октября', time: '20:00', place: 'Кофейня на Жибек Жолы', cat: 'Музыка', price: '2 000 ₸' };

export default function SuggestScreen() {
  const insets = useSafeAreaInsets();
  const suggest = useProfile((s) => s.suggest);
  const [source, setSource] = useState<Source>('shot');
  const [link, setLink] = useState('');
  // ?sample=1 — открыть сразу с разобранной афишей-примером (для демонстрации и скриншотов).
  const { sample } = useLocalSearchParams<{ sample?: string }>();
  const [attached, setAttached] = useState<string | null>(sample ? 'Афиша из Threads' : null);
  const [f, setF] = useState<typeof EXTRACTED | null>(sample ? EXTRACTED : null);
  const [pinChecked, setPinChecked] = useState(false);
  const [priceChecked, setPriceChecked] = useState(false);
  const [sent, setSent] = useState(false);
  const x = useSharedValue(0);
  const y = useSharedValue(0);

  const extract = (label: string) => {
    setAttached(label);
    setF(EXTRACTED);
    setPinChecked(false);
    setPriceChecked(false);
  };
  const pickShot = async () => {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
      if (!res.canceled) extract('Афиша из галереи');
    } catch {
      extract('Афиша из Threads');
    }
  };
  const drag = Gesture.Pan()
    .onChange((e) => { x.value += e.changeX; y.value += e.changeY; })
    .onEnd(() => scheduleOnRN(setPinChecked, true));
  const pin = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }, { translateY: y.value }] }));
  const toCheck = (pinChecked ? 0 : 1) + (priceChecked ? 0 : 1);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/me'));

  if (sent) {
    return (
      <View style={[styles.root, { paddingTop: Math.max(50, insets.top + 6), paddingHorizontal: 16, gap: 16 }]}>
        <BackButton onPress={back} />
        <View style={styles.done}>
          <View style={styles.doneIcon}><Ic d={IC.check} size={24} color={colors.ink} w={2.6} /></View>
          <Text style={styles.h2}>Отправили на проверку</Text>
          <Text style={styles.hint}>Команда посмотрит в течение дня. После проверки «{f?.title}» появится на карте у всех — и у тебя в хронике.</Text>
        </View>
        <Pressable onPress={back} style={styles.cta} accessibilityRole="button"><Text style={styles.ctaText}>Готово</Text></Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ paddingTop: Math.max(50, insets.top + 6), paddingHorizontal: 16, paddingBottom: 40 + insets.bottom, gap: 14 }} keyboardShouldPersistTaps="handled">
        <View style={styles.head}>
          <BackButton onPress={back} />
          <Text style={styles.h1} accessibilityRole="header">Предложить событие</Text>
        </View>
        <Text style={styles.lead}>Кинь ссылку на пост или скрин афиши. Мы сами вытащим дату, время и место — тебе останется проверить.</Text>

        <View style={{ flexDirection: 'row', gap: 10 }}>
          {([['link', 'Вставить ссылку', 'M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1'], ['shot', 'Скрин афиши', 'M4 5h16v14H4zM4 15l5-5 4 4 3-3 4 4']] as [Source, string, string][]).map(([k, label, d]) => {
            const on = source === k;
            return (
              <Pressable key={k} onPress={() => { setSource(k); if (k === 'shot') pickShot(); }} style={[styles.src, on && { borderColor: colors.ink, borderWidth: 1.5 }]} accessibilityRole="button" accessibilityState={{ selected: on }}>
                <Ic d={d} size={20} color={colors.ink} />
                <Text style={[styles.srcText, on && { fontFamily: fonts.body700 }]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>

        {source === 'link' && !attached && (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput value={link} onChangeText={setLink} placeholder="https://t.me/… или threads.net/…" placeholderTextColor={colors.muted3} style={[styles.field, { flex: 1 }]} autoCapitalize="none" accessibilityLabel="Ссылка на пост" />
            <Pressable disabled={!link.trim()} onPress={() => extract(/threads/.test(link) ? 'Пост из Threads' : /t\.me/.test(link) ? 'Пост из Telegram' : 'Ссылка на афишу')} style={[styles.go, !link.trim() && { backgroundColor: colors.sand }]} accessibilityRole="button" accessibilityLabel="Разобрать ссылку">
              <Ic d="M5 12h14M13 6l6 6-6 6" size={18} color={link.trim() ? colors.paper : colors.muted3} w={2.2} />
            </Pressable>
          </View>
        )}

        {attached && (
          <View style={styles.attached}>
            <View style={styles.thumb}><Text style={styles.thumbText}>{source === 'shot' ? 'СКРИН' : 'ССЫЛКА'}</Text></View>
            <Text style={[styles.label, { flex: 1, fontFamily: fonts.body600, color: colors.ink, fontSize: 15 }]}>{attached}</Text>
            <Pressable onPress={() => { setAttached(null); setF(null); }} hitSlop={10} accessibilityRole="button" accessibilityLabel="Убрать"><Ic d={IC.close} size={18} color={colors.ink} w={2.2} /></Pressable>
          </View>
        )}

        {f && (
          <>
            <View style={styles.resultHead}>
              <Text style={styles.h2}>Что получилось</Text>
              {toCheck > 0 && <View style={styles.check}><Text style={styles.checkText}>ПРОВЕРЬ {toCheck} {toCheck === 1 ? 'ПОЛЕ' : 'ПОЛЯ'}</Text></View>}
            </View>
            <View style={{ gap: 6 }}>
              <Text style={styles.label}>Название</Text>
              <TextInput value={f.title} onChangeText={(title) => setF({ ...f, title })} style={styles.field} accessibilityLabel="Название" />
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1, gap: 6 }}><Text style={styles.label}>Дата</Text><TextInput value={f.date} onChangeText={(date) => setF({ ...f, date })} style={styles.field} accessibilityLabel="Дата" /></View>
              <View style={{ flex: 1, gap: 6 }}><Text style={styles.label}>Время</Text><TextInput value={f.time} onChangeText={(time) => setF({ ...f, time })} style={styles.field} accessibilityLabel="Время" /></View>
            </View>
            <View style={{ gap: 6 }}>
              <Text style={styles.label}>Место</Text>
              <TextInput value={f.place} onChangeText={(place) => setF({ ...f, place })} style={[styles.field, !pinChecked && styles.warn]} accessibilityLabel="Место" />
              {!pinChecked && <Text style={styles.warnText}>Адрес неточный — поставь точку на карте</Text>}
            </View>
            <View style={styles.map}>
              <View style={{ position: 'absolute', left: -20, top: -140 }} pointerEvents="none"><MapBase theme="paper" /></View>
              <GestureDetector gesture={drag}>
                <Animated.View style={[styles.pinWrap, pin]} accessibilityLabel="Точка события — перетащи" accessible>
                  <View style={styles.pin}><Ic d="M9 18V5l11-2v13M6 21a3 3 0 100-6 3 3 0 000 6zM17 19a3 3 0 100-6 3 3 0 000 6z" size={20} color={colors.ink} w={2.2} /></View>
                </Animated.View>
              </GestureDetector>
              <Pressable onPress={() => setPinChecked(true)} style={styles.drag} accessibilityRole="button"><Text style={styles.dragText}>{pinChecked ? 'ТОЧКА НА МЕСТЕ' : 'ПЕРЕТАЩИ ПИН'}</Text></Pressable>
            </View>
            <View style={{ gap: 8 }}>
              <Text style={styles.label}>Категория</Text>
              <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                {['Музыка', 'Искусство', 'Еда'].map((c) => <Chip key={c} label={c} on={f.cat === c} onPress={() => setF({ ...f, cat: c })} />)}
              </View>
            </View>
            <View style={{ gap: 6 }}>
              <Text style={styles.label}>Цена</Text>
              <TextInput value={f.price} onChangeText={(price) => { setF({ ...f, price }); setPriceChecked(true); }} onFocus={() => setPriceChecked(true)} style={[styles.field, !priceChecked && styles.warn]} accessibilityLabel="Цена" />
              {!priceChecked && <Text style={styles.warnText}>На афише мелко — проверь сумму</Text>}
            </View>
            <Pressable onPress={() => { suggest(f.title); setSent(true); }} style={styles.cta} accessibilityRole="button"><Text style={styles.ctaText}>Отправить на проверку</Text></Pressable>
            <Text style={styles.hint}>После проверки событие появится на карте у всех</Text>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  head: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  h1: { fontFamily: fonts.display700, fontSize: 19, color: colors.ink },
  h2: { fontFamily: fonts.display700, fontSize: 21, color: colors.ink },
  lead: { fontFamily: fonts.body400, fontSize: 15, lineHeight: 22, color: colors.muted2 },
  src: { flex: 1, height: 76, borderRadius: 18, borderWidth: 1, borderColor: colors.line2, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', gap: 6 },
  srcText: { fontFamily: fonts.body500, fontSize: 14, color: colors.ink },
  go: { width: 52, height: 52, borderRadius: 16, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  attached: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 10, borderRadius: 16, backgroundColor: colors.sand },
  thumb: { width: 52, height: 64, borderRadius: 6, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  thumbText: { fontFamily: fonts.mono600, fontSize: 9.5, color: colors.paper },
  resultHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  check: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8, backgroundColor: colors.accent },
  checkText: { fontFamily: fonts.mono600, fontSize: 10, letterSpacing: 0.5, color: colors.ink },
  label: { fontFamily: fonts.body500, fontSize: 13, color: colors.muted2 },
  field: { height: 50, paddingHorizontal: 16, borderWidth: 1, borderColor: colors.line2, borderRadius: 16, backgroundColor: colors.card, fontFamily: fonts.body400, fontSize: 15, color: colors.ink },
  warn: { borderColor: colors.accent, borderWidth: 1.5 },
  warnText: { fontFamily: fonts.body400, fontSize: 12.5, color: colors.accentText },
  map: { height: 160, borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: colors.line, backgroundColor: '#EFEBE2' },
  pinWrap: { position: 'absolute', left: '50%', top: 40, marginLeft: -26 },
  pin: { width: 52, height: 52, borderRadius: 17, backgroundColor: colors.accent, borderWidth: 3, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  drag: { position: 'absolute', left: '50%', bottom: 12, transform: [{ translateX: -52 }], paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: colors.ink },
  dragText: { fontFamily: fonts.mono600, fontSize: 9.5, letterSpacing: 0.5, color: colors.paper },
  cta: { height: 56, marginTop: 6, borderRadius: 16, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  ctaText: { fontFamily: fonts.body600, fontSize: 16, color: colors.paper },
  hint: { textAlign: 'center', fontFamily: fonts.body400, fontSize: 13, color: colors.muted2 },
  done: { padding: 20, borderRadius: 24, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, gap: 10, alignItems: 'flex-start' },
  doneIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
});
