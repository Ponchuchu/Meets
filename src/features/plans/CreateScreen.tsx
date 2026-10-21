// «Новая встреча» (переделано 21 октября): сначала место — карта на весь экран, двигаешь её под булавкой,
// адрес подтягивается сам (свой справочник адресов, затем OpenStreetMap) или ищется строкой сверху.
// Снизу шторка: название, пара слов, когда (дни и время одним касанием), кого позвать или «все на карте».
// Выбор «темы» убран: встреча — это просто встреча. На карте она — свой значок с временем и лицами друзей.
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Check, ChevronLeft, Clock, Globe, Lock, MapPin, Search, X } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { data } from '../../data';
import { buildMeetup, DISTRICTS, validateMeetup, type MeetupForm } from '../../event/meetup';
import { TimeWheel } from '../../event/ui/pickers';
import { almaty, dayIndex, dayStart, now as clockNow } from '../../lib/clock';
import { uid } from '../../lib/uid';
import { config } from '../../lib/config';
import { myId } from '../../live/auth';
import { createMeetup } from '../../live/api';
import { nearestAddress, searchAddresses, type AddressHit } from '../../live/addresses';
import { useMyPos } from '../../live/location';
import { queryClient } from '../../live/query';
import { MapCanvas } from '../../map/MapCanvas';
import type { MapCanvasHandle } from '../../map/types';
import { useApp } from '../../state/app';
import { useMapState } from '../../state/map';
import { displayName, isFriendNow, useSocial } from '../../state/social';
import { usePlans } from '../../state/plans';
import { colors, fonts } from '../../theme';
import { Avatar } from '../../ui/Avatar';
import { glass } from '../../ui/glass';
import { Backdrop, BottomSheet } from '../../ui/sheet';

const WD = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
const ALMATY = { lat: 43.2389, lon: 76.8897 };

/** Ближайший район — его видят все, кому не показываем точный адрес. */
function districtOf(p: { lat: number; lon: number }): string {
  return Object.entries(DISTRICTS).sort(([, a], [, b]) => Math.hypot(a.lat - p.lat, a.lon - p.lon) - Math.hypot(b.lat - p.lat, b.lon - p.lon))[0][0];
}

/** Ближайшее «круглое» время через час: 18:40 → 20:00. */
function nextTime(now: Date): { dayOffset: number; time: string } {
  const a = almaty(now);
  let h = a.getUTCHours() + (a.getUTCMinutes() > 0 ? 2 : 1);
  let dayOffset = 0;
  if (h >= 23) { h = 19; dayOffset = 1; }
  return { dayOffset, time: `${String(h).padStart(2, '0')}:00` };
}

export default function CreateScreen() {
  const insets = useSafeAreaInsets();
  const now = useMemo(() => clockNow(), []);
  const me = useMyPos();
  const start = useMemo(() => (me ? { lat: me.lat, lon: me.lon } : ALMATY), []); // eslint-disable-line react-hooks/exhaustive-deps
  const submitting = useRef(false);
  const requestId = useRef(uid('meet'));
  const [busy, setBusy] = useState(false);
  const { data: people = [] } = useQuery({ queryKey: ['people'], queryFn: () => data.getPeople() });
  const addMeetup = usePlans((s) => s.addMeetup);
  const addPlan = useApp((s) => s.addPlan);
  const select = useMapState((s) => s.select);
  const setFilters = useMapState((s) => s.setFilters);
  const [error, setError] = useState<string | null>(null);
  const [timeSheet, setTimeSheet] = useState(false);
  const [f, setF] = useState<MeetupForm>(() => ({
    mode: 'friends', kind: 'walk', title: '', note: '', ...nextTime(now), place: '', district: districtOf(start), address: '',
    invited: [], plusOne: false, items: [], point: start, entrance: '', floor: '', apt: '',
  }));
  const set = (patch: Partial<MeetupForm>) => { setF((s) => ({ ...s, ...patch })); setError(null); };

  // ——— Место: карта под булавкой, адрес сам, поиск строкой ———
  const map = useRef<MapCanvasHandle>(null);
  const [resolving, setResolving] = useState(false);
  const revision = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lift = useSharedValue(0);
  const pin = useAnimatedStyle(() => ({ transform: [{ translateY: -14 * lift.get() }, { scale: 1 + 0.06 * lift.get() }] }));
  const shadow = useAnimatedStyle(() => ({ transform: [{ scaleX: 1 - 0.35 * lift.get() }], opacity: 0.35 - 0.2 * lift.get() }));
  const onMoving = (m: boolean) => { lift.set(withSpring(m ? 1 : 0, { damping: m ? 18 : 9, stiffness: 220 })); };
  const onCenter = (lat: number, lon: number) => {
    const rev = ++revision.current;
    set({ point: { lat, lon }, district: districtOf({ lat, lon }) });
    if (timer.current) clearTimeout(timer.current);
    setResolving(true);
    timer.current = setTimeout(async () => {
      try {
        const own = await nearestAddress(lat, lon).catch(() => null);
        let label = own;
        if (!label) {
          const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&accept-language=ru&zoom=18&lat=${lat}&lon=${lon}`);
          const j = (await r.json()) as { address?: { road?: string; house_number?: string; pedestrian?: string } };
          label = [j.address?.road ?? j.address?.pedestrian, j.address?.house_number].filter(Boolean).join(' ') || null;
        }
        if (revision.current === rev) setF((s) => ({ ...s, address: label ?? s.address }));
      } catch { /* без сети — адрес можно вписать руками */ }
      finally { if (revision.current === rev) setResolving(false); }
    }, 450);
  };
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<AddressHit[]>([]);
  useEffect(() => {
    if (q.trim().length < 3) return;
    const ac = new AbortController();
    const t = setTimeout(() => { searchAddresses(q, ac.signal, f.point ?? start).then((r) => { if (!ac.signal.aborted) setHits(r.slice(0, 5)); }).catch(() => undefined); }, 300);
    return () => { clearTimeout(t); ac.abort(); };
  }, [q]); // eslint-disable-line react-hooks/exhaustive-deps
  const choose = (h: AddressHit) => {
    revision.current++;
    setQ(''); setHits([]);
    set({ point: { lat: h.lat, lon: h.lon }, address: h.label.split(',').slice(0, 2).join(','), district: districtOf(h) });
    map.current?.flyTo(h.lat, h.lon, 16.5);
  };

  // ——— Кто ———
  const social = useSocial();
  const friends = useMemo(() => people.filter((p) => isFriendNow(p, social)), [people, social]);
  const toggle = (id: string) => set({ invited: f.invited.includes(id) ? f.invited.filter((x) => x !== id) : [...f.invited, id] });

  // ——— Когда: неделя чипами + время чипами каждые полчаса, «другое» — барабан ———
  const days = Array.from({ length: 7 }, (_, k) => { const d = almaty(dayStart(dayIndex(now) + k)); return { k, label: k === 0 ? 'сегодня' : k === 1 ? 'завтра' : WD[d.getUTCDay()], num: d.getUTCDate() }; });
  const nowMin = almaty(now).getUTCHours() * 60 + almaty(now).getUTCMinutes();
  const times = Array.from({ length: 32 }, (_, i) => 8 * 60 + i * 30).filter((m) => f.dayOffset > 0 || m > nowMin + 30).map((m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`);

  const submit = async () => {
    if (submitting.current) return;
    const form = { ...f, title: f.title.trim() || (f.place.trim() ? `Встреча · ${f.place.trim()}` : 'Встреча') };
    const err = validateMeetup(form, now);
    if (err) { setError(err); return; }
    submitting.current = true; setBusy(true);
    try {
      let e = { ...buildMeetup(form, now), id: requestId.current };
      if (config.dataMode !== 'demo') e = { ...e, id: await createMeetup(e), createdBy: myId() ?? undefined, origin: 'real' };
      addMeetup(e); addPlan();
      setFilters({ soon: false, from: form.dayOffset, to: form.dayOffset, free: false, cats: [] });
      select(e.id);
      void queryClient.invalidateQueries({ queryKey: ['events'] });
      router.dismissTo('/plans');
    } catch { setError('Не удалось создать встречу. Проверь связь и попробуй ещё раз'); }
    finally { submitting.current = false; setBusy(false); }
  };
  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const cta = busy ? 'Создаю встречу…' : f.mode === 'open' ? 'Опубликовать на карте' : f.invited.length ? `Позвать · ${f.invited.length}` : 'Выбери, кого позвать';

  return (
    <View style={styles.root}>
      <View style={styles.mapArea}>
        <MapCanvas ref={map} theme="paper" camera={{ ...start, zoom: 16 }} markers={[]} onCenter={onCenter} onMoving={onMoving} />
        {/* Булавка: при движении карты приподнимается, тень сжимается; отпустил — «падает» на место. */}
        <View pointerEvents="none" style={styles.pinWrap}>
          <Animated.View style={[styles.pinShadow, shadow]} />
          <Animated.View style={[styles.pinBody, pin]}>
            <View style={styles.pinHead}><MapPin size={20} color={colors.ink} strokeWidth={2.4} /></View>
            <View style={styles.pinLeg} />
          </Animated.View>
          <View style={styles.addrPill}>
            <Text style={styles.addrText} numberOfLines={1}>{resolving ? 'Ищу адрес…' : f.address || 'Подвинь карту'}</Text>
          </View>
        </View>
        <View style={[styles.top, { top: Math.max(14, insets.top + 6) }]}>
          <Pressable onPress={close} style={[styles.round, glass]} accessibilityRole="button" accessibilityLabel="Закрыть"><ChevronLeft size={22} color={colors.ink} strokeWidth={2.2} /></Pressable>
          <View style={[styles.search, glass]}>
            <Search size={17} color={colors.muted} strokeWidth={2} />
            <TextInput value={q} onChangeText={(t) => { setQ(t); setHits([]); }} placeholder="Найти улицу или место" placeholderTextColor={colors.muted3} style={styles.searchInput} accessibilityLabel="Найти адрес" returnKeyType="search" onSubmitEditing={() => hits[0] && choose(hits[0])} />
            {!!q && <Pressable onPress={() => { setQ(''); setHits([]); }} hitSlop={10} accessibilityRole="button" accessibilityLabel="Очистить"><X size={17} color={colors.muted} strokeWidth={2} /></Pressable>}
          </View>
        </View>
        {hits.length > 0 && (
          <View style={[styles.hits, glass, { top: Math.max(14, insets.top + 6) + 56 }]}>
            {hits.map((h, i) => (
              <Pressable key={h.id} onPress={() => choose(h)} style={[styles.hit, i < hits.length - 1 && styles.hitLine]} accessibilityRole="button">
                <MapPin size={16} color={colors.muted2} strokeWidth={2} /><Text style={styles.hitText} numberOfLines={2}>{h.label}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      <KeyboardAvoidingView behavior="padding" style={[styles.sheet, glass, { paddingBottom: 14 + insets.bottom }]}>
        <ScrollView contentContainerStyle={{ gap: 14, paddingBottom: 6 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.grabber} />
          <TextInput value={f.title} onChangeText={(title) => set({ title })} style={styles.title} placeholder="Как назовём встречу?" placeholderTextColor={colors.muted3} accessibilityLabel="Название встречи" maxLength={60} />
          <TextInput value={f.note} onChangeText={(note) => set({ note })} multiline style={styles.note} placeholder="Пара слов: что будем делать, что взять" placeholderTextColor={colors.muted3} accessibilityLabel="Описание" maxLength={300} />

          <View style={styles.placeRow}>
            <MapPin size={18} color={colors.accent} strokeWidth={2.2} />
            <View style={{ flex: 1 }}>
              <TextInput value={f.place} onChangeText={(place) => set({ place })} placeholder="Место: кафе, парк, «у меня»" placeholderTextColor={colors.muted3} style={styles.placeInput} accessibilityLabel="Название места" maxLength={60} />
              <TextInput value={f.address} onChangeText={(address) => set({ address })} placeholder="Адрес" placeholderTextColor={colors.muted3} style={styles.addrInput} accessibilityLabel="Адрес" maxLength={120} />
            </View>
          </View>

          <View style={{ gap: 8 }}>
            <Text style={styles.cap}>КОГДА</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
              {days.map((d) => (
                <Pressable key={d.k} onPress={() => set({ dayOffset: d.k })} style={[styles.day, f.dayOffset === d.k && styles.dark]} accessibilityRole="button" accessibilityState={{ selected: f.dayOffset === d.k }}>
                  <Text style={[styles.dayWd, f.dayOffset === d.k && { color: '#BDB8AD' }]}>{d.label}</Text>
                  <Text style={[styles.dayNum, f.dayOffset === d.k && { color: colors.paper }]}>{d.num}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
              <Pressable onPress={() => setTimeSheet(true)} style={[styles.slot, styles.slotOther]} accessibilityRole="button" accessibilityLabel={`Другое время, сейчас ${f.time}`}>
                <Clock size={15} color={colors.ink} strokeWidth={2} /><Text style={styles.slotText}>{times.includes(f.time) ? 'другое' : f.time}</Text>
              </Pressable>
              {times.map((t) => (
                <Pressable key={t} onPress={() => set({ time: t })} style={[styles.slot, f.time === t && styles.dark]} accessibilityRole="button" accessibilityState={{ selected: f.time === t }}>
                  <Text style={[styles.slotText, f.time === t && { color: colors.paper }]}>{t}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          <View style={styles.modes}>
            <Pressable onPress={() => set({ mode: 'friends' })} style={[styles.mode, f.mode === 'friends' && styles.dark]} accessibilityRole="radio" accessibilityState={{ selected: f.mode === 'friends' }}>
              <Lock size={16} color={f.mode === 'friends' ? colors.paper : colors.ink} strokeWidth={2} /><Text style={[styles.modeText, f.mode === 'friends' && { color: colors.paper }]}>Только позванные</Text>
            </Pressable>
            <Pressable onPress={() => set({ mode: 'open' })} style={[styles.mode, f.mode === 'open' && styles.dark]} accessibilityRole="radio" accessibilityState={{ selected: f.mode === 'open' }}>
              <Globe size={16} color={f.mode === 'open' ? colors.paper : colors.ink} strokeWidth={2} /><Text style={[styles.modeText, f.mode === 'open' && { color: colors.paper }]}>Все на карте</Text>
            </Pressable>
          </View>
          <Text style={styles.hint}>{f.mode === 'open' ? `Все увидят встречу и район «${f.district}». Точный адрес — только тем, кто придёт.` : 'Встречу и адрес увидят только те, кого позовёшь.'}</Text>

          {friends.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
              {friends.map((p) => {
                const on = f.invited.includes(p.id);
                return (
                  <Pressable key={p.id} onPress={() => toggle(p.id)} style={styles.friend} accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={displayName(p, social.nicknames)}>
                    <View><Avatar p={p} size={52} ring={on ? colors.accent : undefined} />{on && <View style={styles.tick}><Check size={12} color={colors.ink} strokeWidth={3} /></View>}</View>
                    <Text style={styles.friendName} numberOfLines={1}>{displayName(p, social.nicknames)}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
          {error && <Text style={styles.error}>{error}</Text>}
          <Pressable onPress={() => void submit()} disabled={busy} style={({ pressed }) => [styles.cta, f.mode === 'friends' && !f.invited.length && { opacity: 0.5 }, pressed && { transform: [{ scale: 0.98 }] }]} accessibilityRole="button">
            <Text style={styles.ctaText}>{cta}</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      {timeSheet && (
        <>
          <Backdrop onPress={() => setTimeSheet(false)} label="Закрыть" />
          <BottomSheet onClose={() => setTimeSheet(false)} label="Во сколько" style={{ paddingBottom: 30 + insets.bottom }}>
            <Text style={styles.sheetTitle}>Во сколько</Text>
            <TimeWheel value={f.time} onChange={(time) => set({ time })} />
            <Pressable onPress={() => setTimeSheet(false)} style={styles.cta} accessibilityRole="button"><Text style={styles.ctaText}>Готово</Text></Pressable>
          </BottomSheet>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#DDD8CB' },
  mapArea: { flex: 1 },
  pinWrap: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  pinShadow: { position: 'absolute', width: 22, height: 7, borderRadius: 4, backgroundColor: '#17161A', marginTop: 4 },
  pinBody: { alignItems: 'center', marginTop: -62 },
  pinHead: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.accent, borderWidth: 3, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center',
    boxShadow: 'inset 0 -3px 0 rgba(0,0,0,0.18), 0 8px 16px -6px rgba(23,22,26,0.55)' },
  pinLeg: { width: 3, height: 16, borderRadius: 2, backgroundColor: colors.ink },
  addrPill: { position: 'absolute', top: '50%', marginTop: -104, maxWidth: '80%', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, backgroundColor: colors.ink },
  addrText: { fontFamily: fonts.body600, fontSize: 13, color: colors.paper },
  top: { position: 'absolute', left: 12, right: 12, flexDirection: 'row', gap: 8 },
  round: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  search: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, height: 48, paddingHorizontal: 14, borderRadius: 24 },
  searchInput: { flex: 1, fontFamily: fonts.body400, fontSize: 15, color: colors.ink, paddingVertical: 0 },
  hits: { position: 'absolute', left: 12, right: 12, borderRadius: 20, paddingVertical: 4 },
  hit: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48, paddingHorizontal: 14, paddingVertical: 8 },
  hitLine: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line2 },
  hitText: { flex: 1, fontFamily: fonts.body500, fontSize: 14, color: colors.ink },
  sheet: { maxHeight: '58%', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 16, paddingTop: 6 },
  grabber: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: colors.line2, marginBottom: 2 },
  title: { fontFamily: fonts.display700, fontSize: 21, color: colors.ink, paddingVertical: 4 },
  note: { fontFamily: fonts.body400, fontSize: 15, lineHeight: 20, color: colors.ink, minHeight: 40, paddingVertical: 2, marginTop: -8 },
  placeRow: { flexDirection: 'row', gap: 10, padding: 12, borderRadius: 18, backgroundColor: '#EDE8DD', alignItems: 'flex-start' },
  placeInput: { fontFamily: fonts.body700, fontSize: 15, color: colors.ink, paddingVertical: 0, minHeight: 24 },
  addrInput: { fontFamily: fonts.body400, fontSize: 13.5, color: colors.muted2, paddingVertical: 0, minHeight: 22 },
  cap: { fontFamily: fonts.mono600, fontSize: 10.5, letterSpacing: 0.8, color: colors.muted },
  day: { width: 54, height: 56, borderRadius: 16, backgroundColor: '#EDE8DD', alignItems: 'center', justifyContent: 'center' },
  dayWd: { fontFamily: fonts.body500, fontSize: 11.5, color: colors.muted2 },
  dayNum: { fontFamily: fonts.display700, fontSize: 18, color: colors.ink },
  dark: { backgroundColor: colors.ink },
  slot: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 40, paddingHorizontal: 14, borderRadius: 20, backgroundColor: '#EDE8DD' },
  slotOther: { borderWidth: 1.5, borderColor: colors.line2, backgroundColor: 'transparent' },
  slotText: { fontFamily: fonts.mono600, fontSize: 13, color: colors.ink },
  modes: { flexDirection: 'row', gap: 6 },
  mode: { flex: 1, flexDirection: 'row', gap: 6, height: 46, borderRadius: 15, backgroundColor: '#EDE8DD', alignItems: 'center', justifyContent: 'center' },
  modeText: { fontFamily: fonts.body600, fontSize: 13.5, color: colors.ink },
  hint: { fontFamily: fonts.body400, fontSize: 12.5, lineHeight: 17, color: colors.muted, marginTop: -6 },
  friend: { width: 60, alignItems: 'center', gap: 4 },
  friendName: { fontFamily: fonts.body600, fontSize: 11.5, color: colors.ink },
  tick: { position: 'absolute', right: -2, bottom: -2, width: 20, height: 20, borderRadius: 10, backgroundColor: colors.accent, borderWidth: 2, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  error: { fontFamily: fonts.body600, fontSize: 13.5, color: colors.accentText },
  cta: { height: 56, borderRadius: 18, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  ctaText: { fontFamily: fonts.body700, fontSize: 16, color: colors.paper },
  sheetTitle: { fontFamily: fonts.display700, fontSize: 22, color: colors.ink },
});
