// «Компания» (26 октября, переработка V6CardPeople): одна шторка на всё.
// 1) Друзья идут — лица и «Позвать». 2) Ищут компанию — карточки вбок: фото, общие, записка пузырём, «Пойдём?» → «Ждём ответа».
// 3) Моя заявка: зачем иду, пара слов (с подсказками), кто увидит → «Искать компанию»; если уже ищу — карточка и «Изменить / Убрать».
// Процесс целиком — docs/COMPANY.md.
import { router } from 'expo-router';
import { Check, Hand, Plus, Sparkles } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Image as RNImage, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import type { EventItem } from '../../data/types';
import { colors, fonts } from '../../theme';
import { ART } from '../../ui/art';
import { Avatar } from '../../ui/Avatar';
import { EventIcon } from '../../ui/EventIcon';
import { MOODS, moodLabel, NOTE_IDEAS, useCompany } from '../company';

export function CardPeople({ e, now, when, going, onGo, onInvite, onError, onWrite }: {
  e: EventItem; now: Date; when: string; going: boolean; onGo: () => void; onInvite: () => void; onError: (t: string) => void; onWrite?: (personId: string) => void;
}) {
  const c = useCompany(e, now);
  const [asked, setAsked] = useState<Record<string, boolean>>({});
  const [edit, setEdit] = useState(false);
  const [moods, setMoods] = useState<string[]>(c.mine?.moods.length ? c.mine.moods : ['notalone']);
  const [note, setNote] = useState(c.mine?.note ?? '');
  const [vis, setVis] = useState<'all' | 'fof'>(c.mine?.visibility ?? 'all');
  const composing = !c.mine || edit;
  const pulse = useSharedValue(1);
  useEffect(() => { if (!composing) { cancelAnimation(pulse); pulse.set(1); return; } pulse.set(withRepeat(withSequence(withTiming(1.03, { duration: 900 }), withTiming(1, { duration: 900 })), 4)); }, [pulse, composing]);
  const pulseSt = useAnimatedStyle(() => ({ transform: [{ scale: pulse.get() }] }));

  const submit = async () => {
    if (c.started || !moods.length) return;
    if (!going) onGo();
    setEdit(false);
    await c.start({ moods, visibility: vis, note }).catch(() => onError('Не получилось. Проверь связь'));
  };
  const ask = async (id: string) => {
    if (onWrite && !asked[id]) { onWrite(id); return; }
    setAsked((a) => ({ ...a, [id]: true }));
    await c.ask(id).catch(() => { setAsked((a) => ({ ...a, [id]: false })); onError('Пока нельзя написать: лимит новых разговоров или человек закрыл сообщения'); });
  };
  const person = (id: string) => router.push({ pathname: '/person/[id]', params: { id } });

  return (
    <View style={{ gap: 16 }}>
      <View style={styles.head}>
        <EventIcon e={e} size={50} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.title} accessibilityRole="header">Компания</Text>
          <Text style={styles.sub} numberOfLines={1}>{e.title} · {when}</Text>
        </View>
      </View>

      <View style={{ gap: 10 }}>
        <Text style={styles.h}>Друзья идут{c.friends.length ? ` · ${c.friends.length}` : ''}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
          {c.friends.map((p) => (
            <Pressable key={p.id} onPress={() => person(p.id)} style={styles.friend} accessibilityRole="button" accessibilityLabel={p.name}>
              <View><Avatar p={p} size={56} /><View style={styles.ok}><Check size={11} color="#FFFFFF" strokeWidth={3.2} /></View></View>
              <Text style={styles.friendName} numberOfLines={1}>{p.name}</Text>
            </Pressable>
          ))}
          <Pressable onPress={onInvite} style={styles.friend} accessibilityRole="button" accessibilityLabel="Позвать друзей">
            <View style={styles.plus}><Plus size={24} color={colors.ink} strokeWidth={2} /></View>
            <Text style={styles.friendName}>Позвать</Text>
          </Pressable>
        </ScrollView>
      </View>

      <View style={{ gap: 10 }}>
        <View style={styles.hRow}><Hand size={17} color={colors.accentText} strokeWidth={2} /><Text style={styles.h}>Ищут компанию{c.lookers.length ? ` · ${c.lookers.length}` : ''}</Text></View>
        {c.lookers.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 4 }}>
            {c.lookers.map((l) => (
              <View key={l.id} style={styles.looker}>
                <Pressable onPress={() => person(l.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }} accessibilityRole="button" accessibilityLabel={`Профиль: ${l.name}`}>
                  <Avatar p={l} size={46} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name} numberOfLines={1}>{l.name}</Text>
                    <Text style={styles.small} numberOfLines={1}>{l.friend ? 'твой друг' : l.common || 'тоже идёт'}</Text>
                  </View>
                </Pressable>
                {!!l.note && <View style={styles.bubble}><Text style={styles.bubbleText} numberOfLines={3}>{l.note}</Text></View>}
                {l.moods.length > 0 && <View style={styles.tags}>{l.moods.slice(0, 2).map((m) => <Text key={m} style={styles.tag}>{moodLabel(m) ?? m}</Text>)}</View>}
                <View style={{ flex: 1 }} />
                {asked[l.id] ? (
                  <View style={[styles.ask, styles.asked]}><Text style={[styles.askText, { color: colors.muted2 }]}>Ждём ответа</Text></View>
                ) : (
                  <Pressable onPress={() => void ask(l.id)} style={({ pressed }) => [styles.ask, pressed && { transform: [{ scale: 0.96 }] }]} accessibilityRole="button" accessibilityLabel={`Пойдём? ${l.name}`}>
                    <Text style={styles.askText}>Пойдём?</Text>
                  </Pressable>
                )}
              </View>
            ))}
          </ScrollView>
        ) : (
          <View style={styles.empty}>
            <RNImage source={ART.highfive} style={{ width: 56, height: 56 }} />
            <Text style={[styles.small, { flex: 1, fontSize: 14 }]}>Пока никто не ищет. Встань первым — тебя увидят все, кто идёт сюда.</Text>
          </View>
        )}
      </View>

      {composing ? (
        <View style={styles.compose}>
          <Text style={styles.h}>{c.mine ? 'Твоя заявка' : 'Ищешь компанию?'}</Text>
          <View style={styles.chips}>
            {MOODS.map(([k, label]) => {
              const on = moods.includes(k);
              return (
                <Pressable key={k} onPress={() => setMoods((m) => (on ? m.filter((x) => x !== k) : [...m, k]))} style={[styles.chip, on && styles.chipOn]} accessibilityRole="checkbox" accessibilityState={{ checked: on }}>
                  <Text style={[styles.chipText, on && { color: '#FFFFFF' }]}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
          <TextInput value={note} onChangeText={setNote} maxLength={80} placeholder="Пара слов: буду в зелёной куртке" placeholderTextColor={colors.muted3} style={styles.input} accessibilityLabel="Пара слов, необязательно" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
            {NOTE_IDEAS.map((t) => (
              <Pressable key={t} onPress={() => setNote(t)} style={styles.idea} accessibilityRole="button"><Sparkles size={12} color={colors.accentText} strokeWidth={2.2} /><Text style={styles.ideaText}>{t}</Text></Pressable>
            ))}
          </ScrollView>
          <View style={styles.seg}>
            {([['all', 'Все, кто идёт'], ['fof', 'Друзья друзей']] as const).map(([k, label]) => (
              <Pressable key={k} onPress={() => setVis(k)} style={[styles.segBtn, vis === k && styles.segOn]} accessibilityRole="radio" accessibilityState={{ selected: vis === k }}>
                <Text style={[styles.segText, vis === k && { color: colors.ink }]}>{label}</Text>
              </Pressable>
            ))}
          </View>
          <Animated.View style={pulseSt}>
            <Pressable onPress={() => void submit()} disabled={c.started || !moods.length} style={({ pressed }) => [styles.go, (c.started || !moods.length) && { opacity: 0.4 }, pressed && { transform: [{ scale: 0.98 }] }]} accessibilityRole="button">
              <Hand size={20} color="#FFFFFF" strokeWidth={2} />
              <Text style={styles.goText}>{c.started ? 'Событие уже началось' : c.mine ? 'Сохранить заявку' : 'Искать компанию'}</Text>
            </Pressable>
          </Animated.View>
          <Text style={styles.caption}>{going ? '' : 'Заодно отметим «Пойду». '}{vis === 'all' ? 'Тебя увидят только те, кто идёт сюда.' : 'Тебя увидят только друзья твоих друзей на этом событии.'} Заявка снимется сама, когда событие начнётся.</Text>
        </View>
      ) : (
        <View style={styles.mine}>
          <View style={styles.mineIcon}><Hand size={20} color={colors.ink} strokeWidth={2} /></View>
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={styles.mineTitle}>Ты ищешь компанию</Text>
            <Text style={styles.mineSub} numberOfLines={2}>{[c.mine!.note, c.mine!.moods.map((m) => moodLabel(m)?.toLowerCase()).filter(Boolean).join(', ')].filter(Boolean).join(' · ') || 'Ответы придут в «Чаты»'}</Text>
          </View>
          <View style={{ gap: 6 }}>
            <Pressable onPress={() => setEdit(true)} style={styles.mineBtn} accessibilityRole="button"><Text style={styles.mineBtnText}>Изменить</Text></Pressable>
            <Pressable onPress={() => void c.stop()} style={[styles.mineBtn, { backgroundColor: 'transparent' }]} accessibilityRole="button"><Text style={[styles.mineBtnText, { color: '#F7A47E' }]}>Убрать</Text></Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontFamily: fonts.display800, fontSize: 24, letterSpacing: -0.6, color: colors.ink },
  sub: { fontFamily: fonts.body500, fontSize: 13.5, color: colors.muted },
  h: { fontFamily: fonts.display700, fontSize: 17, color: colors.ink },
  hRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  friend: { alignItems: 'center', gap: 6, width: 64 },
  friendName: { fontFamily: fonts.body600, fontSize: 13, color: colors.ink },
  ok: { position: 'absolute', right: -2, bottom: -2, width: 22, height: 22, borderRadius: 11, backgroundColor: colors.ok, borderWidth: 2.5, borderColor: '#EEE9DE', alignItems: 'center', justifyContent: 'center' },
  plus: { width: 56, height: 56, borderRadius: 28, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.line2, alignItems: 'center', justifyContent: 'center' },
  looker: { width: 212, minHeight: 196, padding: 12, gap: 10, borderRadius: 22, backgroundColor: '#FBFAF6', boxShadow: '0 10px 22px -16px rgba(23,22,26,0.6)' },
  name: { fontFamily: fonts.body700, fontSize: 15.5, color: colors.ink },
  small: { fontFamily: fonts.body500, fontSize: 12.5, color: colors.muted },
  bubble: { alignSelf: 'flex-start', maxWidth: '100%', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, borderTopLeftRadius: 4, backgroundColor: '#F6E3D8' },
  bubbleText: { fontFamily: fonts.body500, fontSize: 13.5, lineHeight: 18, color: colors.ink },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  tag: { fontFamily: fonts.body600, fontSize: 11.5, color: colors.muted2, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, backgroundColor: colors.sand, overflow: 'hidden' },
  ask: { height: 42, borderRadius: 21, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  asked: { backgroundColor: colors.sand },
  askText: { fontFamily: fonts.body700, fontSize: 15, color: '#FFFFFF' },
  empty: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 20, backgroundColor: '#FBFAF6' },
  compose: { gap: 10, padding: 14, borderRadius: 24, backgroundColor: '#FBFAF6' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { minHeight: 38, paddingHorizontal: 14, borderRadius: 19, borderWidth: 1.5, borderColor: colors.line2, justifyContent: 'center' },
  chipOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { fontFamily: fonts.body600, fontSize: 14, color: colors.ink },
  input: { height: 48, paddingHorizontal: 14, borderRadius: 16, backgroundColor: colors.card, fontFamily: fonts.body500, fontSize: 15, color: colors.ink },
  idea: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 32, paddingHorizontal: 10, borderRadius: 16, backgroundColor: 'rgba(240,82,31,0.08)' },
  ideaText: { fontFamily: fonts.body500, fontSize: 12.5, color: colors.accentText },
  seg: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: 16, backgroundColor: colors.card },
  segBtn: { flex: 1, minHeight: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  segOn: { backgroundColor: '#FFFFFF', boxShadow: '0 2px 6px -2px rgba(23,22,26,0.25)' },
  segText: { fontFamily: fonts.body600, fontSize: 13.5, color: colors.muted },
  go: { height: 56, borderRadius: 28, backgroundColor: colors.accent, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, boxShadow: '0 12px 24px -12px rgba(240,82,31,0.8)' },
  goText: { fontFamily: fonts.body700, fontSize: 16.5, color: '#FFFFFF' },
  caption: { fontFamily: fonts.body400, fontSize: 12.5, lineHeight: 17, color: colors.muted, textAlign: 'center' },
  mine: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 22, backgroundColor: colors.ink },
  mineIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  mineTitle: { fontFamily: fonts.body700, fontSize: 15.5, color: '#FFFFFF' },
  mineSub: { fontFamily: fonts.body400, fontSize: 13, color: '#BDB8AD' },
  mineBtn: { minHeight: 34, paddingHorizontal: 12, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  mineBtnText: { fontFamily: fonts.body600, fontSize: 13, color: '#FFFFFF' },
});
