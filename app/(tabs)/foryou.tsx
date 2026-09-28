// «Для тебя» — design/png/Feed.png. Бесконечная колода: после каждого свайпа пересчитывается (модуль reco).
import { useQuery } from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { TAB_BAR_HEIGHT } from '../../src/components/TabBar';
import { data, eventsSnapshot, type EventItem } from '../../src/data';
import { EventPage } from '../../src/event/EventPage';
import { SwipeCard, type SwipeHandle } from '../../src/feed/SwipeCard';
import { now as clockNow } from '../../src/lib/clock';
import { formatWhen } from '../../src/lib/format';
import { buildDeck, makeSignal, tasteFrom } from '../../src/reco';
import { useApp } from '../../src/state/app';
import { useFeed } from '../../src/state/feed';
import { usePlans } from '../../src/state/plans';
import { INITIAL_DRAFT, useSession } from '../../src/state/session';
import { colors, fonts } from '../../src/theme';
import { Ic, IC } from '../../src/ui/Ic';
import { Toast, type ToastData } from '../../src/ui/Toast';

const STACK = 3;

function goText(e: EventItem, names: string[], now: Date): string {
  const what = e.short ? e.short.toLowerCase() : `«${e.title}»`;
  const when = formatWhen(e.startsAt, now).toLowerCase().replace(' · ', ' ');
  return `В планах: ${what}, ${when}${names.length ? `. ${names.join(' и ')} ${names.length > 1 ? 'тоже идут' : 'тоже идёт'}` : ''}`;
}

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
  const { signals, decided, history, undosLeft, decide, addSignal, removeSignal, undo } = useFeed();
  const saved = usePlans((s) => s.saved);
  const { go, ungo, toggleSave } = usePlans.getState();
  const addPlan = useApp((s) => s.addPlan);
  const removePlan = useApp((s) => s.removePlan);
  const pulsePlan = useApp((s) => s.pulsePlan);

  const [toast, setToast] = useState<ToastData | null>(null);
  const [enter, setEnter] = useState<{ id: string; from: 'go' | 'skip' } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [open, setOpen] = useState<EventItem | null>(null);
  const opened = useRef(new Set<string>());
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

  const cardTop = Math.max(50, insets.top + 6) + 66;
  const screenH = H || winH - TAB_BAR_HEIGHT - Math.max(0, insets.bottom - 20);
  const cardW = W - 32;
  const cardH = Math.max(380, Math.min(500, screenH - cardTop - 138));
  // Центр иконки «Профиль» на таб-баре относительно центра карточки.
  const target = { x: W * 0.9 - (16 + cardW / 2), y: screenH + 24 - (cardTop + cardH / 2) };

  const showToast = (t: ToastData | null, ms = 4000) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(t);
    if (t) toastTimer.current = setTimeout(() => setToast(null), ms);
  };

  const onDecide = (e: EventItem, kind: 'go' | 'skip') => {
    const sig = makeSignal(e, kind === 'skip' && opened.current.has(e.id) ? 'skipAfterOpen' : kind, clockNow());
    decide({ eventId: e.id, kind, signalId: sig.id }, sig);
    setEnter(null);
    if (kind === 'go') {
      go(e.id);
      addPlan();
      pulsePlan();
      const names = e.friendsGoing.map((id) => people.find((p) => p.id === id)?.name).filter(Boolean) as string[];
      showToast({ text: goText(e, names, now), cta: 'Отменить', onCta: doUndo }, 4000);
    } else {
      showToast({ text: `Мимо: «${e.title}»`, cta: 'Вернуть', onCta: doUndo, timerMs: 5000 }, 5000);
    }
  };

  // «Вернуть» / «Отменить»: сигнал стирается целиком, карточка снова первая.
  function doUndo() {
    const last = undo();
    showToast(null);
    if (!last) return;
    if (last.kind === 'go') { ungo(last.eventId); removePlan(); }
    setEnter({ id: last.eventId, from: last.kind });
  }

  const top = deck[0];
  const onSave = () => {
    if (!top) return;
    const was = !!saved[top.id];
    toggleSave(top.id);
    const id = `${top.id}-save`;
    if (was) removeSignal(id);
    else addSignal(makeSignal(top, 'save', clockNow(), id));
  };

  // Раскрытие события из прямоугольника карточки (~350 мс) и обратно.
  const p = useSharedValue(0);
  const openCard = (e: EventItem) => {
    if (!opened.current.has(e.id)) { opened.current.add(e.id); addSignal(makeSignal(e, 'open', clockNow())); }
    showToast(null);
    setOpen(e);
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
    left: 16 * (1 - p.value),
    top: cardTop * (1 - p.value),
    width: cardW + 32 * p.value,
    height: cardH + (screenH - cardH) * p.value,
    borderRadius: 26 * (1 - p.value),
    opacity: 0.6 + 0.4 * p.value,
  }));
  const clipInner = useAnimatedStyle(() => ({ left: -16 * (1 - p.value), top: -cardTop * (1 - p.value) }));

  // Кнопки = такой же полёт, как свайп.
  function press(key: string) {
    if (key === 'undo') doUndo();
    else topRef.current?.fly(key as 'go' | 'skip');
  }

  const canUndo = history.length > 0 && undosLeft > 0;
  const controls = [
    { key: 'skip', label: 'МИМО', aria: 'Мимо — дальше', size: 64, bg: colors.cardAlt, icon: IC.close, is: 24, sw: 2.4, fg: colors.ink, disabled: !top },
    { key: 'undo', label: 'ВЕРНУТЬ', aria: 'Вернуть последнюю карточку', size: 44, bg: colors.sand, icon: 'M4 9h11a5 5 0 010 10H9M8 5L4 9l4 4', is: 19, sw: 2, fg: colors.ink, disabled: !canUndo },
    { key: 'go', label: 'ПОЙДУ', aria: 'Пойду — добавить в планы', size: 64, bg: colors.accent, icon: IC.check, is: 26, sw: 2.6, fg: colors.ink, disabled: !top },
  ];

  return (
    <View style={styles.root} onLayout={(ev) => setH(ev.nativeEvent.layout.height)}>
      <View style={[styles.head, { top: Math.max(50, insets.top + 6) }]}>
        <Text style={styles.h1} accessibilityRole="header">Для тебя</Text>
        <Text style={styles.sub}>Алматы · сегодня и на неделе</Text>
      </View>

      <View style={{ position: 'absolute', left: 16, top: cardTop, width: cardW, height: cardH }}>
        {deck.slice(0, STACK).map((e, k) => (
          <SwipeCard
            key={e.id}
            ref={k === 0 ? topRef : undefined}
            e={e} people={people} now={now} saved={!!saved[e.id]} onSave={onSave}
            k={k} top={k === 0} width={cardW} height={cardH} target={target}
            enterFrom={enter?.id === e.id ? enter.from : null}
            onDecide={(kind) => onDecide(e, kind)}
            onTap={() => openCard(e)}
          />
        )).reverse()}
        {!top && <Text style={styles.empty}>Загружаю ещё…</Text>}
      </View>

      {toast && <Toast t={toast} style={{ position: 'absolute', left: 16, right: 16, top: cardTop + cardH - 68 }} />}

      <View style={[styles.controls, { top: cardTop + cardH + 24 }]}>
        {controls.map((b) => (
          <View key={b.key} style={styles.ctl}>
            <Pressable onPress={() => press(b.key)} disabled={b.disabled} accessibilityRole="button" accessibilityLabel={b.aria} accessibilityState={{ disabled: b.disabled }}
              style={({ pressed }) => [styles.btn, { width: b.size, height: b.size, borderRadius: b.size / 2, marginTop: b.key === 'undo' ? 10 : 0, backgroundColor: b.bg, opacity: b.disabled ? 0.4 : 1, transform: [{ scale: pressed ? 0.94 : 1 }] },
                b.key === 'go' ? styles.goShadow : b.key === 'skip' ? styles.skipShadow : null]}>
              <Ic d={b.icon} size={b.is} color={b.fg} w={b.sw} />
            </Pressable>
            <Text style={styles.ctlLabel}>{b.label}</Text>
          </View>
        ))}
      </View>

      {open && (
        <Animated.View style={[styles.clip, clip]}>
          <Animated.View style={[{ position: 'absolute', width: W, height: screenH }, clipInner]}>
            <EventPage e={open} now={now} closeLabel="Свернуть обратно в карточку" onClose={() => closeCard()}
              onGo={() => closeCard(() => topRef.current?.fly('go'))} />
          </Animated.View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#EFEBE2', overflow: 'hidden' },
  head: { position: 'absolute', left: 16, right: 16, gap: 2 },
  h1: { fontFamily: fonts.display700, fontSize: 30, letterSpacing: -0.75, lineHeight: 33, color: colors.ink },
  sub: { fontFamily: fonts.body400, fontSize: 13, color: colors.muted },
  empty: { textAlign: 'center', marginTop: 200, fontFamily: fonts.body400, fontSize: 15, color: colors.muted },
  controls: { position: 'absolute', left: 16, right: 16, flexDirection: 'row' },
  ctl: { flex: 1, alignItems: 'center', gap: 6 },
  btn: { alignItems: 'center', justifyContent: 'center' },
  goShadow: { shadowColor: colors.accent, shadowOpacity: 0.35, shadowRadius: 8, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
  skipShadow: { shadowColor: colors.ink, shadowOpacity: 0.12, shadowRadius: 7, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  ctlLabel: { fontFamily: fonts.mono600, fontSize: 9.5, letterSpacing: 0.57, color: colors.muted },
  clip: { position: 'absolute', overflow: 'hidden', zIndex: 50 },
});
