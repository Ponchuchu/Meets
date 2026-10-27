// «Рекомендации» v6 (V6.md §4.1): стопка из настоящих событий, свайпы без кнопок, «Пойду» улетает дугой в «Планы».
// «Мимо» — плашка на 5 с «Мимо: … · Вернуть» (не больше 10 возвратов за сессию). Кончились — V6Empty.
import { NONE } from '../../lib/empty';
import { useQuery } from '@tanstack/react-query';
import { useNet } from '../../live/net';
import { StateView } from '../../ui/StateView';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, Extrapolation, interpolate, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { tabCenter, tabInset } from '../../components/TabBar';
import { useTabBadges } from '../../state/tabBadges';
import { data, eventsSnapshot, type EventItem } from '../../data';
import { LazyEventPage } from '../../event/LazyEventPage';
import { FeedCard } from '../../feed/FeedCard';
import { SwipeCard, type SwipeHandle } from '../../feed/SwipeCard';
import { QuickButtons } from '../../feed/SwipeHints';
import { UndoBar } from '../../feed/UndoBar';
import { WhenSheet, needsWhen } from '../../feed/WhenSheet';
import { now as clockNow } from '../../lib/clock';
import { buildDeck, makeSignal, tasteFrom } from '../../reco';
import { pickSpots, spotCard, weekOf, withSpots } from '../../reco/spots';
import { ATTRACTIONS, type Attraction } from '../../data/attractions';
import { getSpots } from '../../data/spots';
import { SpotSheet } from '../../map/ui/SpotSheet';
import { useMyArea } from '../../live/location';
import { useApp, useCoverTabBar } from '../../state/app';
import { track } from '../../analytics';
import { useFeed } from '../../state/feed';
import { usePlans } from '../../state/plans';
import { INITIAL_DRAFT, useSession } from '../../state/session';
import { colors, fonts } from '../../theme';

const STACK = 3;

export default function ForYouScreen() {
  const insets = useSafeAreaInsets();
  const { width: W, height: winH } = useWindowDimensions();
  const [H, setH] = useState(0); // высота экрана ленты (над таб-баром)
  const seenFeed = useApp((s) => s.seenFeed);
  useFocusEffect(useCallback(() => { seenFeed(); }, [seenFeed]));

  const [now, setNow] = useState(clockNow);
  useFocusEffect(useCallback(() => { setNow(clockNow()); const timer = setInterval(() => setNow(clockNow()), 60000); return () => clearInterval(timer); }, []));
  const eventsQ = useQuery({ queryKey: ['events'], queryFn: () => data.getEvents(), placeholderData: eventsSnapshot });
  const events = useMemo(() => eventsQ.data ?? [], [eventsQ.data]);
  const online = useNet((s) => s.online);
  const { data: people = NONE } = useQuery({ queryKey: ['people'], queryFn: () => data.getPeople() });
  const draft = useSession((s) => s.draft) ?? INITIAL_DRAFT;
  const { signals, decided, undosLeft, decide, addSignal, undo, restoreSkipped } = useFeed();
  const goingIds = usePlans(s => s.going);
  const skippedCount = Object.values(decided).filter((k) => k === 'skip').length;
  const { go, ungo } = usePlans.getState();
  const addPlan = useApp((s) => s.addPlan);
  const removePlan = useApp((s) => s.removePlan);
  const pulsePlan = useApp((s) => s.pulsePlan);

  // Плашка «Мимо · Вернуть»: тонкая, над нижней панелью, 5 секунд.
  const undoSeq = useRef(0);
  const [undoBar, setUndoBar] = useState<{ key: number; text: string } | null>(null);
  const [enter, setEnter] = useState<{ id: string; from: 'go' | 'skip' } | null>(null);
  const [open, setOpen] = useState<EventItem | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [when, setWhen] = useState<EventItem | null>(null);
  const [planning, setPlanning] = useState<string | null>(null);
  const opened = useRef(new Set<string>());
  useCoverTabBar(!!open);
  const topRef = useRef<SwipeHandle>(null);
  // Смещение верхней карточки: по нему подсвечиваются подсказки жестов и края экрана.
  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  const drag = { x: dragX, y: dragY };

  // Вкус = ответы регистрации + свайпы. Колода пересчитывается после каждого решения.
  const answers = { interests: draft.interests ?? INITIAL_DRAFT.interests, times: draft.times ?? INITIAL_DRAFT.times, withWho: draft.withWho ?? 'friends', budget: draft.budget ?? 'mid' };
  const taste = useMemo(() => tasteFrom(answers, signals, now), [signals, now, answers.interests, answers.times, answers.withWho, answers.budget]); // eslint-disable-line react-hooks/exhaustive-deps
  const spotsQ = useQuery({ queryKey: ['spots'], queryFn: getSpots, staleTime: 3600e3, placeholderData: ATTRACTIONS });
  const allSpots = spotsQ.data ?? ATTRACTIONS;
  const myPos = useMyArea();
  // Места выбираются один раз за открытие ленты (иначе колода «прыгала» бы от каждого свайпа).
  const [spotCards] = useState(() => {
    const st = useFeed.getState();
    return pickSpots(allSpots, tasteFrom(answers, st.signals, clockNow()), { seen: st.spotSeen ?? {}, skipped: st.spotSkipped ?? {} }, clockNow(), { solo: answers.withWho === 'alone' }).map((a) => spotCard(a, clockNow()));
  });
  const [spotDone, setSpotDone] = useState<Set<string>>(() => new Set());
  const [spotOpen, setSpotOpen] = useState<Attraction | null>(null);
  const markSpot = useFeed((s) => s.markSpot);
  // Порядок колоды «замораживается» (FIX5): видимые карточки и ближайшие за ними не переставляются после каждого свайпа —
  // раньше вкус пересчитывался, и карточка, которая должна была прийти через четыре, вдруг выскакивала следующей.
  const [frozen, setFrozen] = useState<string[]>([]);
  const deck = useMemo(() => {
    const swipes = signals.filter(s => ['go', 'skip', 'skipAfterOpen'].includes(s.kind)).length;
    const dec = new Set([...Object.keys(decided), ...Object.keys(goingIds)]);
    const fresh = withSpots(buildDeck(taste, events, { decided: dec, swipes }, { now, me: myPos }, { size: 10 }), spotCards.filter((c) => !spotDone.has(c.id)));
    const pool = new Map<string, EventItem>([...events.map((x) => [x.id, x] as const), ...fresh.map((x) => [x.id, x] as const)]);
    const alive = (id: string) => (id === planning || !dec.has(id)) && !spotDone.has(id) && pool.has(id) && (pool.get(id)!.spotId ? true : fresh.some((x) => x.id === id) || Date.parse(pool.get(id)!.endsAt ?? pool.get(id)!.startsAt) > now.getTime());
    const head = frozen.filter(alive).slice(0, STACK + 2).map((id) => pool.get(id)!);
    let d = [...head, ...fresh.filter((x) => !head.some((h) => h.id === x.id))];
    // «Вернуть»: возвращённая карточка снова первая.
    if (enter && !decided[enter.id]) {
      const back = d.find((x) => x.id === enter.id) ?? events.find((x) => x.id === enter.id);
      if (back) d = [back, ...d.filter((x) => x.id !== enter.id)];
    }
    if (previewId && !decided[previewId]) {
      const preview = events.find(x => x.id === previewId);
      if (preview) d = [preview, ...d.filter(x => x.id !== previewId)];
    }
    return d;
  }, [taste, events, decided, goingIds, signals, now, enter, previewId, spotCards, spotDone, frozen, planning]); // eslint-disable-line react-hooks/exhaustive-deps
  const headKey = deck.slice(0, STACK + 2).map((x) => x.id).join('|');
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setFrozen((f) => (f.join('|') === headKey ? f : headKey.split('|').filter(Boolean))); }, [headKey]);

  // Раскладка: заголовок, карточка и подсказки жестов под ней — всё по одной вертикальной оси; свободное место делим пополам.
  const headTop = Math.max(50, insets.top + 6);
  const baseTop = headTop + 56;
  const fullH = H || winH;
  const screenH = fullH - tabInset(insets.bottom) + 10;
  const HINTS_H = 84; // кнопки с подписями под карточкой
  const GAP = 38; // под карточкой видна стопка (28) и зазор
  const cardW = Math.min(350, W - 40);
  const cardH = Math.max(330, Math.min(470, screenH - baseTop - GAP - HINTS_H - 10));
  const free = Math.max(0, screenH - baseTop - cardH - GAP - HINTS_H - 10);
  const cardTop = baseTop + Math.round(free * 0.5);
  const hintsTop = cardTop + cardH + GAP;
  const cardX = (W - cardW) / 2;
  // Центр иконки «Планы» на панели относительно центра карточки.
  const plansIcon = tabCenter(2, W, fullH, insets.bottom);
  const target = { x: plansIcon.x - (cardX + cardW / 2), y: plansIcon.y - (cardTop + cardH / 2) };


  // Каждое решение даёт карточке новый «круг»: если она вернётся в колоду (пропущенное или «Вернуть»), это новый экземпляр,
  // а не старый, улетевший за экран, с занятым жестом — иначе лента «зависала» и смотреть было нечего.
  const [rounds, setRounds] = useState<Record<string, number>>({});
  const bump = (id: string) => setRounds((r) => ({ ...r, [id]: (r[id] ?? 0) + 1 }));
  const onDecide = (e: EventItem, kind: 'go' | 'skip') => {
    setPreviewId(null);
    // Место: «Хочу» — сразу карточка с планом на день и время, «Мимо» — не показывать месяц. Вкус учится и на местах.
    if (e.spotId) {
      setSpotDone((d) => new Set(d).add(e.id));
      markSpot(e.spotId, weekOf(clockNow()), kind === 'skip');
      addSignal(makeSignal(e, kind === 'go' ? 'save' : 'skip', clockNow()));
      track(kind, e.id);
      if (kind === 'go') { const a = allSpots.find((x) => x.id === e.spotId); if (a) setSpotOpen(a); }
      return;
    }
    // Новый экземпляр карточки нужен только когда она возвращается в колоду (выбор даты, «Вернуть»).
    // Раньше он создавался при каждом свайпе: улетевшая карточка на миг снова появлялась по центру и пропадала.
    // Нужен день или сеанс: карточка возвращается в колоду, сверху — шторка выбора; смахнул шторку — листаешь дальше.
    const planned = planning === e.id;
    if (planned) setPlanning(null);
    if (kind === 'go' && !planned && needsWhen(e)) { bump(e.id); setEnter({ id: e.id, from: 'go' }); setWhen(e); return; }
    const sig = makeSignal(e, kind === 'skip' && opened.current.has(e.id) ? 'skipAfterOpen' : kind, clockNow());
    decide({ eventId: e.id, kind, signalId: sig.id }, sig);
    track(kind, e.id);
    setEnter(null);
    if (kind === 'go') {
      // День или сеанс уже записан шторкой — в планы добавлено там.
      if (!planned) { go(e.id); addPlan(); }
      pulsePlan();
    } else if (undosLeft > 0) {
      setUndoBar({ key: ++undoSeq.current, text: `Мимо · ${e.title}` });
    }
  };

  // «Вернуть» / «Отменить»: сигнал стирается целиком, карточка снова первая.
  function doUndo() {
    const last = undo();
    setUndoBar(null);
    if (!last) return;
    bump(last.eventId);
    // «Отменить» после «пойду» считается в ungo как cancel_plan, «вернуть» после «мимо» — здесь.
    if (last.kind === 'go') { ungo(last.eventId); removePlan(); } else track('undo', last.eventId);
    setEnter({ id: last.eventId, from: last.kind });
  }

  const top = deck[0];
  useEffect(() => track('feed_open'), []);
  useEffect(() => {
    if (!top) return;
    track('card_shown', top.id);
    if (top.spotId) markSpot(top.spotId, weekOf(clockNow()));
  }, [top?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Раскрытие события из прямоугольника карточки и обратно (FIX3 Ф2): окно-маска растёт из карточки на весь экран,
  // фото внутри растёт из фото карточки, сама карточка растворяется в первой трети — без скачка картинки.
  const p = useSharedValue(0);
  // __animSlow — только для проверки кадров анимации в web (scripts/shots.mjs, SHOTS_ANIM_SLOW).
  const slow = () => (globalThis as { __animSlow?: number }).__animSlow ?? 1;
  const OPEN = () => ({ duration: 420 * slow(), easing: Easing.bezier(0.16, 1, 0.3, 1) });
  const CLOSE = () => ({ duration: 300 * slow(), easing: Easing.bezier(0.65, 0, 0.35, 1) });
  const openCard = (e: EventItem, interactive = false) => {
    setPreviewId(e.id);
    if (!opened.current.has(e.id)) { opened.current.add(e.id); addSignal(makeSignal(e, 'open', clockNow())); track('event_open', e.id); }
    setUndoBar(null);
    setOpen(e);
    if (interactive) return;
    p.value = 0;
    p.value = withTiming(1, OPEN());
  };
  const closeCard = (then?: () => void) => {
    p.value = withTiming(0, CLOSE(), () => {
      scheduleOnRN(setOpen, null);
      if (then) scheduleOnRN(then);
    });
  };
  // Выбрал дату или сеанс в открытой карточке — событие уже в планах: сворачиваем и считаем это «Пойду»,
  // иначе карточка под окном исчезала, а окно оставалось и лента не отвечала.
  const plannedFromOpen = (e: EventItem) => closeCard(() => {
    bump(e.id);
    setPreviewId(null);
    setEnter(null);
    if (!decided[e.id]) {
      const sig = makeSignal(e, 'go', clockNow());
      decide({ eventId: e.id, kind: 'go', signalId: sig.id }, sig);
      track('go', e.id);
    }
    pulsePlan();
    useTabBadges.getState().landPlans();
  });
  const clip = useAnimatedStyle(() => ({
    left: cardX * (1 - p.value),
    top: cardTop * (1 - p.value),
    width: cardW + (W - cardW) * p.value,
    height: cardH + (fullH - cardH) * p.value,
    borderRadius: 30 * (1 - p.value),
  }));
  const clipInner = useAnimatedStyle(() => ({ left: -cardX * (1 - p.value) }));
  const cardFade = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0, 0.32], [1, 0], Extrapolation.CLAMP),
    transform: [{ scale: 1 + ((W - cardW) / cardW) * p.value }],
  }));

  return (
    <View style={styles.root} onLayout={(ev) => setH(ev.nativeEvent.layout.height)}>
      <View style={[styles.head, { top: headTop, left: cardX + 2, right: cardX }]}>
        <Text style={styles.h1} accessibilityRole="header">Рекомендации</Text>
      </View>

      <View style={{ position: 'absolute', left: cardX, top: cardTop, width: cardW, height: cardH }}>
        {/* Обработчики читают opened (ref) только при жесте, не при отрисовке. */}
        {/* eslint-disable react-hooks/refs */}
        {deck.slice(0, STACK).map((e, k) => (
          <SwipeCard
            key={`${e.id}:${rounds[e.id] ?? 0}`}
            ref={k === 0 ? topRef : undefined}
            e={e} people={people} now={now}
            k={k} top={k === 0} width={cardW} height={cardH} target={target}
            enterFrom={enter?.id === e.id ? enter.from : null}
            onDecide={(kind) => onDecide(e, kind)}
            onLand={() => useTabBadges.getState().landPlans()}
            onTap={() => { if (e.spotId) { const a = allSpots.find((x) => x.id === e.spotId); if (a) setSpotOpen(a); } else openCard(e); }}
            expand={p} onReveal={() => openCard(e, true)}
            onRevealEnd={(commit) => { if (commit) p.set(withTiming(1, OPEN())); else closeCard(); }}
            onUndo={doUndo}
            drag={k === 0 ? drag : undefined}
          />
        )).reverse()}
        {/* eslint-enable react-hooks/refs */}
      </View>

      {top && !open && !when && (
        <View style={[styles.hints, { top: hintsTop, left: cardX - 6, width: cardW + 12 }]}>
          <QuickButtons x={dragX} y={dragY} onNo={() => topRef.current?.fly('skip')} onGo={() => topRef.current?.fly('go')} onUp={() => { if (top.spotId) { const a = allSpots.find((x) => x.id === top.spotId); if (a) setSpotOpen(a); } else openCard(top); }} />
        </View>
      )}

      {!top && (
        <View style={[styles.emptyBox, { top: cardTop + 40 }]}>
          {events.length === 0 ? (
            !online ? <StateView kind="offline" text="Карточки появятся, как только вернётся связь." onAction={() => void eventsQ.refetch()} />
            : eventsQ.isError ? <StateView kind="error" text="События не загрузились. Проверь связь и попробуй ещё раз." onAction={() => void eventsQ.refetch()} />
            : eventsQ.isFetching ? <StateView kind="loading" title="Загружаю события…" />
            : <StateView kind="empty" title="Событий пока нет" text="Новые появятся вечером. А пока — загляни на карту." action="Открыть карту" onAction={() => router.navigate('/')} />
          ) : (
            <>
              <Text style={styles.emptyTitle}>Ты всё посмотрел</Text>
              <Text style={styles.emptySub}>Новые события появятся вечером. А пока — что на карте прямо сейчас.</Text>
              <Pressable onPress={() => router.navigate('/')} style={({ pressed }) => [styles.emptyBtn, pressed && { transform: [{ scale: 0.97 }] }]} accessibilityRole="button">
                <Text style={styles.emptyBtnText}>Открыть карту</Text>
              </Pressable>
              {skippedCount > 0 && (
                <Pressable onPress={restoreSkipped} style={({ pressed }) => [styles.emptyGhost, pressed && { opacity: 0.7 }]} accessibilityRole="button">
                  <Text style={styles.emptyGhostText}>Показать пропущенные ({skippedCount})</Text>
                </Pressable>
              )}
            </>
          )}
        </View>
      )}

      {when && <WhenSheet key={when.id} e={when} events={events} now={now} onClose={() => setWhen(null)}
        onPlanned={() => { const id = when.id; setWhen(null); setPlanning(id); setTimeout(() => topRef.current?.fly('go'), 260); }} />}
      {spotOpen && <SpotSheet key={spotOpen.id} a={spotOpen} all={allSpots} onClose={() => setSpotOpen(null)} onOpen={setSpotOpen} />}
      {undoBar && !open && !when && <UndoBar key={undoBar.key} text={undoBar.text} bottom={tabInset(insets.bottom) + 2} onUndo={doUndo} onGone={() => setUndoBar(null)} />}

      {open && (
        <Animated.View style={[styles.clip, clip]}>
          <Animated.View style={[{ position: 'absolute', top: 0, width: W, height: fullH }, clipInner]}>
            <LazyEventPage progress={p} coverFrom={Math.round(cardH * 0.5)} e={open} now={now} closeLabel="Свернуть обратно в карточку" onClose={() => closeCard()} onSkip={() => closeCard(() => topRef.current?.fly('skip'))}
              onGo={() => closeCard(() => topRef.current?.fly('go'))} onPlanned={() => plannedFromOpen(open)} />
          </Animated.View>
          <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: 0, top: 0, width: cardW, height: cardH, transformOrigin: 'left top' }, cardFade]}>
            <FeedCard e={open} people={people} now={now} height={cardH} />
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
  emptyBox: { position: 'absolute', left: 24, right: 24, alignItems: 'center', gap: 10, paddingTop: 160 },
  emptyTitle: { fontFamily: fonts.display700, fontSize: 24, letterSpacing: -0.5, color: colors.ink, textAlign: 'center' },
  emptySub: { fontFamily: fonts.body400, fontSize: 15, lineHeight: 21, color: colors.muted, textAlign: 'center' },
  emptyBtn: { marginTop: 10, height: 50, paddingHorizontal: 26, borderRadius: 16, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  emptyGhost: { minHeight: 44, justifyContent: 'center' },
  emptyGhostText: { fontFamily: fonts.body700, fontSize: 14.5, color: colors.ink, textDecorationLine: 'underline' },
  emptyBtnText: { fontFamily: fonts.body700, fontSize: 15.5, color: colors.paper },
  clip: { position: 'absolute', overflow: 'hidden', zIndex: 50 },
  hints: { position: 'absolute' },
});
