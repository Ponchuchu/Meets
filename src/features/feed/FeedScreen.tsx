// A scrollable city programme. Full-ratio media, explicit plans, one visible video decoder.
import { useQuery } from '@tanstack/react-query';
import { router, useFocusEffect } from 'expo-router';
import { CalendarDays, Check, EyeOff, ThumbsDown, ThumbsUp } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, useWindowDimensions, View, type ViewToken } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { track } from '../../analytics';
import { tabInset } from '../../components/TabBar';
import { data, eventsSnapshot, type EventItem } from '../../data';
import { ATTRACTIONS, type Attraction } from '../../data/attractions';
import { getSpots } from '../../data/spots';
import { EventPage } from '../../event/EventPage';
import { eventFacts } from '../../event/facts';
import { NaturalEvent } from '../../feed/NaturalEvent';
import { WhenSheet, needsWhen } from '../../feed/WhenSheet';
import { now as clockNow } from '../../lib/clock';
import { useMyArea } from '../../live/location';
import { useNet } from '../../live/net';
import { SpotSheet } from '../../map/ui/SpotSheet';
import { buildDeck, makeSignal, tasteFrom } from '../../reco';
import { pickSpots, spotCard, weekOf, withSpots } from '../../reco/spots';
import { useApp, useCoverTabBar } from '../../state/app';
import { useFeed } from '../../state/feed';
import { usePlans } from '../../state/plans';
import { INITIAL_DRAFT, useSession } from '../../state/session';
import { useTabBadges } from '../../state/tabBadges';
import { colors, fonts } from '../../theme';
import { StateView } from '../../ui/StateView';
import { Backdrop, BottomSheet } from '../../ui/sheet';

type Notice = { id: string; kind: 'go' | 'skip'; text: string };
export default function ForYouScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [focused, setFocused] = useState(false);
  useFocusEffect(useCallback(() => { setFocused(true); return () => setFocused(false); }, []));
  const column = Math.min(520, width - 32);
  const bottom = tabInset(insets.bottom);
  const q = useQuery({ queryKey: ['events'], queryFn: () => data.getEvents(), placeholderData: eventsSnapshot });
  const events = useMemo(() => q.data ?? [], [q.data]);
  const spotsQ = useQuery({ queryKey: ['spots'], queryFn: getSpots, staleTime: 3600e3, placeholderData: ATTRACTIONS });
  const spots = spotsQ.data ?? ATTRACTIONS;
  const online = useNet(s => s.online);
  const draft = useSession(s => s.draft) ?? INITIAL_DRAFT;
  const signals = useFeed(s => s.signals);
  const decided = useFeed(s => s.decided);
  const hidden = useFeed(s => s.hidden);
  const going = usePlans(s => s.going);
  const badges = useTabBadges(s => s.plans);
  const pos = useMyArea();
  const [now, setNow] = useState(clockNow);
  const [order, setOrder] = useState<string[]>([]);
  const [plannedHere, setPlannedHere] = useState<Set<string>>(() => new Set());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [open, setOpen] = useState<EventItem | null>(null);
  const [when, setWhen] = useState<EventItem | null>(null);
  const [spot, setSpot] = useState<Attraction | null>(null);
  const [feedback, setFeedback] = useState<EventItem | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  useCoverTabBar(!!open);
  useFocusEffect(useCallback(() => { setNow(clockNow()); useApp.getState().seenFeed(); track('feed_open'); }, []));
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(null), 5000); return () => clearTimeout(timer); }, [notice]);
  const taste = useMemo(() => tasteFrom({ interests: draft.interests ?? [], times: draft.times ?? [], withWho: draft.withWho ?? 'friends', budget: draft.budget ?? 'mid' }, signals, now), [draft.interests, draft.times, draft.withWho, draft.budget, signals, now]);
  const candidates = useMemo(() => events.filter(e => !eventFacts(e).priceMissing && !/^спасибо\s+за\s+видео\b/iu.test(e.title)), [events]);
  const places = useMemo(() => pickSpots(spots.filter(a => a.free || a.priceFrom != null), taste, { seen: useFeed.getState().spotSeen, skipped: useFeed.getState().spotSkipped }, now).map(a => spotCard(a, now)), [spots, taste, now]);
  const ranked = useMemo(() => {
    const excluded = new Set([...Object.keys(hidden ?? {}), ...Object.entries(decided).filter(([id, kind]) => kind === 'skip' || !plannedHere.has(id)).map(([id]) => id), ...Object.keys(going).filter(id => !plannedHere.has(id))]);
    const deck = withSpots(buildDeck(taste, candidates, { decided: excluded, swipes: signals.length }, { now, me: pos }, { size: 30 }), places);
    const byId = new Map([...candidates, ...places].map(e => [e.id, e]));
    return [...new Set([...order, ...deck.map(e => e.id)])].map(id => byId.get(id)).filter((e): e is EventItem => !!e && !excluded.has(e.id));
  }, [taste, candidates, hidden, decided, going, plannedHere, signals.length, now, pos, places, order]);
  const ids = !q.isPlaceholderData && !q.isPending ? ranked.map(e => e.id).join('|') : '';
  useEffect(() => {
    if (!ids) return;
    // Keep the programme stable when a plan is saved, a price arrives or an image decodes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOrder(current => { const next = [...new Set([...current, ...ids.split('|')])].slice(-80); return next.join('|') === current.join('|') ? current : next; });
  }, [ids]);
  const confirmed = (e: EventItem, alreadySaved = false) => {
    if (plannedHere.has(e.id) || (!alreadySaved && usePlans.getState().going[e.id])) return;
    setPlannedHere(current => new Set(current).add(e.id));
    const signal = makeSignal(e, 'go', clockNow());
    useFeed.getState().decide({ eventId: e.id, kind: 'go', signalId: signal.id }, signal, false);
    if (!alreadySaved) { usePlans.getState().go(e.id); useApp.getState().addPlan(); }
    useApp.getState().pulsePlan(); useTabBadges.getState().landPlans(); track('go', e.id);
    setNotice({ id: e.id, kind: 'go', text: 'Добавлено в планы' });
  };
  const plan = (e: EventItem) => {
    if (going[e.id]) { router.navigate('/plans'); return; }
    if (e.spotId) { const a = e.spot ?? spots.find(a => a.id === e.spotId); if (a) setSpot(a); return; }
    if (needsWhen(e)) { setWhen(e); return; }
    confirmed(e);
  };
  const skip = (e: EventItem) => {
    const signal = makeSignal(e, 'skip', clockNow());
    useFeed.getState().decide({ eventId: e.id, kind: 'skip', signalId: signal.id }, signal);
    if (e.spotId) useFeed.getState().markSpot(e.spotId, weekOf(clockNow()), true);
    track('skip', e.id); setNotice({ id: e.id, kind: 'skip', text: 'Событие скрыто' });
  };
  const show = (e: EventItem) => {
    useFeed.getState().addSignal(makeSignal(e, 'open', clockNow()));
    if (e.spotId) { const a = e.spot ?? spots.find(a => a.id === e.spotId); if (a) setSpot(a); }
    else setOpen(e);
  };
  const viewability = useMemo(() => ({ viewAreaCoveragePercentThreshold: 45 }), []);
  const seen = useRef(new Set<string>());
  const onVisible = useCallback(({ viewableItems }: { viewableItems: ViewToken<EventItem>[] }) => {
    const entry = viewableItems.find(v => v.isViewable)?.item;
    setActiveId(entry?.id ?? null);
    if (entry && !seen.current.has(entry.id)) { seen.current.add(entry.id); track('card_shown', entry.id); if (entry.spotId) useFeed.getState().markSpot(entry.spotId, weekOf(clockNow())); }
  }, []);
  return <View style={styles.root}>
    <FlatList data={ranked} keyExtractor={e => e.id} initialNumToRender={2} maxToRenderPerBatch={2} windowSize={5}
      onViewableItemsChanged={onVisible} viewabilityConfig={viewability} maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
      contentContainerStyle={{ width: column, alignSelf: 'center', paddingTop: Math.max(24, insets.top + 14), paddingBottom: bottom + 24 }}
      ListHeaderComponent={<View style={styles.header}>
        <View style={{ flex: 1, gap: 6 }}><Text style={styles.city}>Алматы</Text><Text style={styles.h1} accessibilityRole="header">Куда пойдём?</Text></View>
        <Pressable onPress={() => router.navigate('/plans')} style={styles.calendar} accessibilityRole="button" accessibilityLabel={badges ? `Планы, новых: ${badges}` : 'Планы'}>
          <CalendarDays size={24} color={colors.ink} strokeWidth={1.7} />{badges > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{badges > 9 ? '9+' : badges}</Text></View>}
        </Pressable>
      </View>}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      renderItem={({ item }) => <View><NaturalEvent event={item} now={now} width={column} active={focused && activeId === item.id && !open && !when && !spot && !feedback} planned={!!going[item.id]}
        onOpen={() => show(item)} onPlan={() => plan(item)} onSkip={() => skip(item)} onFeedback={() => setFeedback(item)} /></View>}
      ListEmptyComponent={q.isPending ? <StateView kind="loading" /> : q.isError ? <StateView kind={online ? 'error' : 'offline'} onAction={() => void q.refetch()} /> : <StateView kind="empty" title="На сегодня всё" text="Новые события появятся здесь. А твои планы — в календаре." />}
    />
    {notice && !open && <Animated.View entering={FadeIn.duration(150)} exiting={FadeOut.duration(150)} style={[styles.notice, { bottom: bottom + 4 }]} accessibilityLiveRegion="polite">
      {notice.kind === 'go' ? <Check size={18} color={colors.ok} /> : <EyeOff size={18} color={colors.muted} />}
      <Text style={styles.noticeText}>{notice.text}</Text><Pressable style={styles.noticeAction} accessibilityRole="button" accessibilityLabel={notice.kind === 'go' ? 'Открыть планы' : 'Вернуть'} onPress={() => {
        if (notice.kind === 'go') router.navigate('/plans'); else { useFeed.getState().undo(notice.id); track('undo', notice.id); }
        setNotice(null);
      }}><Text style={styles.noticeLink}>{notice.kind === 'go' ? 'Открыть' : 'Вернуть'}</Text></Pressable>
    </Animated.View>}
    <Modal visible={!!open} animationType="slide" onRequestClose={() => setOpen(null)} presentationStyle="fullScreen">
      {open && <EventPage e={open} now={now} closeLabel="Вернуться в рекомендации" onClose={() => setOpen(null)} onGo={() => { const e = open; setOpen(null); plan(e); }} onSkip={() => { skip(open); setOpen(null); }} onPlanned={() => { confirmed(open, true); setOpen(null); }} />}
    </Modal>
    {when && <WhenSheet e={when} events={events} now={now} onClose={() => setWhen(null)} onPlanned={() => { confirmed(when, true); setWhen(null); }} />}
    {spot && <SpotSheet a={spot} all={spots} onClose={() => setSpot(null)} onOpen={setSpot} />}
    {feedback && <><Backdrop label="Закрыть" onPress={() => setFeedback(null)} /><BottomSheet label="Настроить рекомендации" onClose={() => setFeedback(null)}>
      <Pressable style={styles.feedback} onPress={() => { useFeed.getState().addSignal(makeSignal(feedback, 'save', clockNow())); setFeedback(null); }}><ThumbsUp size={20} color={colors.ink} /><Text>Больше похожего</Text></Pressable>
      <Pressable style={styles.feedback} onPress={() => { skip(feedback); setFeedback(null); }}><ThumbsDown size={20} color={colors.ink} /><Text>Меньше похожего</Text></Pressable>
    </BottomSheet></>}
  </View>;
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  header: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingBottom: 28 },
  city: { fontFamily: fonts.body400, fontSize: 13, color: colors.muted },
  h1: { fontFamily: fonts.display600, fontSize: 28, lineHeight: 34, letterSpacing: -0.8, color: colors.ink },
  calendar: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 24, backgroundColor: '#FFFEFA' },
  badge: { position: 'absolute', right: -2, top: -2, minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 9, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontFamily: fonts.body600, fontSize: 10, color: '#FFFFFF' },
  separator: { height: 1, backgroundColor: '#DDDCD3', marginVertical: 28 },
  notice: { position: 'absolute', left: 16, right: 16, minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 9, paddingLeft: 14, paddingRight: 6, borderRadius: 16, backgroundColor: '#FDFDF8', boxShadow: '0 4px 18px rgba(23,22,26,0.1)' },
  noticeText: { flex: 1, fontFamily: fonts.body500, fontSize: 13, color: colors.ink },
  noticeAction: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 12 },
  noticeLink: { fontFamily: fonts.body600, fontSize: 13, color: colors.accentText },
  feedback: { minHeight: 52, flexDirection: 'row', gap: 12, alignItems: 'center' },
});
