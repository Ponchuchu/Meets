// «Новая встреча» — только для друзей (design/png/CreateEvent.png, правки этапа 11). Открывается кнопкой «+» на карте.
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MapBase } from '../../components/MapBase';
import { data, eventsSnapshot } from '../../data';
import { buildMeetup, ctaLabel, DISTRICTS, fullAddress, validateMeetup, type MeetupForm, type MeetupKind } from '../../event/meetup';
import { MonthCalendar, PlacePicker, TimeWheel } from '../../event/ui/pickers';
import { almaty, dayIndex, dayStart, now as clockNow } from '../../lib/clock';
import { uid } from '../../lib/uid';
import { config } from '../../lib/config';
import { createMeetup } from '../../live/api';
import { queryClient } from '../../live/query';
import { useApp } from '../../state/app';
import { useMapState } from '../../state/map';
import { displayName, isFriendNow, useSocial } from '../../state/social';
import { usePlans } from '../../state/plans';
import { colors, fonts } from '../../theme';
import { Avatar } from '../../ui/Avatar';
import { Ic, IC } from '../../ui/Ic';
import { Backdrop, BottomSheet } from '../../ui/sheet';

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

type Sheet = null | 'date' | 'time' | 'poster' | 'place';

function dayLabel(offset: number, now: Date): string {
  const d = almaty(dayStart(dayIndex(now) + offset));
  if (offset === 0) return `Сегодня, ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
  if (offset === 1) return `Завтра, ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
  return `${DAYS[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

export default function CreateScreen() {
  const insets = useSafeAreaInsets();
  const now = useMemo(() => clockNow(), []);
  const submitting = useRef(false);
  const requestId = useRef(uid('meet'));
  const [busy, setBusy] = useState(false);
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
    dayOffset: fri, time: '19:30', place: '', district: 'Бостандык', address: '',
    invited: [], plusOne: false, items: [],
    point: DISTRICTS['Бостандык'], entrance: '', floor: '', apt: '',
  });
  const set = (patch: Partial<MeetupForm>) => { setF((s) => ({ ...s, ...patch })); setError(null); };

  // Позвать можно только друзей. Имя — как ты их подписал.
  const social = useSocial();
  const invitable = useMemo(() => people.filter((p) => isFriendNow(p, social)), [people, social]);
  const toggleInvite = (id: string) => set({ invited: f.invited.includes(id) ? f.invited.filter((x) => x !== id) : [...f.invited, id] });

  const fromPoster = () => {
    // Демо-разбор афиши: ищем событие по ссылке или словам из названия. Настоящий разбор ИИ — этап 9.
    const q = poster.trim().toLowerCase();
    const hit = q && events.find((e) => (e.sourceUrl && q.includes(e.sourceUrl.toLowerCase())) || q.split(/\s+/).filter((w) => w.length > 3).some((w) => e.title.toLowerCase().includes(w)));
    if (!hit) { setPosterMsg('Не получилось разобрать — заполни поля вручную'); return; }
    set({ title: hit.title, note: hit.about.slice(0, 140), dayOffset: Math.max(0, dayIndex(hit.startsAt) - dayIndex(now)), time: `${String(almaty(hit.startsAt).getUTCHours()).padStart(2, '0')}:${String(almaty(hit.startsAt).getUTCMinutes()).padStart(2, '0')}`, place: hit.venueName ?? hit.address, address: hit.address });
    setPosterMsg(null);
    setSheet(null);
  };

  const submit = async () => {
    if (submitting.current) return;
    const err = validateMeetup(f, now);
    if (err) { setError(err); return; }
    if(Date.parse(buildMeetup(f,now).startsAt)<=clockNow().getTime()){setError('Выбери время в будущем');return;}
    submitting.current = true; setBusy(true);
    try {
      let e = { ...buildMeetup(f, now), id: requestId.current };
      if (config.dataMode !== 'demo') e = { ...e, id: await createMeetup(e), origin: 'real' };
      addMeetup(e); addPlan();
      setFilters({ soon: false, from: f.dayOffset, to: f.dayOffset, free: false, cats: [] });
      select(e.id);
      void queryClient.invalidateQueries({ queryKey: ['events'] });
      // Закрываем форму и переходим к уже открытым вкладкам: replace поднимал вторую копию вкладок с лишней картой (вылет).
      router.dismissTo('/plans');
    } catch {
      setError('Не удалось создать встречу. Проверь связь и попробуй ещё раз');
    } finally { submitting.current = false; setBusy(false); }
  };

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  return (
    <KeyboardAvoidingView style={styles.root} behavior="padding">
      <ScrollView contentContainerStyle={{ paddingTop: Math.max(50, insets.top + 6), paddingHorizontal: 16, paddingBottom: 140 + insets.bottom, gap: 18 }} keyboardShouldPersistTaps="handled">
        <View style={styles.head}>
          <Pressable onPress={close} style={styles.round} accessibilityRole="button" accessibilityLabel="Закрыть">
            <Ic d={IC.close} size={18} color={colors.ink} w={2.2} />
          </Pressable>
          <Text style={styles.h1} accessibilityRole="header">Новая встреча</Text>
          <Pressable onPress={() => setSheet('poster')} hitSlop={10} accessibilityRole="button"><Text style={styles.link}>Есть афиша?</Text></Pressable>
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
          <Text style={styles.label}>Описание</Text>
          <TextInput value={f.note} onChangeText={(note) => set({ note })} multiline style={[styles.field, styles.fieldArea]} placeholder="Что будет и что взять" placeholderTextColor={colors.muted3} accessibilityLabel="Описание" maxLength={300} />
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
          <Text style={styles.label}>Местоположение</Text>
          <Pressable onPress={() => setSheet('place')} style={styles.where} accessibilityRole="button" accessibilityLabel={`Местоположение: ${fullAddress(f) || 'выбрать на карте'}`}>
            <View style={styles.mini}>
              <View style={{ position: 'absolute', left: -20, top: -330, width: 390, height: 844 }}><MapBase theme="paper" /></View>
              <View style={styles.zone}><View style={styles.home}><Ic d={IC.home} size={16} color={colors.ink} w={2} /></View></View>
            </View>
            <View style={styles.whereRow}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.name} numberOfLines={2}>{fullAddress(f) || 'Выбрать на карте'}</Text>
              </View>
              <View style={styles.change}><Text style={styles.changeText}>{f.address ? 'Изменить' : 'Выбрать'}</Text></View>
            </View>
          </Pressable>
        </View>

        <View style={{ gap: 10 }}>
          <View style={styles.rowBetween}>
            <Text style={styles.h2}>Кого позвать</Text>
            <Text style={styles.counter}>ВЫБРАНО {f.invited.length}</Text>
          </View>
          <View style={[styles.list, error === 'Выбери, кого позвать' && { borderColor: colors.accentText }]}>
            {invitable.map((p, i) => {
              const on = f.invited.includes(p.id);
              const nick = displayName(p, social.nicknames);
              return (
                <Pressable key={p.id} onPress={() => toggleInvite(p.id)} accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={nick}
                  style={[styles.person, i < invitable.length - 1 && styles.line]}>
                  <Avatar p={p} size={40} ring={colors.friend} />
                  <View style={{ flex: 1, gap: 1 }}>
                    <Text style={styles.name}>{nick}</Text>
                    {nick !== p.name && <Text style={styles.small}>{p.name}</Text>}
                  </View>
                  <View style={[styles.box, on && { backgroundColor: colors.ink, borderColor: colors.ink }]}>{on && <Ic d={IC.check} size={14} color={colors.paper} w={3} />}</View>
                </Pressable>
              );
            })}
          </View>
        </View>
      </ScrollView>

      <View style={[styles.bottom, { paddingBottom: 18 + insets.bottom }]}>
        <Pressable onPress={() => void submit()} disabled={busy} style={[styles.cta, !f.invited.length && { backgroundColor: colors.sand }]} accessibilityRole="button">
          <Text style={[styles.ctaText, !f.invited.length && { color: colors.muted3 }]}>{busy ? 'Создаю встречу…' : ctaLabel(f)}</Text>
        </Pressable>
        {error && <Text style={[styles.ctaHint, { color: colors.accentText }]}>{error}</Text>}
      </View>

      {sheet && (
        <>
          <Backdrop onPress={() => setSheet(null)} label="Закрыть" />
          <BottomSheet onClose={() => setSheet(null)} label="Выбор" scroll style={{ paddingBottom: 30 + insets.bottom }}>
            {sheet === 'date' && (
              <>
                <Text style={styles.sheetTitle}>Когда</Text>
                <MonthCalendar now={now} value={f.dayOffset} onPick={(dayOffset) => { set({ dayOffset }); setSheet(null); }} />
              </>
            )}
            {sheet === 'time' && (
              <>
                <Text style={styles.sheetTitle}>Во сколько</Text>
                <TimeWheel value={f.time} onChange={(time) => set({ time })} />
                <Pressable onPress={() => setSheet(null)} style={styles.cta} accessibilityRole="button"><Text style={styles.ctaText}>Готово · {f.time}</Text></Pressable>
              </>
            )}
            {sheet === 'place' && (
              <>
                <Text style={styles.sheetTitle}>Местоположение</Text>
                <PlacePicker value={{ point: f.point ?? DISTRICTS[f.district], address: f.address, entrance: f.entrance ?? '', floor: f.floor ?? '', apt: f.apt ?? '' }}
                  onDone={(v) => { set({ point: v.point, address: v.address, entrance: v.entrance, floor: v.floor, apt: v.apt }); setSheet(null); }} />
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
  zone: { position: 'absolute', left: '50%', marginLeft: -20, top: 50, alignItems: 'center', justifyContent: 'center' },
  home: { width: 40, height: 40, borderRadius: 13, backgroundColor: colors.accent, borderWidth: 3, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  whereRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12 },
  name: { fontFamily: fonts.body600, fontSize: 15, color: colors.ink },
  change: { height: 36, paddingHorizontal: 12, borderRadius: 18, borderWidth: 1, borderColor: colors.line2, justifyContent: 'center' },
  changeText: { fontFamily: fonts.body600, fontSize: 13, color: colors.ink },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  counter: { fontFamily: fonts.mono600, fontSize: 10.5, letterSpacing: 0.6, color: colors.ink },
  list: { borderRadius: 18, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card },
  person: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 14 },
  line: { borderBottomWidth: 1, borderBottomColor: colors.sand },
  small: { fontFamily: fonts.body400, fontSize: 12.5, color: colors.muted },
  box: { width: 26, height: 26, borderRadius: 8, borderWidth: 1.5, borderColor: '#B9B2A3', alignItems: 'center', justifyContent: 'center' },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: 14, paddingHorizontal: 16, backgroundColor: colors.paper, borderTopWidth: 1, borderTopColor: colors.line, gap: 8 },
  cta: { height: 56, borderRadius: 16, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  ctaText: { fontFamily: fonts.body600, fontSize: 16, color: colors.paper },
  ctaHint: { textAlign: 'center', fontFamily: fonts.body400, fontSize: 12.5, color: colors.muted },
  sheetTitle: { fontFamily: fonts.display700, fontSize: 22, color: colors.ink },
});
