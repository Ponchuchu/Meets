// Рекомендации — design/png/TasteAdmin.png: старт, вкус сейчас, последние сигналы, следующие карточки с разбором.
// Команда ищет человека по нику; без входа как сотрудник — вкус этого устройства (или пример, если сигналов мало).
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { data, eventsSnapshot, type EventItem } from '../../data';
import { photo } from '../../data/photos';
import { almaty, dayIndex, now as clockNow } from '../../lib/clock';
import { tasteFrom, type Signal, type SignalKind } from '../../reco';
import type { StartAnswers } from '../../reco/startTaste';
import { useFeed } from '../../state/feed';
import { useSession } from '../../state/session';
import { colors, fonts } from '../../theme';
import { Toggle as Switch } from '../../ui/v6/Settings';
import { loadUserTaste } from '../api';
import { useAdminDemo } from '../store';
import { deckRows, modelConfidence, SIGNAL_LABEL, signalWeight, startOf, tasteRows } from '../taste';

const INTEREST_LABEL: Record<string, string> = {
  music: 'Живая музыка', standup: 'Посмеяться', hike: 'Горы и природа', sport: 'Бег и вело', people: 'Новые люди',
  games: 'Настолки', art: 'Выставки', food: 'Еда и маркеты', party: 'Вечеринки', talks: 'Лекции и кино',
};
const TIME_LABEL: Record<string, string> = { weekday: 'будни вечером', friday: 'пятница', weekend: 'выходные днём', weekendNight: 'выходные вечером', now: 'спонтанно' };
const WITH_LABEL: Record<string, string> = { friends: 'с друзьями', alone: 'один', mixed: 'по-разному' };
const BUDGET_LABEL: Record<string, string> = { free: 'бесплатно', mid: 'до 5 000 ₸', any: 'не важно' };
const FORMAT_LABEL: Record<string, string> = { friends: 'с друзьями', alone: 'можно одному', mixed: 'камерно' };
const PILL: Partial<Record<SignalKind, [string, string]>> = {
  go: [colors.accent, colors.ink], company: [colors.friend, colors.paper], arrived: [colors.ok, colors.paper],
};
const WD = ['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'ВС'];
const PARTS = [['morning', 'Утро'], ['day', 'День'], ['evening', 'Вечер']] as const;
const MONTHS = ['ЯНВАРЯ', 'ФЕВРАЛЯ', 'МАРТА', 'АПРЕЛЯ', 'МАЯ', 'ИЮНЯ', 'ИЮЛЯ', 'АВГУСТА', 'СЕНТЯБРЯ', 'ОКТЯБРЯ', 'НОЯБРЯ', 'ДЕКАБРЯ'];

const num = (v: number, digits = 2) => v.toFixed(digits).replace('.', ',');
const signed = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${num(Math.abs(v))}`;
const money = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
const hm = (iso: string) => {
  const d = almaty(iso);
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
};

/** Пример сигналов, если на устройстве их мало: как в макете — джаз, стендап, горы, настолки. */
function sampleSignals(events: EventItem[], now: Date): Signal[] {
  const pick = (cat: string, i = 0) => events.filter((e) => e.category === cat)[i] ?? events[0];
  const plan: [EventItem, SignalKind, number][] = [
    [pick('lecture'), 'noShow', 1500], [pick('games'), 'arrived', 1440], [pick('standup'), 'company', 8],
    [pick('party'), 'skip', 6], [pick('hike'), 'go', 5], [pick('hike'), 'open', 4], [pick('concert'), 'skip', 3], [pick('music'), 'go', 2],
  ];
  return plan.map(([e, kind, minAgo], i) => ({ id: `sample-${i}`, eventId: e.id, kind, at: new Date(now.getTime() - minAgo * 60e3).toISOString(), tags: e.tags, category: e.category }));
}

export function TasteAdmin({ live }: { live: boolean }) {
  const { width } = useWindowDimensions();
  const wide = width >= 1000;
  const now = clockNow();
  const draft = useSession((s) => s.draft);
  const feed = useFeed();
  const demo = useAdminDemo();
  const [query, setQuery] = useState('');
  const [lookup, setLookup] = useState('');
  const [, setBump] = useState(0);
  const [note, setNote] = useState<string | null>(null);
  const { data: events = eventsSnapshot() } = useQuery({ queryKey: ['events'], queryFn: () => data.getEvents(), placeholderData: eventsSnapshot });
  const { data: people = [] } = useQuery({ queryKey: ['people'], queryFn: () => data.getPeople() });
  const userQ = useQuery({ queryKey: ['admin', 'taste', lookup], queryFn: () => loadUserTaste(lookup), enabled: live && !!lookup });
  const remote = live && lookup ? userQ.data : null;

  const titleOf = useMemo(() => new Map(events.map((e) => [e.id, e.title])), [events]);
  const local = feed.signals.length >= 5 ? feed.signals : sampleSignals(events, now);
  const signals: (Signal & { title?: string })[] = remote ? remote.signals.map((s) => ({ ...s, kind: s.kind as SignalKind, category: s.category as Signal['category'] })) : local;
  const answers: StartAnswers = remote?.answers
    ? { interests: remote.answers.interests, times: remote.answers.times, withWho: remote.answers.withWho, budget: remote.answers.budget } as StartAnswers
    : { interests: draft.interests, times: draft.times, withWho: draft.withWho, budget: draft.budget };
  // Считаем на каждом рендере: сигналов сотни, это быстро. «Пересчитать колоду» просто перерисовывает (bump).
  const start = startOf(answers);
  const taste = tasteFrom(answers, signals, now);
  const rows = tasteRows(taste, start);
  const swipes = signals.filter((s) => s.kind === 'go' || s.kind === 'skip').length;
  const goes = signals.filter((s) => s.kind === 'go').length;
  const arrived = signals.filter((s) => s.kind === 'arrived').length;
  const days = new Set(signals.map((s) => dayIndex(s.at))).size || 1;
  const { confidence, answersWeight } = modelConfidence(signals.length);
  const decided = new Set(signals.filter((s) => s.kind === 'go' || s.kind === 'skip').map((s) => s.eventId));
  const deck = deckRows(taste, events, decided, swipes, now, { novelty: demo.novelty, friendName: (id) => people.find((p) => p.id === id)?.name });
  const first = signals[0]?.at ?? now.toISOString();
  const since = almaty(first);
  const name = remote?.name ?? (draft.name || 'Данил');
  const age = remote?.age ?? 24;
  const recent = [...signals].reverse().slice(0, 8);
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.value)));

  const flash = (t: string) => {
    setNote(t);
    setTimeout(() => setNote((x) => (x === t ? null : x)), 2400);
  };
  const reset = () => {
    if (remote) return flash('Сброс вкуса у людей — только из базы, по запросу человека');
    feed.resetTaste();
    flash('Вкус сброшен — снова считаем от ответов при регистрации');
  };

  const Start = (
    <View style={[styles.card, wide && { flex: 1 }]}>
      <Text style={styles.cap}>СТАРТ · ОТВЕТЫ ПРИ РЕГИСТРАЦИИ</Text>
      <Text style={styles.small}>Что вытаскивает из дома</Text>
      <View style={styles.chips}>
        {answers.interests.map((i) => <View key={i} style={styles.chip}><Text style={styles.chipText}>{INTEREST_LABEL[i] ?? i}</Text></View>)}
      </View>
      {([['Когда', answers.times.map((t) => TIME_LABEL[t] ?? t).join(', ')], ['С кем', WITH_LABEL[answers.withWho]], ['Бюджет', BUDGET_LABEL[answers.budget]]] as const).map(([k, v]) => (
        <View key={k} style={styles.kv}><Text style={styles.k}>{k}</Text><Text style={styles.v}>{v}</Text></View>
      ))}
      <View style={styles.sep} />
      <View style={styles.confRow}><Text style={styles.small}>Уверенность модели</Text><Text style={styles.confN}>{Math.round(confidence * 100)}%</Text></View>
      <View style={styles.track}><View style={[styles.fill, { width: `${Math.round(confidence * 100)}%` }]} /></View>
      <Text style={styles.note}>Первые 10 карточек брали из ответов выше. Сейчас ответы весят {Math.round(answersWeight * 100)}%, свайпы и визиты — {Math.round((1 - answersWeight) * 100)}%.</Text>
    </View>
  );

  const Now = (
    <View style={[styles.card, wide && { flex: 1.1 }]}>
      <Text style={styles.cap}>ВКУС СЕЙЧАС</Text>
      {rows.map((r) => (
        <View key={r.tag} style={styles.barRow}>
          <Text style={styles.barLabel} numberOfLines={1}>{r.label}</Text>
          <View style={styles.barTrack}><View style={[styles.barFill, { width: `${Math.max(2, (Math.max(0, r.value) / max) * 100)}%`, backgroundColor: r.value === rows[0].value || r === rows[1] ? colors.accent : colors.ink }]} /></View>
          <Text style={styles.barN}>{num(r.value)}</Text>
          <Text style={[styles.barD, { color: r.delta > 0 ? colors.ok : r.delta < 0 ? colors.accentText : colors.muted }]}>{signed(r.delta)}</Text>
        </View>
      ))}
      <View style={styles.sep} />
      <View style={styles.grid}>
        <View style={styles.gridRow}><Text style={styles.gridLabel} />{WD.map((d) => <Text key={d} style={styles.gridHead}>{d}</Text>)}</View>
        {PARTS.map(([part, label]) => (
          <View key={part} style={styles.gridRow}>
            <Text style={styles.gridLabel}>{label}</Text>
            {WD.map((d, i) => {
              const v = taste.timeGrid[i]?.[part] ?? 0;
              return <View key={d} style={[styles.cell, { backgroundColor: v >= 0.8 ? colors.accent : v >= 0.5 ? '#F2A27E' : v >= 0.3 ? '#E7D2C2' : colors.sand2 }]} />;
            })}
          </View>
        ))}
      </View>
      <View style={styles.minis}>
        <Mini k="Потолок цены" v={taste.priceCeiling == null ? 'не важно' : taste.priceCeiling === 0 ? 'бесплатно' : `~${money(taste.priceCeiling)} ₸`} />
        <Mini k="Если идут друзья" v={`×${num(taste.friendsMultiplier, 1)}`} />
        <Mini k="Формат" v={FORMAT_LABEL[answers.withWho]} />
      </View>
    </View>
  );

  const Recent = (
    <View style={[styles.card, wide && { flex: 1.1 }]}>
      <Text style={styles.cap}>ПОСЛЕДНИЕ СИГНАЛЫ</Text>
      {recent.map((s) => {
        const [bg, fg] = PILL[s.kind] ?? [colors.sand, colors.ink];
        const today = dayIndex(s.at) === dayIndex(now);
        return (
          <View key={s.id} style={styles.sigRow}>
            <Text style={styles.sigTime}>{today ? hm(s.at) : 'вчера'}</Text>
            <Text style={styles.sigTitle} numberOfLines={1}>{s.title ?? titleOf.get(s.eventId) ?? 'Событие'}</Text>
            <View style={[styles.pill, { backgroundColor: bg }]}><Text style={[styles.pillText, { color: fg }]}>{SIGNAL_LABEL[s.kind]}</Text></View>
            <Text style={styles.sigW}>{signed(signalWeight(s.kind)).replace(/(\d),(\d)\d$/, '$1,$2')}</Text>
          </View>
        );
      })}
    </View>
  );

  return (
    <Animated.View entering={FadeIn.duration(200)} style={[styles.root, { paddingHorizontal: wide ? 32 : 16 }]}>
      {live && (
        <View style={styles.search}>
          <TextInput value={query} onChangeText={setQuery} onSubmitEditing={() => setLookup(query)} placeholder="Ник или id человека" placeholderTextColor={colors.muted3} style={styles.searchInput} accessibilityLabel="Найти человека" />
          <Pressable onPress={() => setLookup(query)} style={styles.btnDark} accessibilityRole="button"><Text style={styles.btnDarkText}>Показать</Text></Pressable>
          {lookup && userQ.data === null && <Text style={styles.small}>Не нашли</Text>}
        </View>
      )}
      <View style={[styles.head, !wide && { flexDirection: 'column', alignItems: 'flex-start' }]}>
        <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center', flex: 1 }}>
          {photo(remote ? null : draft.photo || 'danil') ? <Image source={photo(remote ? null : draft.photo || 'danil')} style={styles.avatar} /> : <View style={[styles.avatar, { backgroundColor: colors.sand }]} />}
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{name}, {age} · Алматы</Text>
            <Text style={styles.sub}>С {since.getUTCDate()} {MONTHS[since.getUTCMonth()]} · {swipes} СВАЙПОВ · {goes} «ПОЙДУ» · {arrived} ДОШЁЛ · ДЕЛАЕТ ~{Math.max(1, Math.round(swipes / days))} СВАЙПОВ ЗА ЗАХОД</Text>
          </View>
        </View>
        <View style={styles.headRight}>
          <Text style={[styles.small, { maxWidth: 150 }]}>Пользователь этого не видит</Text>
          <View style={styles.novelty}>
            <Text style={styles.noveltyText}>Новизна <Text style={{ fontFamily: fonts.body700 }}>{demo.novelty ? '12%' : '0%'}</Text></Text>
            <Switch on={demo.novelty} onChange={demo.setNovelty} label="Новизна в колоде" />
          </View>
          <Pressable onPress={() => { setBump((b) => b + 1); flash('Колода пересчитана'); }} style={styles.btnDark} accessibilityRole="button"><Text style={styles.btnDarkText}>Пересчитать колоду</Text></Pressable>
          <Pressable onPress={reset} style={styles.btnLine} accessibilityRole="button"><Text style={styles.btnLineText}>Сбросить вкус</Text></Pressable>
        </View>
      </View>
      {note && <Animated.Text entering={FadeIn} style={styles.flash}>{note}</Animated.Text>}
      <View style={[styles.cols, !wide && { flexDirection: 'column' }]}>{Start}{Now}{Recent}</View>

      <View style={styles.table}>
        <View style={styles.tableHead}>
          <Text style={styles.tableCap}>СЛЕДУЮЩИЕ КАРТОЧКИ · ПЕРЕСЧИТЫВАЮТСЯ ПОСЛЕ КАЖДОГО СВАЙПА</Text>
          <Text style={styles.tableNote}>колода бесконечная — дальше догружаем по 10</Text>
        </View>
        <ScrollView horizontal contentContainerStyle={{ minWidth: 1100, flexGrow: 1 }}>
          <View style={{ flex: 1 }}>
            <View style={[styles.tr, styles.trHead]}>
              {['#', 'СОБЫТИЕ', 'ВКУС', 'ДРУЗЬЯ', 'ВРЕМЯ', 'ЦЕНА', 'СКОРО', 'НОВИЗНА', 'ИТОГ', 'ПРАВИЛО'].map((h, i) => (
                <Text key={h} style={[styles.th, COLS[i]]}>{h}</Text>
              ))}
            </View>
            {deck.map((r, i) => (
              <View key={r.event.id} style={styles.tr}>
                <Text style={[styles.td, COLS[0]]}>{i + 1}</Text>
                <Text style={[styles.tdTitle, COLS[1]]} numberOfLines={1}>{r.event.title}</Text>
                {(['taste', 'friends', 'time', 'price', 'soon'] as const).map((k, j) => (
                  <Text key={k} style={[styles.tdNum, COLS[j + 2]]}>{r.score.parts[k] ? num(r.score.parts[k]) : '0'}</Text>
                ))}
                <Text style={[styles.tdNum, COLS[7]]}>{r.score.parts.novelty}</Text>
                <Text style={[styles.tdNum, COLS[8], { color: colors.accent }]}>{num(r.score.total)}</Text>
                <Text style={[styles.tdRule, COLS[9]]}>{r.rule}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
    </Animated.View>
  );
}

function Mini({ k, v }: { k: string; v: string }) {
  return (
    <View style={styles.mini}>
      <Text style={styles.miniK}>{k}</Text>
      <Text style={styles.miniV}>{v}</Text>
    </View>
  );
}

const COLS = [{ width: 40 }, { flex: 1, minWidth: 260 }, { width: 82 }, { width: 82 }, { width: 82 }, { width: 82 }, { width: 82 }, { width: 82 }, { width: 82 }, { width: 170 }];

const styles = StyleSheet.create({
  root: { width: '100%', maxWidth: 1440, alignSelf: 'center', paddingTop: 24, paddingBottom: 48, gap: 20 },
  search: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  searchInput: { flex: 1, maxWidth: 320, height: 42, borderRadius: 12, borderWidth: 1, borderColor: colors.line2, backgroundColor: colors.card, paddingHorizontal: 12, fontFamily: fonts.body500, fontSize: 14, color: colors.ink },
  head: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  avatar: { width: 56, height: 56, borderRadius: 14 },
  name: { fontFamily: fonts.display700, fontSize: 24, color: colors.ink },
  sub: { fontFamily: fonts.mono600, fontSize: 11, color: colors.muted2, letterSpacing: 0.4, marginTop: 4 },
  headRight: { flexDirection: 'row', alignItems: 'center', gap: 14, flexWrap: 'wrap' },
  novelty: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: colors.line2, borderRadius: 12, paddingHorizontal: 14, height: 42, backgroundColor: colors.card },
  noveltyText: { fontFamily: fonts.body600, fontSize: 13.5, color: colors.ink },
  btnDark: { height: 42, borderRadius: 12, backgroundColor: colors.ink, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
  btnDarkText: { fontFamily: fonts.body700, fontSize: 13.5, color: colors.paper },
  btnLine: { height: 42, borderRadius: 12, borderWidth: 1.2, borderColor: colors.accentText, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
  btnLineText: { fontFamily: fonts.body700, fontSize: 13.5, color: colors.accentText },
  flash: { fontFamily: fonts.body600, fontSize: 13.5, color: colors.ok },
  cols: { flexDirection: 'row', gap: 20, alignItems: 'stretch' },
  card: { backgroundColor: colors.card, borderRadius: 22, borderWidth: 1, borderColor: colors.line, padding: 20, gap: 8 },
  cap: { fontFamily: fonts.mono600, fontSize: 11, color: colors.accentText, letterSpacing: 0.8, marginBottom: 6 },
  small: { fontFamily: fonts.body400, fontSize: 13, color: colors.muted2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  chip: { backgroundColor: colors.ink, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  chipText: { fontFamily: fonts.body500, fontSize: 12.5, color: colors.paper },
  kv: { flexDirection: 'row', gap: 12 },
  k: { width: 100, fontFamily: fonts.body400, fontSize: 13, color: colors.muted2 },
  v: { flex: 1, fontFamily: fonts.body500, fontSize: 13, color: colors.ink },
  sep: { height: 1, backgroundColor: colors.line, marginVertical: 10 },
  confRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  confN: { fontFamily: fonts.display700, fontSize: 24, color: colors.accent },
  track: { height: 7, borderRadius: 4, backgroundColor: colors.sand2, overflow: 'hidden' },
  fill: { height: 7, backgroundColor: colors.accent },
  note: { fontFamily: fonts.body400, fontSize: 12.5, color: colors.muted, lineHeight: 18, marginTop: 4 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 22 },
  barLabel: { width: 100, fontFamily: fonts.body500, fontSize: 13, color: colors.ink },
  barTrack: { flex: 1, height: 7, borderRadius: 4, backgroundColor: colors.sand2, overflow: 'hidden' },
  barFill: { height: 7, borderRadius: 4 },
  barN: { width: 38, textAlign: 'right', fontFamily: fonts.mono600, fontSize: 11.5, color: colors.ink },
  barD: { width: 46, textAlign: 'right', fontFamily: fonts.mono500, fontSize: 11 },
  grid: { gap: 4 },
  gridRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  gridLabel: { width: 48, fontFamily: fonts.body400, fontSize: 12, color: colors.muted2 },
  gridHead: { flex: 1, textAlign: 'center', fontFamily: fonts.mono600, fontSize: 9.5, color: colors.muted },
  cell: { flex: 1, height: 18, borderRadius: 4 },
  minis: { flexDirection: 'row', gap: 8, marginTop: 8 },
  mini: { flex: 1, backgroundColor: colors.sand2, borderRadius: 12, padding: 10, gap: 2 },
  miniK: { fontFamily: fonts.body400, fontSize: 11.5, color: colors.muted2 },
  miniV: { fontFamily: fonts.body700, fontSize: 15, color: colors.ink },
  sigRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 38, borderBottomWidth: 1, borderBottomColor: colors.line },
  sigTime: { width: 40, fontFamily: fonts.mono500, fontSize: 11, color: colors.muted2 },
  sigTitle: { flex: 1, fontFamily: fonts.body500, fontSize: 13.5, color: colors.ink },
  pill: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  pillText: { fontFamily: fonts.body600, fontSize: 11.5 },
  sigW: { width: 42, textAlign: 'right', fontFamily: fonts.mono600, fontSize: 11.5, color: colors.ink },
  table: { backgroundColor: colors.ink, borderRadius: 24, padding: 20, gap: 8 },
  tableHead: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 },
  tableCap: { fontFamily: fonts.mono600, fontSize: 11, color: colors.accent, letterSpacing: 0.8 },
  tableNote: { fontFamily: fonts.body400, fontSize: 12.5, color: '#A9A59C' },
  tr: { flexDirection: 'row', alignItems: 'center', minHeight: 46, borderBottomWidth: 1, borderBottomColor: '#2A292E' },
  trHead: { minHeight: 32 },
  th: { fontFamily: fonts.mono600, fontSize: 10, color: '#A9A59C', letterSpacing: 0.5 },
  td: { fontFamily: fonts.mono500, fontSize: 12, color: '#A9A59C' },
  tdTitle: { fontFamily: fonts.body500, fontSize: 14, color: colors.paper, paddingRight: 12 },
  tdNum: { fontFamily: fonts.mono500, fontSize: 12, color: colors.paper },
  tdRule: { fontFamily: fonts.body400, fontSize: 12.5, color: colors.paper },
});
