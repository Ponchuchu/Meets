// Обучение V6Tutorial (V6.md §2.3): затемнение с вырезом-«прожектором» поверх настоящих экранов и карточка.
// Один раз: флаг на телефоне (useSession.tutorialDone) и на сервере (profile_settings.tutorial_done).
// Шаг «Рекомендации» — нужно нажать саму вкладку: в вырезе касания проходят насквозь.
import { useQuery } from '@tanstack/react-query';
import { router, usePathname } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, FadeOut, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { tabGap } from '../../components/TabBar';
import { config } from '../../lib/config';
import { getSettings, setSetting } from '../../live/api';
import { useSession } from '../../state/session';
import { colors, fonts } from '../../theme';
import { useIntro } from './Splash';

type Hole = { x: number; y: number; w: number; h: number; r: number } | null;
interface Step { id: string; title: string; text: string; btn?: string; tapTab?: string }

export const TUTORIAL: Step[] = [
  { id: 'map', title: 'Это карта', text: 'Тут всё, что происходит рядом сегодня и завтра. Нажми на точку — откроется событие.' },
  { id: 'top', title: 'Поиск и фильтры', text: 'Найди событие по названию. В фильтрах — дата, цена и разделы. Слева — погода.' },
  { id: 'lens', title: 'Слои карты', text: 'Обычная карта, пробки или «Где я был» — какие районы ты уже открыл.' },
  { id: 'friends', title: 'Тут друзья', text: 'Ты видишь друзей, а они — тебя. Больше никто. Невидимка — в профиле.' },
  { id: 'feed', title: 'Рекомендации', text: 'Нажми сюда — тут события, подобранные под тебя.', tapTab: 'foryou' },
  { id: 'swipe', title: 'Смахивай', text: 'Вправо — пойду. Влево — не моё. Вверх — посмотреть подробнее.', btn: 'Понятно' },
  { id: 'plans', title: 'Планы', text: 'Всё, куда ты идёшь, и куда тебя зовут друзья. За час напомним.' },
  { id: 'chats', title: 'Чаты', text: 'Друзья и компании на событие. Стикеры и «я тут» — одним касанием.' },
  { id: 'me', title: 'Профиль', text: 'Твои места, кто тебя видит, невидимка и настройки.' },
  { id: 'done', title: 'Вот и всё', text: 'Дальше разберёшься сам — подсказки больше не появятся.', btn: 'Начать' },
];

/** Геометрия нижней панели (TabBar): центр вкладки i из 5. */
function tabCenter(i: number, W: number, H: number, bottom: number) {
  const bar = Math.min(366, W * 0.94);
  const left = (W - bar) / 2 + 5;
  const cell = (bar - 10 - 8) / 5;
  return { x: left + i * (cell + 2) + cell / 2, y: H - tabGap(bottom) - 33 };
}

function holeFor(id: string, W: number, H: number, top: number, bottom: number): Hole {
  const tab = (i: number) => { const c = tabCenter(i, W, H, bottom); return { x: c.x - 30, y: c.y - 30, w: 60, h: 60, r: 30 }; };
  switch (id) {
    case 'map': return { x: W / 2 - 80, y: H * 0.42 - 50, w: 160, h: 100, r: 28 };
    case 'top': return { x: 12, y: top + 2, w: W - 24, h: 62, r: 31 };
    case 'lens': return { x: W - 168, y: top + 4, w: 58, h: 58, r: 29 };
    case 'friends': return { x: W / 2 - 60, y: H * 0.62 - 60, w: 120, h: 120, r: 60 };
    case 'feed': return tab(1);
    case 'swipe': return { x: 16, y: top + 40, w: W - 32, h: H * 0.58, r: 28 };
    case 'plans': return tab(2);
    case 'chats': return tab(3);
    case 'me': return tab(4);
    default: return null;
  }
}

const rr = (h: NonNullable<Hole>) => {
  const { x, y, w, h: hh, r } = h;
  return `M${x + r} ${y}H${x + w - r}A${r} ${r} 0 0 1 ${x + w} ${y + r}V${y + hh - r}A${r} ${r} 0 0 1 ${x + w - r} ${y + hh}H${x + r}A${r} ${r} 0 0 1 ${x} ${y + hh - r}V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`;
};

export function Tutorial() {
  const done = useSession((s) => s.tutorialDone);
  const setDone = useSession((s) => s.setTutorialDone);
  const splash = useIntro((s) => s.splash);
  const live = config.dataMode !== 'demo';
  // Новый телефон: обучение уже проходили — флаг на сервере.
  const server = useQuery({ queryKey: ['me', 'settings'], queryFn: getSettings, enabled: live && !done });
  useEffect(() => { if (server.data?.tutorial_done) setDone(true); }, [server.data, setDone]);
  const waiting = live && server.isPending;
  if (done || splash || waiting || server.data?.tutorial_done) return null;
  return <Run onFinish={() => { setDone(true); if (live) void setSetting('tutorial_done', true).catch(() => undefined); }} />;
}

function Run({ onFinish }: { onFinish: () => void }) {
  const { width: W, height: H } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const path = usePathname();
  const [i, setI] = useState(0);
  const step = TUTORIAL[i];
  const top = insets.top + 8;
  const hole = holeFor(step.id, W, H, top, insets.bottom);
  const next = () => (i + 1 < TUTORIAL.length ? setI(i + 1) : onFinish());

  // Шаги по вкладкам: показываем нужный экран под подсказкой.
  useEffect(() => {
    if (step.id === 'map' && path !== '/') router.navigate('/');
    if (step.id === 'done' && path !== '/') router.navigate('/');
  }, [step.id]); // eslint-disable-line react-hooks/exhaustive-deps
  // Нажал нужную вкладку — следующий шаг (обновление состояния во время рендера, без лишнего эффекта).
  if (step.tapTab && path === `/${step.tapTab}`) setI(i + 1);

  // Плавный переезд выреза между шагами.
  const fade = useSharedValue(0);
  useEffect(() => { fade.set(0); fade.set(withTiming(1, { duration: 260 })); }, [i, fade]);
  const holeSt = useAnimatedStyle(() => ({ opacity: fade.get() }));

  const cardBelow = hole ? hole.y + hole.h / 2 < H / 2 : false;
  const cardPos = !hole ? { top: H / 2 - 120 } : cardBelow ? { top: hole.y + hole.h + 18 } : { bottom: H - hole.y + 18 };
  const blockers = hole ? [
    { left: 0, top: 0, width: W, height: hole.y },
    { left: 0, top: hole.y + hole.h, width: W, height: H - hole.y - hole.h },
    { left: 0, top: hole.y, width: hole.x, height: hole.h },
    { left: hole.x + hole.w, top: hole.y, width: W - hole.x - hole.w, height: hole.h },
  ] : [{ left: 0, top: 0, width: W, height: H }];

  return (
    <Animated.View style={StyleSheet.absoluteFill} entering={FadeIn.duration(300)} exiting={FadeOut.duration(200)} pointerEvents="box-none">
      <Animated.View style={[StyleSheet.absoluteFill, holeSt]} pointerEvents="none">
        <Svg width={W} height={H}>
          <Path d={`M0 0H${W}V${H}H0Z${hole ? rr(hole) : ''}`} fill="rgba(23,22,26,0.55)" fillRule="evenodd" />
          {hole && <Path d={rr(hole)} fill="none" stroke="rgba(251,250,246,0.9)" strokeWidth={2} />}
        </Svg>
      </Animated.View>
      {blockers.map((b, k) => <View key={k} style={[styles.block, b]} onStartShouldSetResponder={() => true} />)}
      {/* В вырезе касание проходит к экрану только там, где это нужно (вкладка «Рекомендации»); иначе — блок. */}
      {hole && !step.tapTab && <View style={[styles.block, { left: hole.x, top: hole.y, width: hole.w, height: hole.h }]} onStartShouldSetResponder={() => true} />}
      <Animated.View key={step.id} entering={FadeIn.duration(240)} style={[styles.card, cardPos]}>
        <View style={styles.cardHead}>
          <View style={styles.dots} accessibilityLabel={`Подсказка ${i + 1} из ${TUTORIAL.length}`}>
            {TUTORIAL.map((s, k) => <View key={s.id} style={[styles.dot, k === i && styles.dotOn, k < i && { backgroundColor: '#BDB6A8' }]} />)}
          </View>
          {step.id !== 'done' && (
            <Pressable onPress={onFinish} hitSlop={12} accessibilityRole="button" style={{ minHeight: 32, justifyContent: 'center' }}>
              <Text style={styles.skip}>Пропустить</Text>
            </Pressable>
          )}
        </View>
        <Text style={styles.title} accessibilityRole="header">{step.title}</Text>
        <Text style={styles.text}>{step.text}</Text>
        {step.tapTab ? (
          <Text style={styles.tapHint}>Нажми на вкладку внизу</Text>
        ) : (
          <Pressable onPress={next} style={({ pressed }) => [styles.btn, pressed && { transform: [{ scale: 0.97 }] }]} accessibilityRole="button">
            <Text style={styles.btnText}>{step.btn ?? 'Дальше'}</Text>
          </Pressable>
        )}
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  block: { position: 'absolute' },
  card: { position: 'absolute', left: 20, right: 20, borderRadius: 26, backgroundColor: '#FBFAF6', padding: 20, gap: 8, shadowColor: colors.ink, shadowOpacity: 0.25, shadowRadius: 20, shadowOffset: { width: 0, height: 12 }, elevation: 14 },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  dots: { flexDirection: 'row', gap: 5, alignItems: 'center' },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#DDD8CC' },
  dotOn: { width: 18, backgroundColor: colors.accent },
  skip: { fontFamily: fonts.body700, fontSize: 14, color: colors.muted },
  title: { fontFamily: fonts.display800, fontSize: 24, letterSpacing: -0.6, color: colors.ink },
  text: { fontFamily: fonts.body400, fontSize: 16, lineHeight: 23, color: colors.muted2 },
  btn: { alignSelf: 'flex-start', marginTop: 10, height: 48, paddingHorizontal: 22, borderRadius: 14, backgroundColor: colors.accent, justifyContent: 'center' },
  btnText: { fontFamily: fonts.body700, fontSize: 16, color: colors.ink },
  tapHint: { marginTop: 8, fontFamily: fonts.mono600, fontSize: 11.5, letterSpacing: 0.6, color: colors.accentText, textTransform: 'uppercase' },
});
