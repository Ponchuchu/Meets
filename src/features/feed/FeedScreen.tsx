// «Рекомендации» v6 (V6.md §4.1): стопка из настоящих событий, свайпы без кнопок, «Пойду» улетает дугой в «Планы».
// «Мимо» — плашка на 5 с «Мимо: … · Вернуть» (не больше 10 возвратов за сессию). Кончились — V6Empty.
import { useQuery } from '@tanstack/react-query';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { tabCenter, tabInset } from '../../components/TabBar';
import { useTabBadges } from '../../state/tabBadges';
import { data, eventsSnapshot, type EventItem } from '../../data';
import { EventPage } from '../../event/EventPage';
import { SwipeCard, type SwipeHandle } from '../../feed/SwipeCard';
import { now as clockNow } from '../../lib/clock';
import { buildDeck, makeSignal, tasteFrom } from '../../reco';
import { useApp, useCoverTabBar } from '../../state/app';
import { track } from '../../analytics';
import { useFeed } from '../../state/feed';
import { usePlans } from '../../state/plans';
import { INITIAL_DRAFT, useSession } from '../../state/session';
import { colors, fonts } from '../../theme';
import { Toast, type ToastData } from '../../ui/Toast';

const STACK = 3;

export default function ForYouScreen() {
  const insets = useSafeAreaInsets();
  const { width: W, height: winH } = useWindowDimensions();
  const [H, setH] = useState(0); // высота экрана ленты (над таб-баром)
  const seenFeed = useApp((s) => s.seenFeed);
  useFocusEffect(useCallback(() => { seenFeed(); }, [seenFeed]));

  const now = useMemo(() => clockNow(), []);
  const { data: events = [] } = useQuery({ queryKey: ['events'], queryFn: () => data.getEvents(), placeholderData: eventsSnapshot });
  const { data: people = [] } = useQuery({ queryKey: ['people'], queryFn: () => data.getPeople() });
  const draft = useSession((s) => s.draft) ?? INITIAL_DRAFT;
  const { signals, decided, history, undosLeft, decide, addSignal, undo } = useFeed();
  const { go, ungo } = usePlans.getState();
  const addPlan = useApp((s) => s.addPlan);
  const removePlan = useApp((s) => s.removePlan);
  const pulsePlan = useApp((s) => s.pulsePlan);

  const [toast, setToast] = useState<ToastData | null>(null);
  const [enter, setEnter] = useState<{ id: string; from: 'go' | 'skip' } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [open, setOpen] = useState<EventItem | null>(null);
  const opened = useRef(new Set<string>());
  useCoverTabBar(!!open);
  const topRef = useRef<SwipeHandle>(null);

  // Вкус = ответы регистрации + свайпы. Колода пересчитывается после каждого решения.
  const answers = { interests: draft.interests ?? INITIAL_DRAFT.interests, times: draft.times ?? INITIAL_DRAFT.times, withWho: draft.withWho ?? 'friends', budget: draft.budget ?? 'mid' };
  const taste = useMemo(() => tasteFrom(answers, signals, now), [signals, now, answers.interests, answers.times, answers.withWho, answers.budget]); // eslint-disable-line react-hooks/exhaustive-deps
  const deck = useMemo(() => {
    const swipes = history.length;
    const dec = new Set(Object.keys(decided));
    let d = buildDeck(taste, events, { decided: dec, swipes }, { now }, { size: 10 });
    // Нет дна: когда кандидаты кончились — возвращаем пропущенные (ослабляем фильтры).
    if (d.length < STACK) d = [...d, ...buildDeck(taste, events, { decided: new Set(Object.keys(decided).filter((id) => decided[id] === 'go')), swipes }, { now }, { size: 10 }).filter((x) => !d.includes(x))];
    // «Вернуть»: возвращённая карточка снова первая.
    if (enter && !decided[enter.id]) {
      const back = d.find((x) => x.id === enter.id) ?? events.find((x) => x.id === enter.id);
      if (back) d = [back, ...d.filter((x) => x.id !== enter.id)];
    }
    return d;
  }, [taste, events, decided, history.length, now, enter]);

  const cardTop = Math.max(50, insets.top + 6) + 62;
  // Таб-бар плавает поверх: карточки и кнопки — над ним, раскрытое событие — на весь экран.
  const fullH = H || winH;
  const screenH = fullH - tabInset(insets.bottom) + 10;
  const cardW = Math.min(350, W - 40);
  const cardH = Math.max(350, Math.min(510, screenH - cardTop - 30));
  const cardX = (W - cardW) / 2;
  // Центр иконки «Планы» на панели относительно центра карточки.
  const plansIcon = tabCenter(2, W, fullH, insets.bottom);
  const target = { x: plansIcon.x - (cardX + cardW / 2), y: plansIcon.y - (cardTop + cardH / 2) };

  const showToast = (t: ToastData | null, ms = 4000) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(t);
    if (t) toastTimer.current = setTimeout(() => setToast(null), ms);
  };

  const onDecide = (e: EventItem, kind: 'go' | 'skip') => {
    const sig = makeSignal(e, kind === 'skip' && opened.current.has(e.id) ? 'skipAfterOpen' : kind, clockNow());
    decide({ eventId: e.id, kind, signalId: sig.id }, sig);
    track(kind, e.id);
    setEnter(null);
    if (kind === 'go') {
      go(e.id);
      addPlan();
      pulsePlan();
    } else if (undosLeft > 0) {
      showToast({ text: `Мимо: ${e.title}`, cta: 'Вернуть', onCta: () => doUndo() }, 5000);
    }
  };

  // «Вернуть» / «Отменить»: сигнал стирается целиком, карточка снова первая.
  function doUndo() {
    const last = undo();
    showToast(null);
    if (!last) return;
    // «Отменить» после «пойду» считается в ungo как cancel_plan, «вернуть» после «мимо» — здесь.
    if (last.kind === 'go') { ungo(last.eventId); removePlan(); } else track('undo', last.eventId);
    setEnter({ id: last.eventId, from: last.kind });
  }

  const top = deck[0];
  useEffect(() => track('feed_open'), []);
  useEffect(() => { if (top) track('card_shown', top.id); }, [top?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Раскрытие события из прямоугольника карточки (~350 мс) и обратно.
  const p = useSharedValue(0);
  const openCard = (e: EventItem, interactive = false) => {
    if (!opened.current.has(e.id)) { opened.current.add(e.id); addSignal(makeSignal(e, 'open', clockNow())); track('event_open', e.id); }
    showToast(null);
    setOpen(e);
    if (interactive) return;
    p.value = 0;
    p.value = withTiming(1, { duration: 350, easing: Easing.bezier(0.2, 0.8, 0.3, 1) });
  };
  const closeCard = (then?: () => void) => {
    p.value = withTiming(0, { duration: 240, easing: Easing.in(Easing.quad) }, () => {
      scheduleOnRN(setOpen, null);
      if (then) scheduleOnRN(then);
    });
  };
  const clip = useAnimatedStyle(() => ({
    left: cardX * (1 - p.value),
    top: cardTop * (1 - p.value),
    width: cardW + (W - cardW) * p.value,
    height: cardH + (fullH - cardH) * p.value,
    borderRadius: 30 * (1 - p.value),
    opacity: 1,
  }));
  const clipInner = useAnimatedStyle(() => ({ left: -cardX * (1 - p.value), top: -cardTop * (1 - p.value) }));

  return (
    <View style={styles.root} onLayout={(ev) => setH(ev.nativeEvent.layout.height)}>
      <View style={[styles.head, { top: Math.max(50, insets.top + 6) }]}>
        <Text style={styles.h1} accessibilityRole="header">Рекомендации</Text>
      </View>

      <View style={{ position: 'absolute', left: cardX, top: cardTop, width: cardW, height: cardH }}>
        {deck.slice(0, STACK).map((e, k) => (
          <SwipeCard
            key={e.id}
            ref={k === 0 ? topRef : undefined}
            e={e} people={people} now={now}
            k={k} top={k === 0} width={cardW} height={cardH} target={target}
            enterFrom={enter?.id === e.id ? enter.from : null}
            onDecide={(kind) => onDecide(e, kind)}
            onLand={() => useTabBadges.getState().landPlans()}
            onTap={() => openCard(e)}
            expand={p} onReveal={() => openCard(e, true)}
            onRevealEnd={(commit) => { if (commit) p.set(withTiming(1, { duration: 240, easing: Easing.out(Easing.cubic) })); else closeCard(); }}
            onUndo={doUndo}
          />
        )).reverse()}
      </View>

      {!top && (
        <View style={[styles.emptyBox, { top: cardTop + 40 }]}>
          {events.length === 0 ? <Text style={styles.emptySub}>Загружаю события…</Text> : (
            <>
              <Text style={styles.emptyTitle}>Ты всё посмотрел</Text>
              <Text style={styles.emptySub}>Новые события появятся вечером. А пока — что на карте прямо сейчас.</Text>
              <Pressable onPress={() => router.navigate('/')} style={({ pressed }) => [styles.emptyBtn, pressed && { transform: [{ scale: 0.97 }] }]} accessibilityRole="button">
                <Text style={styles.emptyBtnText}>Открыть карту</Text>
              </Pressable>
            </>
          )}
        </View>
      )}

      {toast && <Toast t={toast} style={{ position: 'absolute', left: 16, right: 16, top: cardTop + cardH - 70 }} />}

      {open && (
        <Animated.View style={[styles.clip, clip]}>
          <Animated.View style={[{ position: 'absolute', width: W, height: fullH }, clipInner]}>
            <EventPage e={open} now={now} closeLabel="Свернуть обратно в карточку" onClose={() => closeCard()} onSkip={() => closeCard(() => topRef.current?.fly('skip'))}
              onGo={() => closeCard(() => topRef.current?.fly('go'))} />
          </Animated.View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper, overflow: 'hidden' },
  head: { position: 'absolute', left: 16, right: 16, gap: 2 },
  h1: { fontFamily: fonts.display800, fontSize: 30, letterSpacing: -0.9, lineHeight: 34, color: colors.ink },
  emptyBox: { position: 'absolute', left: 32, right: 32, alignItems: 'center', gap: 10, paddingTop: 220 },
  emptyTitle: { fontFamily: fonts.display700, fontSize: 24, letterSpacing: -0.5, color: colors.ink, textAlign: 'center' },
  emptySub: { fontFamily: fonts.body400, fontSize: 15, lineHeight: 21, color: colors.muted, textAlign: 'center' },
  emptyBtn: { marginTop: 10, height: 50, paddingHorizontal: 26, borderRadius: 16, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  emptyBtnText: { fontFamily: fonts.body700, fontSize: 15.5, color: colors.paper },
  clip: { position: 'absolute', overflow: 'hidden', zIndex: 50 },
});
