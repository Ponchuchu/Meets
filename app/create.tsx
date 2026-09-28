// «Новая встреча» — design/png/CreateEvent.png. Открывается кнопкой «+» на карте.
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { MapBase } from '../src/components/MapBase';
import { data, eventsSnapshot } from '../src/data';
import type { Person } from '../src/data/types';
import { buildMeetup, ctaLabel, DISTRICTS, validateMeetup, type MeetupForm, type MeetupKind, type MeetupMode } from '../src/event/meetup';
import { almaty, dayIndex, dayStart, now as clockNow } from '../src/lib/clock';
import { useApp } from '../src/state/app';
import { useMapState } from '../src/state/map';
import { usePlans } from '../src/state/plans';
import { colors, fonts } from '../src/theme';
import { Avatar } from '../src/ui/Avatar';
import { Switch } from '../src/ui/controls';
import { Ic, IC } from '../src/ui/Ic';
import { Backdrop, BottomSheet } from '../src/ui/sheet';

const KINDS: [MeetupKind, string, string][] = [
  ['dinner', 'Ужин', 'M5 3v8a2 2 0 002 2v8M9 3v8a2 2 0 01-2 2M7 3v6M17 21V3c-2 1-3 4-3 8h3'],
  ['movie', 'Кино', 'M3 5h18v14H3zM7 5v14M17 5v14M3 9h4M3 15h4M17 9h4M17 15h4'],
  ['games', 'Игры', 'M4 4h16v16H4zM9 9h.01M15 15h.01M15 9h.01M9 15h.01'],
  ['walk', 'Гулять', 'M13 4a1.5 1.5 0 100-.01M10 21l2-6-2-3 1-5 3 3h3M8 11l2-4'],
  ['sport', 'Спорт', 'M12 3a9 9 0 100 18 9 9 0 000-18zM3.5 9h17M3.5 15h17M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18'],
  ['party', 'Туса', 'M4 20l5-14 9 9zM14 4l1 2M19 8l2-1M17 3l-1 3'],
];
const DAYS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const TIMES = Array.from({ length: 32 }, (_, i) => `${String(8 + Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`);
// Кто близкий — демо: Игорь, Денис, Тимур.
const CLOSE = ['igor', 'denis', 'timur'];
const NOTES: Record<string, string> = { igor: 'близкий друг', denis: 'близкий друг', timur: 'вместе на велопрогулке', sasha: 'бегаете по средам', ainura: 'заявка в друзья отправлена', mira: '2 общих друга' };

type Sheet = null | 'date' | 'time' | 'poster' | 'place';

function dayLabel(offset: number, now: Date): string {
  const d = almaty(dayStart(dayIndex(now) + offset));
  if (offset === 0) return `Сегодня, ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
  if (offset === 1) return `Завтра, ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
  return `${DAYS[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

export default function CreateScreen() {
  const insets = useSafeAreaInsets();
  const now = clockNow();
  const { data: people = [] } = useQuery({ queryKey: ['people'], queryFn: () => data.getPeople() });
  const { data: events = [] } = useQuery({ queryKey: ['events'], queryFn: () => data.getEvents(), placeholderData: eventsSnapshot });
  const addMeetup = usePlans((s) => s.addMeetup);
  const addPlan = useApp((s) => s.addPlan);
  const select = useMapState((s) => s.select);
  const setFilters = useMapState((s) => s.setFilters);
  const fri = (5 - ((almaty(now).getUTCDay() + 7) % 7) + 7) % 7 || 7;
  const [sheet, setSheet] = useState<Sheet>(null);
  const [error, setError] = useState<string | null>(null);
  const [poster, setPoster] = useState('');
  const [posterMsg, setPosterMsg] = useState<string | null>(null);
  const [f, setF] = useState<MeetupForm>({
    mode: 'friends', kind: 'dinner', title: 'Ужин у меня', note: 'Готовлю плов. С вас хорошее настроение и что-нибудь к чаю',
    dayOffset: fri, time: '19:30', place: 'Моя квартира', district: 'Бостандык', address: '',
    invited: ['igor', 'denis', 'timur'], plusOne: true,
    items: [{ id: 'i1', title: 'Напитки', by: 'igor' }, { id: 'i2', title: 'Десерт', by: null }, { id: 'i3', title: 'Настолка на вечер', by: 'denis' }],
  });
  const [newItem, setNewItem] = useState('');
  const set = (patch: Partial<MeetupForm>) => { setF((s) => ({ ...s, ...patch })); setError(null); };

  // Кого позвать: друзья + те, с кем уже знакомы (Саша, Айнура, Мира) — как в макете.
  const invitable = useMemo(() => ['igor', 'denis', 'timur', 'sasha', 'ainura', 'mira'].map((id) => people.find((p) => p.id === id)).filter(Boolean) as Person[], [people]);
  const toggleInvite = (id: string) => set({ invited: f.invited.includes(id) ? f.invited.filter((x) => x !== id) : [...f.invited, id] });
  const personOf = (id: string | null) => (id ? people.find((p) => p.id === id) : undefined);

  const fromPoster = () => {
    // Демо-разбор афиши: ищем событие по ссылке или словам из названия. Настоящий разбор ИИ — этап 9.
    const q = poster.trim().toLowerCase();
    const hit = q && events.find((e) => (e.sourceUrl && q.includes(e.sourceUrl.toLowerCase())) || q.split(/\s+/).filter((w) => w.length > 3).some((w) => e.title.toLowerCase().includes(w)));
    if (!hit) { setPosterMsg('Не получилось разобрать — заполни поля вручную'); return; }
    set({ mode: 'open', title: hit.title, note: hit.about.slice(0, 140), dayOffset: Math.max(0, dayIndex(hit.startsAt) - dayIndex(now)), time: `${String(almaty(hit.startsAt).getUTCHours()).padStart(2, '0')}:${String(almaty(hit.startsAt).getUTCMinutes()).padStart(2, '0')}`, place: hit.venueName ?? hit.address, address: hit.address });
    setPosterMsg(null);
    setSheet(null);
  };

  const submit = () => {
    const err = validateMeetup(f);
    if (err) { setError(err); return; }
    const e = buildMeetup(f, now);
    addMeetup(e);
    addPlan();
    // Карта переключается на день встречи, чтобы её сразу было видно.
    setFilters({ from: f.dayOffset, to: f.dayOffset });
    select(e.id);
    router.replace('/');
  };

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ paddingTop: Math.max(50, insets.top + 6), paddingHorizontal: 16, paddingBottom: 140 + insets.bottom, gap: 18 }} keyboardShouldPersistTaps="handled">
        <View style={styles.head}>
          <Pressable onPress={close} style={styles.round} accessibilityRole="button" accessibilityLabel="Закрыть">
            <Ic d={IC.close} size={18} color={colors.ink} w={2.2} />
          </Pressable>
          <Text style={styles.h1} accessibilityRole="header">Новая встреча</Text>
          <Pressable onPress={() => setSheet('poster')} hitSlop={10} accessibilityRole="button"><Text style={styles.link}>Есть афиша?</Text></Pressable>
        </View>

        <View style={styles.segments} accessibilityRole="radiogroup" accessibilityLabel="Тип встречи">
          {([['friends', 'Для друзей', 'видят только гости'], ['open', 'Открытая', 'на общей карте']] as [MeetupMode, string, string][]).map(([k, label, hint]) => {
            const on = f.mode === k;
            return (
              <Pressable key={k} onPress={() => set({ mode: k })} accessibilityRole="radio" accessibilityState={{ selected: on }} style={[styles.segment, on && styles.segmentOn]}>
                <Text style={styles.segLabel}>{label}</Text>
                <Text style={styles.segHint}>{hint}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={{ gap: 8 }}>
          <Text style={styles.label}>Какая встреча</Text>
          <View style={styles.kinds}>
            {KINDS.map(([k, label, d]) => {
              const on = f.kind === k;
              return (
                <Pressable key={k} onPress={() => set({ kind: k })} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={label}
                  style={[styles.kind, { backgroundColor: on ? colors.ink : colors.card, borderColor: on ? colors.ink : colors.line2 }]}>
                  <Ic d={d} size={20} color={on ? colors.paper : colors.ink} />
                  <Text style={[styles.kindText, { color: on ? colors.paper : colors.ink }]}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={{ gap: 8 }}>
          <Text style={styles.label}>Название</Text>
          <TextInput value={f.title} onChangeText={(title) => set({ title })} style={[styles.field, styles.fieldBig, error === 'Назови встречу' && styles.fieldErr]} placeholder="Ужин у меня" placeholderTextColor={colors.muted3} accessibilityLabel="Название" maxLength={60} />
        </View>
        <View style={{ gap: 8 }}>
          <Text style={styles.label}>Пара слов</Text>
          <TextInput value={f.note} onChangeText={(note) => set({ note })} multiline style={[styles.field, styles.fieldArea]} placeholder="Что будет и что взять" placeholderTextColor={colors.muted3} accessibilityLabel="Пара слов" maxLength={200} />
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1, gap: 8 }}>
            <Text style={styles.label}>Когда</Text>
            <Pressable onPress={() => setSheet('date')} style={styles.field} accessibilityRole="button" accessibilityLabel={`Когда: ${dayLabel(f.dayOffset, now)}`}>
              <Text style={styles.fieldText} numberOfLines={1}>{dayLabel(f.dayOffset, now).replace(/^(Сегодня|Завтра), /, '$1, ')}</Text>
            </Pressable>
          </View>
          <View style={{ flex: 1, gap: 8 }}>
            <Text style={styles.label}>Во сколько</Text>
            <Pressable onPress={() => setSheet('time')} style={styles.field} accessibilityRole="button" accessibilityLabel={`Во сколько: ${f.time}`}>
              <Text style={styles.fieldText}>{f.time}</Text>
            </Pressable>
          </View>
        </View>

        <View style={{ gap: 8 }}>
          <Text style={styles.label}>Где</Text>
          <View style={styles.where}>
            <View style={styles.mini}>
              <View style={{ position: 'absolute', left: -20, top: -330, width: 390, height: 844 }}><MapBase theme="paper" /></View>
              <View style={styles.zone}>
                <Svg width={96} height={96} style={StyleSheet.absoluteFill}>
                  <Circle cx={48} cy={48} r={47} fill="rgba(240,82,31,0.22)" stroke={colors.accent} strokeWidth={1} strokeDasharray="4 4" />
                </Svg>
                <View style={styles.home}><Ic d={IC.home} size={16} color={colors.ink} w={2} /></View>
              </View>
            </View>
            <View style={styles.whereRow}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.name}>{f.place || 'Место'} · {f.district}</Text>
                <Text style={styles.addr}>{f.address ? f.address.toUpperCase() : '[ТВОЙ АДРЕС, ПОДЪЕЗД, ЭТАЖ]'}</Text>
              </View>
              <Pressable onPress={() => setSheet('place')} style={styles.change} accessibilityRole="button"><Text style={styles.changeText}>Изменить</Text></Pressable>
            </View>
            <View style={styles.privacy}>
              <Ic d={IC.lock} size={14} color={colors.muted} w={2} />
              <Text style={styles.privacyText}>Точный адрес видят только гости, которые приняли приглашение. Остальным — просто район.</Text>
            </View>
          </View>
        </View>

        <View style={{ gap: 10 }}>
          <View style={styles.rowBetween}>
            <Text style={styles.h2}>Кого позвать</Text>
            <Text style={styles.counter}>ВЫБРАНО {f.invited.length}</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {([['Все друзья', invitable.map((p) => p.id)], ['Близкие', CLOSE], ['Никого', []]] as [string, string[]][]).map(([label, ids]) => (
              <Pressable key={label} onPress={() => set({ invited: ids })} style={styles.preset} accessibilityRole="button"><Text style={styles.presetText}>{label}</Text></Pressable>
            ))}
          </View>
          <View style={[styles.list, error === 'Выбери, кого позвать' && { borderColor: colors.accentText }]}>
            {invitable.map((p, i) => {
              const on = f.invited.includes(p.id);
              return (
                <Pressable key={p.id} onPress={() => toggleInvite(p.id)} accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={p.name}
                  style={[styles.person, i < invitable.length - 1 && styles.line]}>
                  <Avatar p={p} size={40} />
                  <View style={{ flex: 1, gap: 1 }}>
                    <Text style={styles.name}>{p.name}</Text>
                    <Text style={styles.small}>{NOTES[p.id] ?? ''}</Text>
                  </View>
                  <View style={[styles.box, on && { backgroundColor: colors.ink, borderColor: colors.ink }]}>{on && <Ic d={IC.check} size={14} color={colors.paper} w={3} />}</View>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={[styles.list, styles.plus]}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.name}>Гости могут привести +1</Text>
            <Text style={styles.small}>ты увидишь, кого они добавили</Text>
          </View>
          <Switch on={f.plusOne} onChange={(plusOne) => set({ plusOne })} label="Гости могут привести +1" />
        </View>

        <View style={{ gap: 10 }}>
          <Text style={styles.h2}>Кто что принесёт</Text>
          <View style={styles.list}>
            {f.items.map((it) => {
              const by = personOf(it.by);
              const mine = it.by === 'me';
              return (
                <Pressable key={it.id} onPress={() => set({ items: f.items.map((x) => (x.id === it.id ? { ...x, by: x.by ? null : 'me' } : x)) })}
                  accessibilityRole="button" accessibilityLabel={`${it.title}: ${by ? by.name : mine ? 'ты' : 'свободно'}`} style={[styles.item, styles.line]}>
                  <Text style={[styles.itemText, { flex: 1 }]}>{it.title}</Text>
                  {by ? (
                    <View style={styles.by}><Avatar p={by} size={22} /><Text style={styles.byText}>{by.name}</Text></View>
                  ) : <Text style={styles.free}>{mine ? 'ты' : 'свободно'}</Text>}
                </Pressable>
              );
            })}
            <View style={styles.addRow}>
              <Ic d={IC.plus} size={16} color={colors.ink} w={2.2} />
              <TextInput value={newItem} onChangeText={setNewItem} placeholder="Добавить пункт" placeholderTextColor={colors.ink}
                onSubmitEditing={() => { if (newItem.trim()) { set({ items: [...f.items, { id: `i${Date.now()}`, title: newItem.trim(), by: null }] }); setNewItem(''); } }}
                returnKeyType="done" style={styles.addInput} accessibilityLabel="Добавить пункт" />
            </View>
          </View>
        </View>
      </ScrollView>

      <View style={[styles.bottom, { paddingBottom: 18 + insets.bottom }]}>
        <Pressable onPress={submit} style={[styles.cta, f.mode === 'friends' && !f.invited.length && { backgroundColor: colors.sand }]} accessibilityRole="button">
          <Text style={[styles.ctaText, f.mode === 'friends' && !f.invited.length && { color: colors.muted3 }]}>{ctaLabel(f)}</Text>
        </Pressable>
        <Text style={[styles.ctaHint, error && { color: colors.accentText }]}>{error ?? (f.mode === 'friends' ? 'Встреча появится на карте только у приглашённых' : 'Встречу увидят все, адрес — после одобрения')}</Text>
      </View>

      {sheet && (
        <>
          <Backdrop onPress={() => setSheet(null)} label="Закрыть" />
          <BottomSheet label="Выбор" style={{ paddingBottom: 30 + insets.bottom }}>
            {sheet === 'date' && (
              <>
                <Text style={styles.sheetTitle}>Когда</Text>
                <View style={styles.chips}>
                  {Array.from({ length: 14 }, (_, i) => i).map((i) => (
                    <Pressable key={i} onPress={() => { set({ dayOffset: i }); setSheet(null); }} style={[styles.chip, f.dayOffset === i && styles.chipOn]} accessibilityRole="button">
                      <Text style={[styles.chipText, f.dayOffset === i && { color: colors.paper }]}>{dayLabel(i, now)}</Text>
                    </Pressable>
                  ))}
                </View>
              </>
            )}
            {sheet === 'time' && (
              <>
                <Text style={styles.sheetTitle}>Во сколько</Text>
                <View style={styles.chips}>
                  {TIMES.map((t) => (
                    <Pressable key={t} onPress={() => { set({ time: t }); setSheet(null); }} style={[styles.chip, { minWidth: 76 }, f.time === t && styles.chipOn]} accessibilityRole="button">
                      <Text style={[styles.chipText, f.time === t && { color: colors.paper }]}>{t}</Text>
                    </Pressable>
                  ))}
                </View>
              </>
            )}
            {sheet === 'place' && (
              <>
                <Text style={styles.sheetTitle}>Где</Text>
                <TextInput value={f.place} onChangeText={(place) => set({ place })} placeholder="Моя квартира" placeholderTextColor={colors.muted3} style={styles.field} accessibilityLabel="Название места" />
                <TextInput value={f.address} onChangeText={(address) => set({ address })} placeholder="Адрес, подъезд, этаж" placeholderTextColor={colors.muted3} style={styles.field} accessibilityLabel="Точный адрес" />
                <Text style={styles.label}>Район — его видят все</Text>
                <View style={styles.chips}>
                  {Object.keys(DISTRICTS).map((d) => (
                    <Pressable key={d} onPress={() => set({ district: d })} style={[styles.chip, f.district === d && styles.chipOn]} accessibilityRole="button">
                      <Text style={[styles.chipText, f.district === d && { color: colors.paper }]}>{d}</Text>
                    </Pressable>
                  ))}
                </View>
                <Pressable onPress={() => setSheet(null)} style={styles.cta} accessibilityRole="button"><Text style={styles.ctaText}>Готово</Text></Pressable>
              </>
            )}
            {sheet === 'poster' && (
              <>
                <Text style={styles.sheetTitle}>Есть афиша?</Text>
                <Text style={styles.small}>Вставь ссылку или текст афиши — поля заполнятся сами.</Text>
                <TextInput value={poster} onChangeText={(t) => { setPoster(t); setPosterMsg(null); }} placeholder="https://… или «Брамс, филармония»" placeholderTextColor={colors.muted3} style={styles.field} autoFocus accessibilityLabel="Ссылка или текст афиши" />
                {posterMsg && <Text style={[styles.small, { color: colors.accentText }]}>{posterMsg}</Text>}
                <Pressable onPress={fromPoster} style={styles.cta} accessibilityRole="button"><Text style={styles.ctaText}>Заполнить</Text></Pressable>
              </>
            )}
          </BottomSheet>
        </>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  round: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  h1: { flex: 1, fontFamily: fonts.display700, fontSize: 22, letterSpacing: -0.3, color: colors.ink },
  h2: { fontFamily: fonts.display700, fontSize: 19, color: colors.ink },
  link: { fontFamily: fonts.body600, fontSize: 13, color: colors.ink, textDecorationLine: 'underline' },
  segments: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: 16, backgroundColor: colors.sand },
  segment: { flex: 1, height: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center', gap: 1 },
  segmentOn: { backgroundColor: colors.card, shadowColor: colors.ink, shadowOpacity: 0.14, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 2 },
  segLabel: { fontFamily: fonts.body600, fontSize: 14, color: colors.ink },
  segHint: { fontFamily: fonts.body400, fontSize: 11, color: colors.muted },
  label: { fontFamily: fonts.body500, fontSize: 13, color: colors.muted2 },
  kinds: { flexDirection: 'row', gap: 6 },
  kind: { flex: 1, height: 72, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
  kindText: { fontFamily: fonts.body600, fontSize: 11.5 },
  field: { minHeight: 52, paddingHorizontal: 16, borderWidth: 1, borderColor: colors.line2, borderRadius: 16, backgroundColor: colors.card, justifyContent: 'center', fontFamily: fonts.body400, fontSize: 15, color: colors.ink },
  fieldBig: { height: 56, fontFamily: fonts.display700, fontSize: 19 },
  fieldArea: { minHeight: 74, paddingTop: 14, paddingBottom: 12, lineHeight: 21, textAlignVertical: 'top' },
  fieldErr: { borderColor: colors.accentText },
  fieldText: { fontFamily: fonts.body400, fontSize: 15, color: colors.ink },
  where: { borderRadius: 18, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, overflow: 'hidden' },
  mini: { height: 140, overflow: 'hidden' },
  zone: { position: 'absolute', left: '50%', marginLeft: -65, top: 22, width: 96, height: 96, alignItems: 'center', justifyContent: 'center' },
  home: { width: 40, height: 40, borderRadius: 13, backgroundColor: colors.accent, borderWidth: 3, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  whereRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12 },
  name: { fontFamily: fonts.body600, fontSize: 15, color: colors.ink },
  addr: { fontFamily: fonts.mono500, fontSize: 12, letterSpacing: 0.3, color: colors.muted },
  change: { height: 36, paddingHorizontal: 12, borderRadius: 18, borderWidth: 1, borderColor: colors.line2, justifyContent: 'center' },
  changeText: { fontFamily: fonts.body600, fontSize: 13, color: colors.ink },
  privacy: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.sand, backgroundColor: colors.paper },
  privacyText: { flex: 1, fontFamily: fonts.body400, fontSize: 12.5, lineHeight: 17, color: colors.muted2 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  counter: { fontFamily: fonts.mono600, fontSize: 10.5, letterSpacing: 0.6, color: colors.ink },
  preset: { height: 34, paddingHorizontal: 12, borderRadius: 17, borderWidth: 1, borderColor: colors.line2, backgroundColor: colors.card, justifyContent: 'center' },
  presetText: { fontFamily: fonts.body600, fontSize: 13, color: colors.ink },
  list: { borderRadius: 18, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card },
  person: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 14 },
  line: { borderBottomWidth: 1, borderBottomColor: colors.sand },
  small: { fontFamily: fonts.body400, fontSize: 12.5, color: colors.muted },
  box: { width: 26, height: 26, borderRadius: 8, borderWidth: 1.5, borderColor: '#B9B2A3', alignItems: 'center', justifyContent: 'center' },
  plus: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14 },
  item: { flexDirection: 'row', alignItems: 'center', minHeight: 48, paddingHorizontal: 14 },
  itemText: { fontFamily: fonts.body400, fontSize: 15, color: colors.ink },
  by: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  byText: { fontFamily: fonts.body600, fontSize: 13, color: colors.ink },
  free: { fontFamily: fonts.body400, fontSize: 13, color: colors.muted },
  addRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 50 },
  addInput: { fontFamily: fonts.body600, fontSize: 14, color: colors.ink, minWidth: 130, textAlign: 'center' },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: 14, paddingHorizontal: 16, backgroundColor: colors.paper, borderTopWidth: 1, borderTopColor: colors.line, gap: 8 },
  cta: { height: 56, borderRadius: 16, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  ctaText: { fontFamily: fonts.body600, fontSize: 16, color: colors.paper },
  ctaHint: { textAlign: 'center', fontFamily: fonts.body400, fontSize: 12.5, color: colors.muted },
  sheetTitle: { fontFamily: fonts.display700, fontSize: 22, color: colors.ink },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { height: 38, paddingHorizontal: 12, borderRadius: 19, borderWidth: 1, borderColor: colors.line2, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  chipOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { fontFamily: fonts.body600, fontSize: 13, color: colors.ink },
});
