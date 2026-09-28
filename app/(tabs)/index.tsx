// Карта — вкладка по умолчанию (design/png/Main.png, MapCalendar.png, MapFilters.png).
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, FadeOut, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { data, eventsSnapshot, type EventItem } from '../../src/data';
import { DEMO_FORECAST } from '../../src/data/weather';
import { almaty, dayIndex, now as clockNow } from '../../src/lib/clock';
import { rangeLabel } from '../../src/map/calendar';
import { activeCount, occursOnDay, showLabel, visibleEvents } from '../../src/map/filters';
import { phaseOf, whenLabel } from '../../src/map/lifecycle';
import { MapCanvas } from '../../src/map/MapCanvas';
import { EventPin, FocusPin, FriendPin, MePin, type PinKind } from '../../src/map/pins';
import { FriendCard, InviteFriendSheet, STICKERS } from '../../src/map/ui/FriendCard';
import { accusative, genitive } from '../../src/lib/names';
import { ideasForTwo } from '../../src/people/inviteFor';
import { canSee, canSendSticker } from '../../src/people/visibility';
import { tasteFrom } from '../../src/reco';
import { useFeed } from '../../src/state/feed';
import { useSession } from '../../src/state/session';
import { useSocial } from '../../src/state/social';
import { Ic, IC } from '../../src/ui/Ic';
import { Toast, type ToastData } from '../../src/ui/Toast';
import { autoTheme } from '../../src/map/style';
import { ALMATY_CAMERA, type MapCanvasHandle, type MapMarker } from '../../src/map/types';
import { CalendarCard } from '../../src/map/ui/CalendarCard';
import { EventCard } from '../../src/map/ui/EventCard';
import { FiltersSheet } from '../../src/map/ui/FiltersSheet';
import { SearchOverlay } from '../../src/map/ui/SearchOverlay';
import { TopBar } from '../../src/map/ui/TopBar';
import { useMapState } from '../../src/state/map';
import { usePlans } from '../../src/state/plans';
import { useProfile } from '../../src/state/profile';
import { colors, fonts } from '../../src/theme';
import { Backdrop, BottomSheet, DropCard } from '../../src/ui/sheet';

type Sheet = null | 'calendar' | 'filters' | 'search';

function pinKind(e: EventItem, today: number, going: boolean): PinKind {
  const isToday = dayIndex(e.startsAt) === today;
  const mine = going || !!e.meetup;
  if ((e.friendsGoing.length || mine) && !e.isLong && isToday) return 'hot';
  if (e.goingCount >= 1000 && !e.isLong) return 'popular';
  if ((e.friendsGoing.length || mine) && !e.isLong) return 'labeled';
  return 'plain';
}

function pinLabel(e: EventItem, today: number): string {
  const a = almaty(e.startsAt);
  const hm = `${String(a.getUTCHours()).padStart(2, '0')}:${String(a.getUTCMinutes()).padStart(2, '0')}`;
  const name = e.short ?? e.title.split(/[\s:«]/)[0].toUpperCase();
  if (dayIndex(e.startsAt) === today) return `${name} · ${hm}`;
  return `${name} · ${['ВС', 'ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ'][a.getUTCDay()]} ${hm}`;
}

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapCanvasHandle>(null);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [pending, setPending] = useState(false); // в календаре выбрано начало диапазона, ждём конец
  const [clock, setClock] = useState(clockNow);
  const { filters, setFilters, resetFilters, selectedId, select, focusId, focusFriend, inviteOpen, setInviteOpen } = useMapState();
  const [toast, setToast] = useState<ToastData | null>(null);
  const [bubble, setBubble] = useState<{ id: string; label: string; bg: string; fg: string } | null>(null);
  const [fly, setFly] = useState<{ label: string; bg: string; fg: string; x: number } | null>(null);
  const flyY = useSharedValue(0);
  const flyStyle = useAnimatedStyle(() => ({ transform: [{ translateY: flyY.value }, { scale: 1 - 0.15 * Math.min(1, -flyY.value / 300) }] }));
  const social = useSocial();
  const draft = useSession((s) => s.draft);
  const signals = useFeed((s) => s.signals);
  const showToast = (t: ToastData, ms = 3500) => { setToast(t); setTimeout(() => setToast((c) => (c === t ? null : c)), ms); };

  // Время идёт — точки живут: обновляем раз в минуту.
  useEffect(() => {
    const t = setInterval(() => setClock(clockNow()), 60000);
    return () => clearInterval(t);
  }, []);

  const { data: loaded = [] } = useQuery({ queryKey: ['events'], queryFn: () => data.getEvents(), placeholderData: eventsSnapshot });
  const meetups = usePlans((s) => s.meetups);
  const goingMap = usePlans((s) => s.going);
  const events = useMemo(() => [...meetups, ...loaded], [meetups, loaded]);
  const going = useMemo(() => new Set(Object.keys(goingMap)), [goingMap]);
  const { data: people = [] } = useQuery({ queryKey: ['people'], queryFn: () => data.getPeople() });
  const { data: spots = [] } = useQuery({ queryKey: ['friendSpots'], queryFn: () => data.getFriendSpots() });
  const { data: me } = useQuery({ queryKey: ['mySpot'], queryFn: () => data.getMySpot() });
  const { data: details = [] } = useQuery({
    queryKey: ['spotDetails', spots.map((x) => x.personId).join(',')],
    queryFn: () => Promise.all(spots.map((x) => data.getPersonDetails(x.personId))),
    enabled: spots.length > 0,
  });
  const detailsOf = (id: string) => details.find((d) => d?.id === id) ?? undefined;
  const focusSpot = spots.find((x) => x.personId === focusId);
  const focusPerson = people.find((x) => x.id === focusId);

  // Тап по другу: карта сдвигается к нему (он выше карточки), остальное бледнеет.
  useEffect(() => {
    if (focusSpot) mapRef.current?.flyTo(focusSpot.lat - 0.0035, focusSpot.lon);
  }, [focusSpot]);


  const today = dayIndex(clock);
  const mapStyle = useProfile((s) => s.settings.mapStyle);
  const popularBigger = useProfile((s) => s.settings.popularBigger);
  const theme = mapStyle === 'auto' ? autoTheme(almaty(clock).getUTCHours()) : mapStyle;
  const dark = theme === 'night';
  const visible = useMemo(() => visibleEvents(events, filters, clock, going), [events, filters, clock, going]);
  const upcoming = useMemo(() => events.filter((e) => phaseOf(e, clock, going.has(e.id)) !== 'hidden'), [events, clock, going]);

  const selected = visible.find((e) => e.id === selectedId)
    ?? visible.find((e) => pinKind(e, today, going.has(e.id)) === 'hot')
    ?? visible.find((e) => e.friendsGoing.length > 0)
    ?? visible[0];

  const markers: MapMarker[] = useMemo(() => {
    const list: MapMarker[] = visible.map((e) => {
      const k0 = pinKind(e, today, going.has(e.id));
      const kind = k0 === 'popular' && !popularBigger ? 'plain' : k0;
      return {
        id: `e-${e.id}`, lat: e.lat, lon: e.lon, z: kind === 'hot' ? 30 : kind === 'plain' ? 10 : 20,
        node: (
          <View style={{ opacity: focusId ? 0.35 : 1 }} pointerEvents={focusId ? 'none' : 'auto'}>
          <EventPin e={e} kind={kind} phase={phaseOf(e, clock, going.has(e.id))} label={kind === 'hot' || kind === 'labeled' ? pinLabel(e, today) : undefined}
            showCompany={filters.company} dark={dark} onPress={() => { select(e.id); setSheet(null); }} />
          </View>
        ),
      };
    });
    if (filters.friends) {
      for (const s of spots) {
        const p = people.find((x) => x.id === s.personId);
        const d = detailsOf(s.personId);
        // Только друзья, которые сами включили геолокацию, и не в зоне дома (правила «Кто что видит»).
        if (!p || !d || social.removed[p.id] || !canSee('friend', 'location', d.privacy)) continue;
        if (focusId === p.id) {
          list.push({ id: `f-${p.id}`, lat: s.lat, lon: s.lon, z: 60, node: <FocusPin person={p} ring={s.state === 'paused' ? '#8C8577' : colors.friend} bubble={bubble && bubble.id === p.id ? bubble : null} speed={s.state === 'moving' && canSee('friend', 'speedStatus', d.privacy) ? `${s.speedKmh} КМ/Ч` : undefined} /> });
        } else {
          list.push({ id: `f-${p.id}`, lat: s.lat, lon: s.lon, z: 40, node: <FriendPin person={p} spot={s} dim={!!focusId} onPress={() => { focusFriend(p.id); setSheet(null); }} /> });
        }
      }
    }
    if (me) list.push({ id: 'me', lat: me.lat, lon: me.lon, z: 35, node: <View style={{ opacity: focusId ? 0.35 : 1 }}><MePin onPress={() => router.push('/marker')} /></View> });
    return list;
  }, [visible, spots, people, me, filters.friends, filters.company, clock, today, dark, select, going, popularBigger, focusId, bubble, details, social.removed]); // eslint-disable-line react-hooks/exhaustive-deps

  const count = visible.length;
  const dateText = rangeLabel(filters.from, filters.to, clock);
  const forecast = DEMO_FORECAST;
  const weather = forecast[filters.from] ?? null;

  const pickDay = useCallback((d: number) => {
    // Первый тап — начало, второй (позже) — конец диапазона, как в макете.
    if (!pending || d < filters.from) { setFilters({ from: d, to: d }); setPending(true); }
    else { setFilters({ to: d }); setPending(false); }
  }, [pending, filters.from, setFilters]);

  const openEvent = (e: EventItem) => router.push({ pathname: '/event/[id]', params: { id: e.id } });

  const pickFromSearch = (e: EventItem) => {
    // Событие может быть не в выбранных датах — переключаем дату на его день.
    let d = Math.max(0, dayIndex(e.startsAt) - today);
    if (e.isLong && occursOnDay(e, today)) d = 0;
    setFilters({ from: d, to: d, cats: [], free: false, max: 20000 });
    select(e.id);
    setSheet(null);
    mapRef.current?.flyTo(e.lat, e.lon);
  };

  // Стикер другу: облачко долетает до его точки, висит ~3 с и падает в личный чат. Не чаще раза в 10 минут.
  const sendSticker = (i: number) => {
    if (!focusPerson || fly) return;
    const st = STICKERS[i];
    // Лимиты считаем по настоящему времени (демо-часы только для вида карты).
    if (!canSendSticker(social.stickers[focusPerson.id], new Date())) {
      showToast({ text: `${focusPerson.name} уже получил стикер. Следующий — через 10 минут` });
      return;
    }
    social.sticker(focusPerson.id);
    setFly({ ...st, x: 28 + i * 66 });
    flyY.set(0);
    flyY.set(withTiming(-300, { duration: 650, easing: Easing.bezier(0.2, 0.9, 0.4, 1) }));
    setTimeout(() => {
      setFly(null);
      setBubble({ id: focusPerson.id, ...st });
      showToast({ text: `«${st.label}» ушёл: ${focusPerson.name} увидит на карте и в чате`, cta: 'Чат', onCta: () => router.push({ pathname: '/chat/[id]', params: { id: `dm-${focusPerson.id}` } }) });
    }, 700);
    setTimeout(() => setBubble(null), 3400);
  };

  const topY = Math.max(50, insets.top + 6);
  const cardDot = (e: EventItem) => (pinKind(e, today, going.has(e.id)) === 'hot' ? colors.accent : e.isLong ? colors.sand : colors.ink);

  return (
    <View style={[styles.root, { backgroundColor: dark ? '#1C1D21' : '#EFEBE2' }]}>
      <MapCanvas ref={mapRef} theme={theme} camera={ALMATY_CAMERA} markers={markers} bottomInset={selected ? 170 : 0} />

      {sheet === 'calendar' && <Backdrop onPress={() => { setSheet(null); setPending(false); }} opacity={0.32} label="Закрыть календарь" />}

      <View style={[styles.top, { top: topY }]}>
        <TopBar
          date={dateText}
          weather={weather}
          calOpen={sheet === 'calendar'}
          active={activeCount(filters)}
          onDate={() => { setSheet(sheet === 'calendar' ? null : 'calendar'); setPending(false); }}
          onSearch={() => setSheet('search')}
          onFilters={() => setSheet('filters')}
        />
      </View>

      {sheet === 'calendar' && (
        <DropCard label="Календарь" style={[styles.calendar, { top: topY + 62 }]}>
          <CalendarCard
            now={clock} events={upcoming} forecast={forecast} from={filters.from} to={filters.to} pending={pending}
            onPick={pickDay}
            onPreset={(from, to) => { setFilters({ from, to }); setPending(false); }}
            onShow={() => { setSheet(null); setPending(false); }}
            showText={showLabel(count)}
          />
        </DropCard>
      )}

      {sheet !== 'calendar' && !focusId && (
        <View style={[styles.side, { bottom: selected ? 244 : 96 }]}>
          <Pressable onPress={() => router.push('/create')} style={styles.sideBtn} accessibilityRole="button" accessibilityLabel="Создать встречу">
            <Svg width={20} height={20} viewBox="0 0 24 24"><Path d="M12 5v14M5 12h14" stroke={colors.ink} strokeWidth={2} strokeLinecap="round" /></Svg>
          </Pressable>
          <Pressable onPress={() => me && mapRef.current?.flyTo(me.lat, me.lon, 14)} style={styles.sideBtn} accessibilityRole="button" accessibilityLabel="Показать, где я">
            <Svg width={19} height={19} viewBox="0 0 24 24"><Path d="M20 4L4 11l7 2 2 7z" stroke={colors.ink} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" fill="none" /></Svg>
          </Pressable>
        </View>
      )}

      {focusId && focusPerson && (
        <View style={[styles.banner, { top: topY + 62 }]}>
          <Text style={styles.bannerText}>Показываю {genitive(focusPerson.name)}</Text>
          <Pressable onPress={() => { focusFriend(null); setSheet(null); }} style={styles.bannerX} accessibilityRole="button" accessibilityLabel="Показать всех на карте">
            <Ic d={IC.close} size={13} color="#FFFFFF" w={2.4} />
          </Pressable>
        </View>
      )}

      {focusId && focusPerson && focusSpot && !inviteOpen && (
        <View style={styles.card}>
          <FriendCard p={focusPerson} d={detailsOf(focusPerson.id)} spot={focusSpot} ring={focusSpot.state === 'paused' ? '#8C8577' : colors.friend}
            onProfile={() => router.push({ pathname: '/person/[id]', params: { id: focusPerson.id } })}
            onPlan={() => { const ev = detailsOf(focusPerson.id)?.planLine?.eventId; if (ev) router.push({ pathname: '/event/[id]', params: { id: ev } }); else router.push({ pathname: '/person/[id]', params: { id: focusPerson.id } }); }}
            onSticker={(i) => sendSticker(i)}
            onWrite={() => router.push({ pathname: '/chat/[id]', params: { id: `dm-${focusPerson.id}` } })}
            onInvite={() => setInviteOpen(true)} />
        </View>
      )}

      {fly && (
        <Animated.View exiting={FadeOut.duration(120)} pointerEvents="none" style={[styles.fly, { left: fly.x, backgroundColor: fly.bg }, flyStyle]}>
          <Text style={[styles.flyText, { color: fly.fg }]}>{fly.label}</Text>
        </Animated.View>
      )}

      {selected && sheet !== 'filters' && !focusId && (
        <View style={styles.card}>
          <EventCard e={selected} when={whenLabel(selected, clock, going.has(selected.id))} dotColor={cardDot(selected)} people={people} onOpen={() => openEvent(selected)} />
        </View>
      )}

      {sheet === 'filters' && (
        <>
          <Backdrop onPress={() => setSheet(null)} label="Закрыть фильтры" />
          <BottomSheet label="Фильтры">
            <FiltersSheet f={filters} set={setFilters} reset={resetFilters} onShow={() => setSheet(null)} showText={showLabel(count)} />
          </BottomSheet>
        </>
      )}

      {inviteOpen && focusPerson && (
        <>
          <Backdrop onPress={() => setInviteOpen(false)} label="Закрыть" />
          <BottomSheet label={`Позвать ${accusative(focusPerson.name)}`} style={{ gap: 14 }}>
            <InviteFriendSheet
              p={focusPerson}
              title={`Позвать ${accusative(focusPerson.name)}`}
              now={clock}
              ideas={ideasForTwo(tasteFrom({ interests: draft.interests, times: draft.times, withWho: draft.withWho, budget: draft.budget }, signals, clock), focusPerson.id, focusPerson.name, detailsOf(focusPerson.id)!, events, { now: clock, going, savedByFriend: focusPerson.id === 'igor' ? new Set(['standup']) : undefined })}
              onOwn={() => { setInviteOpen(false); router.push('/create'); }}
              onSend={(eventId) => {
                social.invite(focusPerson.id, eventId);
                usePlans.getState().invite(eventId, [focusPerson.id]);
                setInviteOpen(false);
                const ev = events.find((x) => x.id === eventId);
                showToast({ text: `Позвал ${accusative(focusPerson.name)} на «${ev?.title ?? 'встречу'}». Ответ придёт в чат`, cta: 'Чат', onCta: () => router.push({ pathname: '/chat/[id]', params: { id: `dm-${focusPerson.id}` } }) });
              }}
            />
          </BottomSheet>
        </>
      )}

      {toast && <Toast t={toast} style={{ position: 'absolute', left: 16, right: 16, top: topY + 112 }} />}

      {sheet === 'search' && (
        <SearchOverlay events={upcoming} whenOf={(e) => whenLabel(e, clock)} onPick={pickFromSearch} onClose={() => setSheet(null)} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden' },
  top: { position: 'absolute', left: 16, right: 16 },
  calendar: { position: 'absolute', left: 12, right: 12 },
  side: { position: 'absolute', right: 14, gap: 8 },
  sideBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.cardAlt, alignItems: 'center', justifyContent: 'center', shadowColor: colors.ink, shadowOpacity: 0.1, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  card: { position: 'absolute', left: 12, right: 12, bottom: 12 },
  banner: { position: 'absolute', left: 16, height: 38, paddingLeft: 12, paddingRight: 6, borderRadius: 19, backgroundColor: colors.friend, flexDirection: 'row', alignItems: 'center', gap: 10, shadowColor: colors.friend, shadowOpacity: 0.25, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 4 },
  bannerText: { fontFamily: fonts.body600, fontSize: 13, color: '#FFFFFF' },
  bannerX: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  fly: { position: 'absolute', bottom: 160, height: 36, paddingHorizontal: 12, borderRadius: 12, borderWidth: 2, borderColor: '#FFFFFF', justifyContent: 'center', zIndex: 80 },
  flyText: { fontFamily: fonts.display800, fontSize: 13 },
});
