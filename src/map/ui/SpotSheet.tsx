// Карточка постоянного места (21 октября): шапка — листаемые фото места (не загрузились — цвет места), значок места
// в углу, «открыто до 22:00 · перерыв 13–14», цена, как попасть бесплатно, советы, что внутри (у Кок-Тобе и Медеу),
// часы на неделю — и план: день и время барабаном (только реальные времена с шагом места). Кнопки: «Купить билет», «Kaspi», «Сайт», «Маршрут».
// «Один / с друзьями» убрано (26 окт.): просто «Запланировать», а позвать друзей можно сразу после.
import { remote } from '../../data/photos';
import { router } from 'expo-router';
import { ArrowUpRight, CalendarPlus, Check, ChevronDown, Lightbulb, Navigation, Ticket, Users, X } from 'lucide-react-native';
import { useMemo, useState, type ReactNode } from 'react';
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { inSeason, KIND_COLOR, KIND_LABEL, partsOf, seasonText, type Attraction } from '../../data/attractions';
import { almatyNow, openStatus, slotsFor, weekLines } from '../../data/hours';
import { spotPlan } from '../../data/spots';
import { dayIndex, now as clockNow } from '../../lib/clock';
import { DayTimeWheel, wheelDayLabel } from '../../event/ui/pickers';
import { config } from '../../lib/config';
import { createMeetup } from '../../live/api';
import { myId } from '../../live/auth';
import { usePlans } from '../../state/plans';
import { useApp } from '../../state/app';
import { colors, fonts } from '../../theme';
import { Backdrop, BottomSheet } from '../../ui/sheet';
import { AttractionPin } from './AttractionPin';

const WD = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];
const STATE_COLOR = { open: colors.ok, break: '#C98A1B', closed: '#C83A26', unknown: colors.muted } as const;

/** Блок-подсказка в одном стиле (совет, как попасть бесплатно): значок, заголовок, строки. */
function InfoCard({ icon, title, lines }: { icon: ReactNode; title: string; lines: string[] }) {
  return (
    <View style={styles.info}>
      <View style={styles.infoHead}><View style={styles.infoIcon}>{icon}</View><Text style={styles.infoTitle}>{title}</Text></View>
      {lines.map((t) => <Text key={t} style={styles.infoText}>{t}</Text>)}
    </View>
  );
}

export function SpotSheet({ a, all, onClose, onOpen }: { a: Attraction; all: Attraction[]; onClose: () => void; onOpen?: (a: Attraction) => void }) {
  const now = clockNow();
  const color = KIND_COLOR[a.kind];
  const status = openStatus(a.hours, now);
  const season = inSeason(a, now);
  const parts = partsOf(all, a.id);
  const lines = weekLines(a.hours);
  const [week, setWeek] = useState(false);
  const [day, setDay] = useState(0);
  const [time, setTime] = useState<string | null>(null);
  const { width } = useWindowDimensions();
  const [broken, setBroken] = useState<string[]>([]);
  const [page, setPage] = useState(0);
  const photos = (a.photos ?? []).filter((u) => !broken.includes(u));
  const [saved, setSaved] = useState<string | null>(null);
  // Барабан времени появляется только после «Пойду» (27 окт.): раньше висел на карточке постоянно.
  const [planning, setPlanning] = useState(false);
  const [busy, setBusy] = useState(false);
  const addMeetup = usePlans((s) => s.addMeetup);
  const addPlan = useApp((s) => s.addPlan);
  const { day: todayIso, min } = almatyNow(now);
  const today = dayIndex(now);
  // Две недели вперёд, только дни, когда открыто; времена — с шагом места.
  const days = useMemo(() => Array.from({ length: 14 }, (_, k) => {
    const iso = ((todayIso - 1 + k) % 7) + 1;
    const slots = slotsFor(a.hours, iso, k === 0 ? min + 30 : 0, a.stepMin ?? 30);
    return { k, iso, label: k === 0 ? 'сегодня' : k === 1 ? 'завтра' : WD[iso - 1], slots };
  }).filter((d) => d.slots.length), [a.hours, a.stepMin, todayIso, min]);
  const cur = days.find((d) => d.k === day) ?? days[0];
  const pick = cur && (time && cur.slots.includes(time) ? time : cur.slots[0]);
  const go = (url: string) => { void Linking.openURL(url).catch(() => undefined); };

  const plan = async () => {
    if (!cur || !pick || busy) return;
    setBusy(true);
    const base = new Date(now.getTime() + 5 * 3600e3 + cur.k * 86400e3);
    const ymd = base.toISOString().slice(0, 10);
    setDay(cur.k); setTime(pick);
    let e = spotPlan(a, `${ymd}T${pick}:00+05:00`, false);
    // На сервере план живёт как своя встреча без приглашённых: переживёт переустановку, друзья увидят «идёт на Кок-Тобе».
    if (config.dataMode !== 'demo') { try { e = { ...e, id: await createMeetup(e), createdBy: myId() ?? undefined, origin: 'real' }; } catch { /* без сети — только на телефоне */ } }
    addMeetup(e); addPlan();
    setSaved(e.id); setBusy(false);
  };

  return (
    <>
      <Backdrop label="Закрыть" onPress={onClose} />
      <BottomSheet onClose={onClose} label={a.name} scroll style={{ paddingTop: 0, paddingHorizontal: 0, paddingBottom: 28 }}>
        <View style={[styles.hero, photos.length > 0 && styles.heroPhoto]}>
          <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
            <Defs><LinearGradient id="spotHero" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor={color} stopOpacity={0.95} /><Stop offset="1" stopColor={color} stopOpacity={0.55} /></LinearGradient></Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#spotHero)" />
          </Svg>
          {photos.length > 0 ? (
            <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} style={StyleSheet.absoluteFill}
              onMomentumScrollEnd={(ev) => setPage(Math.round(ev.nativeEvent.contentOffset.x / Math.max(1, width)))}>
              {photos.map((u) => <Image key={u} source={remote(u)} style={{ width, height: '100%' }} resizeMode="cover" onError={() => setBroken((b) => [...b, u])} accessibilityIgnoresInvertColors />)}
            </ScrollView>
          ) : (
            <View style={styles.heroIcon} pointerEvents="none"><View style={{ transform: [{ scale: 1.6 }] }}><AttractionPin a={a} label={false} onPress={() => undefined} /></View></View>
          )}
          {photos.length > 0 && (
            <>
              <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" pointerEvents="none">
                <Defs><LinearGradient id="spotShade" x1="0" y1="0" x2="0" y2="1"><Stop offset="0.55" stopColor="#17161A" stopOpacity={0} /><Stop offset="1" stopColor="#17161A" stopOpacity={0.55} /></LinearGradient></Defs>
                <Rect x="0" y="0" width="100%" height="100%" fill="url(#spotShade)" />
              </Svg>
              <View style={styles.cornerIcon} pointerEvents="none"><AttractionPin a={a} label={false} onPress={() => undefined} /></View>
              {photos.length > 1 && <View style={styles.dots} pointerEvents="none">{photos.map((u, i) => <View key={u} style={[styles.pdot, i === page && styles.pdotOn]} />)}</View>}
            </>
          )}
          <Pressable onPress={onClose} style={styles.close} accessibilityRole="button" accessibilityLabel="Закрыть"><X size={20} color="#FFFFFF" strokeWidth={2.2} /></Pressable>
          <Text style={[styles.heroKind, photos.length > 0 && { left: 70 }]} pointerEvents="none">{KIND_LABEL[a.kind].toUpperCase()}</Text>
        </View>

        <View style={styles.body}>
          <Text style={styles.title} accessibilityRole="header">{a.name}</Text>
          <Text style={styles.about}>{a.about}</Text>

          <View style={styles.status}>
            <View style={[styles.dot, { backgroundColor: season ? STATE_COLOR[status.state] : STATE_COLOR.closed }]} />
            <Text style={styles.statusText}>{season ? status.text : seasonText(a, now)}</Text>
            {season && status.breakText && <Text style={styles.statusSub}>· {status.breakText}</Text>}
          </View>
          <View style={styles.tags}>
            {a.free && <View style={styles.tag}><Check size={13} color={colors.ink} strokeWidth={2.6} /><Text style={styles.tagText}>бесплатно</Text></View>}
            {!a.free && a.priceFrom ? <View style={styles.tag}><Text style={styles.tagText}>от {a.priceFrom.toLocaleString('ru-RU')} ₸</Text></View> : null}
            {season && a.season && <View style={styles.tag}><Text style={styles.tagText}>{seasonText(a, now)}</Text></View>}
            {!!a.address && <View style={styles.tag}><Text style={styles.tagText} numberOfLines={1}>{a.address}</Text></View>}
          </View>

          {!!a.howTo && <InfoCard icon={<Check size={15} color={colors.ink} strokeWidth={2.6} />} title={a.free ? 'Бесплатно' : 'Как попасть'} lines={[a.howTo]} />}

          {!!a.tips?.length && <InfoCard icon={<Lightbulb size={15} color={colors.ink} strokeWidth={2.2} />} title={a.tips.length > 1 ? 'Советы' : 'Совет'} lines={a.tips} />}

          {parts.length > 0 && (
            <View style={{ gap: 8 }}>
              <Text style={styles.cap}>ЧТО ВНУТРИ</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {parts.map((p) => (
                  <Pressable key={p.id} onPress={() => onOpen?.(p)} style={({ pressed }) => [styles.part, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel={p.name}>
                    <View style={{ height: 52, alignItems: 'center', justifyContent: 'center' }} pointerEvents="none"><AttractionPin a={p} label={false} onPress={() => undefined} /></View>
                    <Text style={styles.partName} numberOfLines={2}>{p.name}</Text>
                    {p.free ? <Text style={styles.partFree}>бесплатно</Text> : p.priceFrom ? <Text style={styles.partFree}>от {p.priceFrom.toLocaleString('ru-RU')} ₸</Text> : null}
                    {p.hours && Object.keys(p.hours).length > 0 && <Text style={styles.partHours} numberOfLines={1}>{openStatus(p.hours, now).text}</Text>}
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}

          {lines.length > 0 && (
            <View style={styles.week}>
              <Pressable onPress={() => setWeek((v) => !v)} style={styles.weekHead} accessibilityRole="button" accessibilityState={{ expanded: week }}>
                <Text style={styles.weekTitle}>Часы работы</Text>
                <ChevronDown size={18} color={colors.ink} strokeWidth={2.2} style={{ transform: [{ rotate: week ? '180deg' : '0deg' }] }} />
              </Pressable>
              {week && lines.map((l) => (
                <View key={l.days} style={styles.weekRow}><Text style={styles.weekDays}>{l.days}</Text><Text style={[styles.weekTime, l.time === 'выходной' && { color: colors.accentText }]}>{l.time}</Text></View>
              ))}
            </View>
          )}

          {/* План: сначала «Пойду», потом день и время барабаном. Время предлагается только когда место открыто. */}
          {saved ? (
            <View style={{ gap: 8 }}>
              <View style={styles.done}><Check size={18} color={colors.ink} strokeWidth={2.6} /><Text style={styles.doneText}>В планах · {cur ? wheelDayLabel(today + cur.k, today).toLowerCase() : ''} {pick}. Напомню за час</Text></View>
              <Pressable onPress={() => { onClose(); router.push({ pathname: '/event/[id]', params: { id: saved, invite: '1' } }); }} style={[styles.btn, styles.main]} accessibilityRole="button"><Users size={18} color={colors.ink} strokeWidth={2} /><Text style={styles.btnText}>Позвать друзей</Text></Pressable>
            </View>
          ) : !planning ? (
            <Pressable onPress={() => setPlanning(true)} style={({ pressed }) => [styles.btn, styles.main, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel="Пойду: выбрать день и время">
              <CalendarPlus size={18} color={colors.ink} strokeWidth={2} /><Text style={styles.btnText}>Пойду</Text>
            </Pressable>
          ) : (
            <View style={styles.planBox}>
              <Text style={styles.planTitle}>Когда пойдёшь?</Text>
              {cur ? (
                <View style={styles.wheelBox}>
                  <DayTimeWheel days={days.map((d) => ({ key: d.k, label: wheelDayLabel(today + d.k, today), times: d.slots }))} day={cur.k} time={pick ?? null}
                    onChange={(k, t) => { setDay(k); setTime(t); }} />
                </View>
              ) : <Text style={styles.statusSub}>Ближайшие две недели закрыто{season ? '' : ` — ${seasonText(a, now)}`}</Text>}
              <Pressable disabled={!pick || busy} onPress={() => void plan()} style={[styles.btn, styles.main, (!pick || busy) && { opacity: 0.45 }]} accessibilityRole="button">
                <CalendarPlus size={18} color={colors.ink} strokeWidth={2} />
                <Text style={styles.btnText}>{busy ? 'Сохраняю…' : pick && cur ? `Пойду · ${cur.label} ${pick}` : 'Выбери время'}</Text>
              </Pressable>
            </View>
          )}

          <View style={styles.actions}>
            {a.buy && !a.free && <Pressable onPress={() => go(a.buy!)} style={({ pressed }) => [styles.btn, styles.dark, pressed && styles.pressed]} accessibilityRole="link"><Ticket size={18} color={colors.paper} strokeWidth={2} /><Text style={[styles.btnText, { color: colors.paper }]}>Купить билет</Text></Pressable>}
            {a.kaspi && <Pressable onPress={() => go(a.kaspi!)} style={({ pressed }) => [styles.btn, styles.kaspi, pressed && styles.pressed]} accessibilityRole="link" accessibilityLabel="Оплатить в Kaspi"><Text style={[styles.btnText, { color: '#FFFFFF' }]}>Kaspi</Text></Pressable>}
            {a.info && <Pressable onPress={() => go(a.info!)} style={({ pressed }) => [styles.btn, pressed && styles.pressed]} accessibilityRole="link" accessibilityLabel={`Сайт: ${a.name}`}><ArrowUpRight size={18} color={colors.ink} strokeWidth={2} /><Text style={styles.btnText}>Сайт</Text></Pressable>}
            <Pressable onPress={() => { onClose(); router.push({ pathname: '/route', params: { id: `place-${a.id}`, lat: String(a.lat), lon: String(a.lon), title: a.name, address: a.address ?? '' } }); }}
              style={({ pressed }) => [styles.btn, styles.square, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel={`Маршрут: ${a.name}`}><Navigation size={18} color={colors.ink} strokeWidth={2} /></Pressable>
          </View>
          {a.checkedAt && <Text style={styles.checked}>Часы и цены проверены {new Date(a.checkedAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}</Text>}
        </View>
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  heroPhoto: { height: 230 },
  cornerIcon: { position: 'absolute', left: 6, bottom: -6, transform: [{ scale: 0.9 }] },
  dots: { position: 'absolute', right: 16, bottom: 14, flexDirection: 'row', gap: 5 },
  pdot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.55)' },
  pdotOn: { width: 16, backgroundColor: '#FFFFFF' },
  info: { padding: 14, borderRadius: 18, backgroundColor: '#EDE8DD', gap: 6 },
  infoHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoIcon: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#E1DACB', alignItems: 'center', justifyContent: 'center' },
  infoTitle: { fontFamily: fonts.body700, fontSize: 14.5, color: colors.ink },
  infoText: { fontFamily: fonts.body400, fontSize: 14, lineHeight: 20, color: colors.muted2 },
  hero: { height: 132, borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  heroIcon: { width: 110, height: 110, alignItems: 'center', justifyContent: 'center' },
  heroKind: { position: 'absolute', left: 16, bottom: 10, fontFamily: fonts.mono600, fontSize: 10.5, letterSpacing: 0.8, color: '#FFFFFF' },
  close: { position: 'absolute', right: 12, top: 12, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(23,22,26,0.28)', alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: 18, paddingTop: 14, gap: 12 },
  title: { fontFamily: fonts.display800, fontSize: 25, letterSpacing: -0.6, color: colors.ink },
  about: { fontFamily: fonts.body400, fontSize: 15, lineHeight: 21, color: colors.muted2, marginTop: -6 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  dot: { width: 9, height: 9, borderRadius: 5 },
  statusText: { fontFamily: fonts.body700, fontSize: 15, color: colors.ink },
  statusSub: { fontFamily: fonts.body400, fontSize: 13.5, color: colors.muted2 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 28, maxWidth: '100%', paddingHorizontal: 10, borderRadius: 14, backgroundColor: colors.sand },
  tagSolo: { backgroundColor: '#F7D9C9' },
  tagText: { fontFamily: fonts.body600, fontSize: 12.5, color: colors.ink, flexShrink: 1 },
  cap: { fontFamily: fonts.mono600, fontSize: 10.5, letterSpacing: 0.8, color: colors.muted },
  part: { width: 118, padding: 10, borderRadius: 18, backgroundColor: '#EDE8DD', gap: 4 },
  partName: { fontFamily: fonts.body700, fontSize: 13, lineHeight: 16, color: colors.ink },
  partFree: { fontFamily: fonts.body600, fontSize: 11, color: '#1F6B43' },
  week: { borderRadius: 18, backgroundColor: '#EDE8DD', paddingHorizontal: 14, paddingVertical: 4 },
  weekHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  weekTitle: { fontFamily: fonts.body700, fontSize: 14.5, color: colors.ink },
  weekRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line2 },
  weekDays: { fontFamily: fonts.body600, fontSize: 13.5, color: colors.ink },
  weekTime: { fontFamily: fonts.mono500, fontSize: 12.5, color: colors.ink },
  planBox: { padding: 14, borderRadius: 22, backgroundColor: '#EDE8DD', gap: 10 },
  planTitle: { fontFamily: fonts.display700, fontSize: 18, color: colors.ink },
  partHours: { fontFamily: fonts.body500, fontSize: 11, color: colors.muted },
  wheelBox: { borderRadius: 18, backgroundColor: '#F5F1E8', overflow: 'hidden' },
  done: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 14, backgroundColor: '#EDE8DD' },
  doneText: { flex: 1, fontFamily: fonts.body600, fontSize: 14, color: colors.ink },
  actions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  btn: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0, flexDirection: 'row', gap: 6, height: 50, borderRadius: 16, backgroundColor: '#EDE8DD', alignItems: 'center', justifyContent: 'center' },
  main: { backgroundColor: colors.accent, flexBasis: 'auto' },
  dark: { backgroundColor: colors.ink },
  kaspi: { backgroundColor: '#E8262C', flexGrow: 0, flexBasis: 80 },
  square: { flexGrow: 0, flexShrink: 0, flexBasis: 50, width: 50 },
  btnText: { fontFamily: fonts.body700, fontSize: 14.5, color: colors.ink },
  checked: { fontFamily: fonts.body400, fontSize: 12, color: colors.muted },
  pressed: { transform: [{ scale: 0.97 }] },
});
