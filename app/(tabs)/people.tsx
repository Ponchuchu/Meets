// «Друзья»: заявки (если есть) → «Рекомендации» (листаемые карточки) → «Друзья · N» → планы друзей.
// «Добавить друга»: поиск по имени или нику, приглашение ссылкой, Bump — телефоны рядом.
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { Easing, FadeIn, useAnimatedStyle, useSharedValue, withRepeat, withTiming, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTabInset } from '../../src/components/TabBar';
import { data, eventsSnapshot, type EventItem, type Person } from '../../src/data';
import { PERSON_DETAILS } from '../../src/data/demo';
import { APP_URL } from '../../src/lib/config';
import { now as clockNow } from '../../src/lib/clock';
import { CAT_COLOR, CAT_ICON, catFg } from '../../src/map/icons';
import { planWhen } from '../../src/profile/ui/Plans';
import { useApp } from '../../src/state/app';
import { usePlans } from '../../src/state/plans';
import { displayName, isFriendNow, useSocial } from '../../src/state/social';
import { colors, fonts } from '../../src/theme';
import { Avatar } from '../../src/ui/Avatar';
import { Ic, IC } from '../../src/ui/Ic';
import { Backdrop, BottomSheet } from '../../src/ui/sheet';
import { Toast, type ToastData } from '../../src/ui/Toast';

type Sheet = null | 'add' | 'bump' | { rename: Person };

/** Откуда рекомендация: общие друзья или номер из контактов телефона. */
const REASON: Record<string, string> = { ainura: 'в твоих контактах', mira: '2 общих друга', erlan: '3 общих друга', sasha: 'в твоих контактах', nurlan: '1 общий друг' };

export default function FriendsScreen() {
  const insets = useSafeAreaInsets();
  const tabPad = useTabInset() + 16;
  const now = clockNow();
  const [sheet, setSheet] = useState<Sheet>(null);
  const [toast, setToast] = useState<ToastData | null>(null);
  const { data: people = [] } = useQuery({ queryKey: ['people'], queryFn: () => data.getPeople() });
  const { data: requests = [] } = useQuery({ queryKey: ['friendRequests'], queryFn: () => data.getFriendRequests() });
  const { data: events = [] } = useQuery({ queryKey: ['events'], queryFn: () => data.getEvents(), placeholderData: eventsSnapshot });
  const social = useSocial();
  const { going, go } = usePlans();
  const addPlan = useApp((s) => s.addPlan);

  const friends = people.filter((p) => isFriendNow(p, social));
  const byId = (id: string) => people.find((p) => p.id === id);
  const show = (t: ToastData) => { setToast(t); setTimeout(() => setToast((c) => (c === t ? null : c)), 3000); };
  const pending = requests.filter((r) => !social.answered[r.personId]);
  const suggestions = people.filter((p) => !isFriendNow(p, social) && !social.hidden[p.id] && !pending.some((r) => r.personId === p.id));
  const openPerson = (id: string) => router.push({ pathname: '/person/[id]', params: { id } });
  const inviteLink = () => {
    social.inviteByLink();
    Share.share({ message: `Пойдём куда-нибудь вместе? Я в «рядом.»: ${APP_URL}/i/danil` }).catch(() => {});
  };

  const friendPlans = useMemo(() => {
    const map = new Map<string, { e: EventItem; who: Person[] }>();
    for (const e of events) {
      const who = e.friendsGoing.map(byId).filter((p): p is Person => !!p && isFriendNow(p, social));
      if (who.length && new Date(e.endsAt ?? e.startsAt).getTime() > now.getTime()) map.set(e.id, { e, who });
    }
    return [...map.values()].sort((a, b) => a.e.startsAt.localeCompare(b.e.startsAt)).slice(0, 5);
  }, [events, people, social]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={{ paddingTop: Math.max(50, insets.top + 6), paddingHorizontal: 16, paddingBottom: tabPad, gap: 14 }}>
        <View style={styles.head}>
          <Text style={styles.h1} accessibilityRole="header">Друзья</Text>
          <Pressable onPress={() => setSheet('add')} style={styles.addBtn} accessibilityRole="button" accessibilityLabel="Добавить друга">
            <Ic d={IC.userPlus} c={[[9, 8, 3.5]]} size={19} color={colors.paper} />
            <Text style={styles.addText}>Добавить</Text>
          </Pressable>
        </View>

        {pending.length > 0 && (
          <Animated.View entering={FadeIn} style={{ gap: 8 }}>
            <View style={[styles.row, { justifyContent: 'flex-start', gap: 8 }]}>
              <Text style={styles.h2}>Заявки</Text>
              <View style={styles.count}><Text style={styles.countText}>{pending.length}</Text></View>
            </View>
            {pending.map((r) => {
              const p = byId(r.personId);
              if (!p) return null;
              return (
                <View key={r.id} style={styles.card}>
                  <Pressable onPress={() => openPerson(p.id)} style={styles.cardMain} accessibilityRole="link">
                    <Avatar p={p} size={44} />
                    <View style={{ flex: 1, gap: 2 }}><Text style={styles.name}>{p.name}</Text><Text style={styles.sub}>{r.note}</Text></View>
                  </Pressable>
                  <Pressable onPress={() => { social.answer(p.id, 'accepted'); show({ text: `${p.name} теперь в друзьях` }); }} style={styles.dark} accessibilityRole="button" accessibilityLabel={`Принять: ${p.name}`}><Text style={styles.darkText}>Принять</Text></Pressable>
                  <Pressable onPress={() => social.answer(p.id, 'declined')} style={styles.x} accessibilityRole="button" accessibilityLabel={`Отклонить: ${p.name}`}><Ic d={IC.close} size={14} color={colors.ink} w={2.2} /></Pressable>
                </View>
              );
            })}
          </Animated.View>
        )}

        {/* Рекомендации — листаемые карточки, как «Рекомендации для вас» в Instagram. */}
        {suggestions.length > 0 && (
          <View style={{ gap: 10, marginTop: 4 }}>
            <Text style={styles.h2}>Рекомендации</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} snapToInterval={148} decelerationRate="fast" contentContainerStyle={{ gap: 10, paddingRight: 16 }} style={{ marginHorizontal: -16 }}>
              <View style={{ width: 6 }} />
              {suggestions.map((p, i) => {
                const sent = !!social.sent[p.id];
                return (
                  <Animated.View key={p.id} entering={FadeIn.delay(i * 60)} style={styles.sCard}>
                    <Pressable onPress={() => social.hide(p.id)} hitSlop={8} style={styles.sHide} accessibilityRole="button" accessibilityLabel={`Скрыть: ${p.name}`}>
                      <Ic d={IC.close} size={12} color={colors.muted} w={2.4} />
                    </Pressable>
                    <Pressable onPress={() => openPerson(p.id)} style={{ alignItems: 'center', gap: 8 }} accessibilityRole="link" accessibilityLabel={p.name}>
                      <Avatar p={p} size={76} />
                      <View style={{ alignItems: 'center', gap: 2 }}>
                        <Text style={styles.name} numberOfLines={1}>{p.name}{p.age ? `, ${p.age}` : ''}</Text>
                        <Text style={[styles.sub, { textAlign: 'center' }]} numberOfLines={2}>{REASON[p.id] ?? PERSON_DETAILS[p.id]?.suggestNote ?? 'общий знакомый'}</Text>
                      </View>
                    </Pressable>
                    <Pressable onPress={() => social.toggleRequest(p.id)} style={[styles.sBtn, sent && { backgroundColor: colors.sand2 }]} accessibilityRole="button" accessibilityState={{ selected: sent }} accessibilityLabel={sent ? `Заявка ушла: ${p.name}` : `Добавить: ${p.name}`}>
                      <Text style={[styles.darkText, sent && { color: colors.ink }]}>{sent ? 'Заявка ушла' : 'Добавить'}</Text>
                    </Pressable>
                  </Animated.View>
                );
              })}
            </ScrollView>
          </View>
        )}

        <>
            <View style={[styles.row, { justifyContent: 'flex-start', gap: 8, marginTop: 6 }]}>
              <Text style={styles.h2}>Друзья</Text>
              <View style={[styles.count, { backgroundColor: colors.sand2 }]}><Text style={styles.countText}>{friends.length}</Text></View>
            </View>
            <View style={{ gap: 2 }}>
              {friends.map((p) => (
                <Pressable key={p.id} onPress={() => openPerson(p.id)} onLongPress={() => setSheet({ rename: p })} style={styles.friendRow} accessibilityRole="link" accessibilityLabel={displayName(p, social.nicknames)}
                  accessibilityActions={[{ name: 'longpress', label: 'Переименовать' }]} onAccessibilityAction={() => setSheet({ rename: p })}>
                  <Avatar p={p} size={48} ring={colors.friend} />
                  <View style={{ flex: 1, gap: 1 }}>
                    <Text style={styles.name}>{displayName(p, social.nicknames)}</Text>
                    {social.nicknames[p.id] && <Text style={styles.sub}>{p.name}</Text>}
                  </View>
                  <Pressable onPress={() => setSheet({ rename: p })} hitSlop={10} style={styles.more} accessibilityRole="button" accessibilityLabel={`Переименовать: ${p.name}`}>
                    <Ic d="M4 20h4L18.5 9.5a2.1 2.1 0 00-3-3L5 17zM13.5 6.5l3 3" size={17} color={colors.muted} w={1.9} />
                  </Pressable>
                </Pressable>
              ))}
            </View>

            {friendPlans.length > 0 && (
              <>
                <Text style={[styles.h2, { marginTop: 6 }]}>Планы друзей</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 16 }}>
                  {friendPlans.map(({ e, who }) => {
                    const mine = !!going[e.id];
                    return (
                      <View key={e.id} style={styles.planCard}>
                        <Pressable onPress={() => router.push({ pathname: '/event/[id]', params: { id: e.id } })} style={{ gap: 10 }} accessibilityRole="link" accessibilityLabel={e.title}>
                          <View style={[styles.planIcon, { backgroundColor: CAT_COLOR[e.category] }]}><Ic d={CAT_ICON[e.category]} size={20} color={catFg(e.category)} w={2} /></View>
                          <Text style={styles.planWhen}>{planWhen(e, now).text}</Text>
                          <Text style={styles.name} numberOfLines={2}>{e.title}</Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <View style={{ flexDirection: 'row' }}>{who.slice(0, 3).map((p) => <Avatar key={p.id} p={p} size={26} ring={colors.friend} style={{ marginRight: -8 }} />)}</View>
                            <Text style={[styles.sub, { marginLeft: 8, flex: 1 }]} numberOfLines={1}>{who.map((p) => displayName(p, social.nicknames)).join(', ')}</Text>
                          </View>
                        </Pressable>
                        <Pressable disabled={mine} onPress={() => { go(e.id); addPlan(); show({ text: `В планах: ${e.title}` }); }} style={[styles.planBtn, mine && { backgroundColor: colors.sand, borderColor: colors.sand }]} accessibilityRole="button">
                          <Text style={styles.outlineText}>{mine ? 'Ты идёшь' : 'Тоже пойду'}</Text>
                        </Pressable>
                      </View>
                    );
                  })}
                </ScrollView>
              </>
            )}
        </>
      </ScrollView>

      {sheet && (
        <>
          <Backdrop onPress={() => setSheet(null)} label="Закрыть" />
          <BottomSheet onClose={() => setSheet(null)} label={sheet === 'add' ? 'Добавить друга' : sheet === 'bump' ? 'Bump' : 'Переименовать'} style={{ gap: 14, paddingBottom: 30 + insets.bottom }}>
            {sheet === 'add' && <AddFriend people={people} social={social} onInvite={() => { setSheet(null); inviteLink(); }} onBump={() => setSheet('bump')} onOpen={(id) => { setSheet(null); openPerson(id); }} />}
            {sheet === 'bump' && <Bump candidates={suggestions} onAdd={(p) => { social.toggleRequest(p.id); setSheet(null); show({ text: `Заявка ушла: ${p.name}` }); }} />}
            {typeof sheet === 'object' && sheet && 'rename' in sheet && (
              <Rename p={sheet.rename} value={social.nicknames[sheet.rename.id] ?? ''} onSave={(v) => { social.setNickname(sheet.rename.id, v); setSheet(null); }} />
            )}
          </BottomSheet>
        </>
      )}
      {toast && <Toast t={toast} style={{ position: 'absolute', left: 16, right: 16, bottom: 16 }} />}
    </View>
  );
}

function AddFriend({ people, social, onInvite, onBump, onOpen }: {
  people: Person[]; social: ReturnType<typeof useSocial.getState>; onInvite: () => void; onBump: () => void; onOpen: (id: string) => void;
}) {
  const [q, setQ] = useState('');
  const query = q.trim().toLowerCase().replace(/^@/, '');
  const found = query ? people.filter((p) => p.name.toLowerCase().includes(query) || (p.handle ?? '').toLowerCase().includes(query)).slice(0, 5) : [];
  return (
    <>
      <Text style={styles.sheetTitle}>Добавить друга</Text>
      <View style={styles.search}>
        <Ic d="M20 20l-3.5-3.5" c={[[11, 11, 7]]} size={18} color={colors.muted} w={2} />
        <TextInput value={q} onChangeText={setQ} autoFocus placeholder="Имя или @ник" placeholderTextColor={colors.muted3} style={styles.searchInput} accessibilityLabel="Найти по имени или нику" autoCapitalize="none" />
      </View>
      {found.map((p) => {
        const friend = isFriendNow(p, social);
        const sent = !!social.sent[p.id];
        return (
          <View key={p.id} style={styles.found}>
            <Pressable onPress={() => onOpen(p.id)} style={styles.cardMain} accessibilityRole="link">
              <Avatar p={p} size={40} ring={friend ? colors.friend : undefined} />
              <View style={{ flex: 1 }}><Text style={styles.name}>{p.name}</Text>{p.handle && <Text style={styles.sub}>@{p.handle}</Text>}</View>
            </Pressable>
            {friend ? <Text style={styles.sub}>в друзьях</Text> : (
              <Pressable onPress={() => social.toggleRequest(p.id)} style={[styles.dark, sent && { backgroundColor: colors.sand }]} accessibilityRole="button">
                <Text style={[styles.darkText, sent && { color: colors.ink }]}>{sent ? 'Заявка ушла' : 'Добавить'}</Text>
              </Pressable>
            )}
          </View>
        );
      })}
      {query && found.length === 0 && <Text style={styles.sub}>Никого не нашли — позови ссылкой.</Text>}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Pressable onPress={onInvite} style={styles.option} accessibilityRole="button">
          <View style={[styles.optionIcon, { backgroundColor: colors.accent }]}><Ic d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1" size={22} color={colors.ink} w={2} /></View>
          <Text style={styles.name}>Пригласить</Text>
          <Text style={styles.sub}>ссылкой в мессенджер</Text>
        </Pressable>
        <Pressable onPress={onBump} style={styles.option} accessibilityRole="button">
          <View style={[styles.optionIcon, { backgroundColor: colors.friend }]}><Ic d="M7 4h6v16H7zM15 8c1.5 1 2.5 2.5 2.5 4S16.5 15 15 16M18 5c2.5 1.8 4 4.3 4 7s-1.5 5.2-4 7" size={22} color="#FFFFFF" w={2} /></View>
          <Text style={styles.name}>Bump</Text>
          <Text style={styles.sub}>стукнитесь телефонами</Text>
        </Pressable>
      </View>
    </>
  );
}

/** Bump: оба нажимают «Bump» и держат телефоны рядом. Совпадение по времени и месту находит сервер; в демо — ближайший человек. */
function Bump({ candidates, onAdd }: { candidates: Person[]; onAdd: (p: Person) => void }) {
  const [found, setFound] = useState<Person | null>(null);
  const [match] = useState<Person | null>(() => candidates[0] ?? null);
  const t = useSharedValue(0);
  useEffect(() => {
    t.set(withRepeat(withTiming(1, { duration: 1400, easing: Easing.out(Easing.quad) }), -1, false));
    const id = setTimeout(() => setFound(match), 2200);
    return () => clearTimeout(id);
  }, [t, match]);
  const wave = useAnimatedStyle(() => ({ opacity: 0.6 * (1 - t.get()), transform: [{ scale: 0.5 + t.get() * 1.4 }] }));
  return (
    <View style={{ alignItems: 'center', gap: 14, paddingVertical: 8 }}>
      <Text style={styles.sheetTitle}>{found ? 'Нашли!' : 'Держи телефоны рядом'}</Text>
      <View style={styles.bumpZone}>
        {!found && <Animated.View style={[styles.wave, wave]} />}
        {found ? (
          <Animated.View entering={ZoomIn.springify()} style={{ alignItems: 'center', gap: 8 }}>
            <Avatar p={found} size={84} radius={42} />
            <Text style={styles.name}>{found.name}</Text>
          </Animated.View>
        ) : (
          <View style={styles.bumpPhone}><Ic d="M7 3h10v18H7zM11 18h2" size={30} color={colors.paper} w={1.8} /></View>
        )}
      </View>
      <Text style={[styles.sub, { textAlign: 'center' }]}>{found ? 'Добавить в друзья?' : 'Второй человек тоже жмёт «Bump» — найдём друг друга'}</Text>
      {found && (
        <Pressable onPress={() => onAdd(found)} style={[styles.dark, { alignSelf: 'stretch', height: 52, borderRadius: 16, alignItems: 'center' }]} accessibilityRole="button">
          <Text style={styles.darkText}>Добавить {found.name}</Text>
        </Pressable>
      )}
    </View>
  );
}

function Rename({ p, value, onSave }: { p: Person; value: string; onSave: (v: string) => void }) {
  const [v, setV] = useState(value);
  return (
    <>
      <Text style={styles.sheetTitle}>Как подписать {p.name}?</Text>
      <TextInput value={v} onChangeText={setV} autoFocus placeholder={p.name} placeholderTextColor={colors.muted3} style={styles.renameInput} maxLength={24} accessibilityLabel="Имя для друга" onSubmitEditing={() => onSave(v)} />
      <Text style={styles.sub}>Видно только тебе.</Text>
      <Pressable onPress={() => onSave(v)} style={[styles.dark, { height: 52, borderRadius: 16, alignItems: 'center' }]} accessibilityRole="button"><Text style={styles.darkText}>Сохранить</Text></Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  sCard: { width: 138, padding: 12, paddingTop: 16, borderRadius: 22, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, alignItems: 'center', gap: 12, justifyContent: 'space-between' },
  sHide: { position: 'absolute', top: 8, right: 8, width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  sBtn: { alignSelf: 'stretch', height: 36, borderRadius: 18, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  root: { flex: 1, backgroundColor: colors.paper },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  h1: { flex: 1, fontFamily: fonts.display700, fontSize: 30, letterSpacing: -0.75, color: colors.ink },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 44, paddingHorizontal: 14, borderRadius: 22, backgroundColor: colors.ink },
  addText: { fontFamily: fonts.body600, fontSize: 14, color: colors.paper },
  h2: { fontFamily: fonts.display700, fontSize: 20, color: colors.ink },
  sub: { fontFamily: fonts.body400, fontSize: 13, color: colors.muted },
  name: { fontFamily: fonts.body600, fontSize: 15, color: colors.ink },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  card: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 18, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card },
  cardMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  count: { minWidth: 22, height: 22, borderRadius: 11, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  countText: { fontFamily: fonts.mono600, fontSize: 11, color: colors.ink },
  dark: { height: 38, paddingHorizontal: 14, borderRadius: 19, backgroundColor: colors.ink, justifyContent: 'center' },
  darkText: { fontFamily: fonts.body600, fontSize: 13.5, color: colors.paper },
  x: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: colors.line2, alignItems: 'center', justifyContent: 'center' },
  friendRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  more: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  planCard: { width: 210, padding: 14, borderRadius: 20, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, gap: 12, justifyContent: 'space-between' },
  planIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  planWhen: { fontFamily: fonts.mono600, fontSize: 10.5, letterSpacing: 0.5, color: colors.muted },
  planBtn: { height: 38, borderRadius: 19, borderWidth: 1.5, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  outlineText: { fontFamily: fonts.body600, fontSize: 13, color: colors.ink },
  sheetTitle: { fontFamily: fonts.display700, fontSize: 22, color: colors.ink },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 48, paddingHorizontal: 14, borderRadius: 16, borderWidth: 1, borderColor: colors.line2, backgroundColor: colors.card },
  searchInput: { flex: 1, height: 46, fontFamily: fonts.body400, fontSize: 15, color: colors.ink },
  found: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  option: { flex: 1, padding: 14, borderRadius: 18, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, gap: 4 },
  optionIcon: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  bumpZone: { width: 200, height: 200, alignItems: 'center', justifyContent: 'center' },
  wave: { position: 'absolute', width: 200, height: 200, borderRadius: 100, borderWidth: 3, borderColor: colors.friend },
  bumpPhone: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.friend, alignItems: 'center', justifyContent: 'center' },
  renameInput: { height: 50, paddingHorizontal: 14, borderRadius: 16, borderWidth: 1, borderColor: colors.line2, backgroundColor: colors.card, fontFamily: fonts.body500, fontSize: 16, color: colors.ink },
});
