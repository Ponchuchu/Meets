// Карта — вкладка по умолчанию (design/png/Main.png, MapCalendar.png, MapFilters.png).
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { data, eventsSnapshot, type EventItem } from '../../src/data';
import { DEMO_FORECAST } from '../../src/data/weather';
import { almaty, dayIndex, now as clockNow } from '../../src/lib/clock';
import { rangeLabel } from '../../src/map/calendar';
import { activeCount, occursOnDay, showLabel, visibleEvents } from '../../src/map/filters';
import { phaseOf, whenLabel } from '../../src/map/lifecycle';
import { MapCanvas } from '../../src/map/MapCanvas';
import { EventPin, FriendPin, MePin, type PinKind } from '../../src/map/pins';
import { autoTheme } from '../../src/map/style';
import { ALMATY_CAMERA, type MapCanvasHandle, type MapMarker } from '../../src/map/types';
import { CalendarCard } from '../../src/map/ui/CalendarCard';
import { EventCard } from '../../src/map/ui/EventCard';
import { FiltersSheet } from '../../src/map/ui/FiltersSheet';
import { SearchOverlay } from '../../src/map/ui/SearchOverlay';
import { TopBar } from '../../src/map/ui/TopBar';
import { useMapState } from '../../src/state/map';
import { colors } from '../../src/theme';
import { Backdrop, BottomSheet, DropCard } from '../../src/ui/sheet';

type Sheet = null | 'calendar' | 'filters' | 'search';

function pinKind(e: EventItem, today: number): PinKind {
  const isToday = dayIndex(e.startsAt) === today;
  if (e.friendsGoing.length && !e.isLong && isToday) return 'hot';
  if (e.goingCount >= 1000 && !e.isLong) return 'popular';
  if (e.friendsGoing.length && !e.isLong) return 'labeled';
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
  const { filters, setFilters, resetFilters, selectedId, select } = useMapState();

  // Время идёт — точки живут: обновляем раз в минуту.
  useEffect(() => {
    const t = setInterval(() => setClock(clockNow()), 60000);
    return () => clearInterval(t);
  }, []);

  const { data: events = [] } = useQuery({ queryKey: ['events'], queryFn: () => data.getEvents(), placeholderData: eventsSnapshot });
  const { data: people = [] } = useQuery({ queryKey: ['people'], queryFn: () => data.getPeople() });
  const { data: spots = [] } = useQuery({ queryKey: ['friendSpots'], queryFn: () => data.getFriendSpots() });
  const { data: me } = useQuery({ queryKey: ['mySpot'], queryFn: () => data.getMySpot() });

  const today = dayIndex(clock);
  const theme = autoTheme(almaty(clock).getUTCHours());
  const dark = theme === 'night';
  const visible = useMemo(() => visibleEvents(events, filters, clock), [events, filters, clock]);
  const upcoming = useMemo(() => events.filter((e) => phaseOf(e, clock) !== 'hidden'), [events, clock]);

  const selected = visible.find((e) => e.id === selectedId)
    ?? visible.find((e) => pinKind(e, today) === 'hot')
    ?? visible.find((e) => e.friendsGoing.length > 0)
    ?? visible[0];

  const markers: MapMarker[] = useMemo(() => {
    const list: MapMarker[] = visible.map((e) => {
      const kind = pinKind(e, today);
      return {
        id: `e-${e.id}`, lat: e.lat, lon: e.lon, z: kind === 'hot' ? 30 : kind === 'plain' ? 10 : 20,
        node: (
          <EventPin e={e} kind={kind} phase={phaseOf(e, clock)} label={kind === 'hot' || kind === 'labeled' ? pinLabel(e, today) : undefined}
            showCompany={filters.company} dark={dark} onPress={() => { select(e.id); setSheet(null); }} />
        ),
      };
    });
    if (filters.friends) {
      for (const s of spots) {
        const p = people.find((x) => x.id === s.personId);
        if (!p) continue;
        list.push({ id: `f-${p.id}`, lat: s.lat, lon: s.lon, z: 40, node: <FriendPin person={p} spot={s} onPress={() => mapRef.current?.flyTo(s.lat, s.lon)} /> });
      }
    }
    if (me) list.push({ id: 'me', lat: me.lat, lon: me.lon, z: 35, node: <MePin /> });
    return list;
  }, [visible, spots, people, me, filters.friends, filters.company, clock, today, dark, select]);

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

  const topY = Math.max(50, insets.top + 6);
  const cardDot = (e: EventItem) => (pinKind(e, today) === 'hot' ? colors.accent : e.isLong ? colors.sand : colors.ink);

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

      {sheet !== 'calendar' && (
        <View style={[styles.side, { bottom: selected ? 244 : 96 }]}>
          <Pressable onPress={() => router.push('/create')} style={styles.sideBtn} accessibilityRole="button" accessibilityLabel="Создать встречу">
            <Svg width={20} height={20} viewBox="0 0 24 24"><Path d="M12 5v14M5 12h14" stroke={colors.ink} strokeWidth={2} strokeLinecap="round" /></Svg>
          </Pressable>
          <Pressable onPress={() => me && mapRef.current?.flyTo(me.lat, me.lon, 14)} style={styles.sideBtn} accessibilityRole="button" accessibilityLabel="Показать, где я">
            <Svg width={19} height={19} viewBox="0 0 24 24"><Path d="M20 4L4 11l7 2 2 7z" stroke={colors.ink} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" fill="none" /></Svg>
          </Pressable>
        </View>
      )}

      {selected && sheet !== 'filters' && (
        <View style={styles.card}>
          <EventCard e={selected} when={whenLabel(selected, clock)} dotColor={cardDot(selected)} people={people} onOpen={() => openEvent(selected)} />
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
});
