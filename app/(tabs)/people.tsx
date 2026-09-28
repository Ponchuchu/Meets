// «Люди» — design/png/Friends.png: рядом, друзья, заявки, планы друзей, «могут стать другом», приглашение по ссылке.
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { data, eventsSnapshot, type EventItem, type Person } from '../../src/data';
import { PERSON_DETAILS } from '../../src/data/demo';
import { now as clockNow } from '../../src/lib/clock';
import { CAT_ICON } from '../../src/map/icons';
import { canSee, distanceLabel, distanceM } from '../../src/people/visibility';
import { planWhen } from '../../src/profile/ui/Plans';
import { useApp } from '../../src/state/app';
import { useMapState } from '../../src/state/map';
import { usePlans } from '../../src/state/plans';
import { isFriendNow, useSocial } from '../../src/state/social';
import { colors, fonts } from '../../src/theme';
import { Avatar } from '../../src/ui/Avatar';
import { Ic, IC } from '../../src/ui/Ic';
import { Segments } from '../../src/ui/kit';
import { Toast, type ToastData } from '../../src/ui/Toast';

type Tab = 'friends' | 'interests';

export default function PeopleScreen() {
  const insets = useSafeAreaInsets();
  const now = clockNow();
  const [tab, setTab] = useState<Tab>('friends');
  const [toast, setToast] = useState<ToastData | null>(null);
  const { data: people = [] } = useQuery({ queryKey: ['people'], queryFn: () => data.getPeople() });
  const { data: spots = [] } = useQuery({ queryKey: ['friendSpots'], queryFn: () => data.getFriendSpots() });
  const { data: me } = useQuery({ queryKey: ['mySpot'], queryFn: () => data.getMySpot() });
  const { data: requests = [] } = useQuery({ queryKey: ['friendRequests'], queryFn: () => data.getFriendRequests() });
  const { data: events = [] } = useQuery({ queryKey: ['events'], queryFn: () => data.getEvents(), placeholderData: eventsSnapshot });
  const social = useSocial();
  const { going, go } = usePlans();
  const addPlan = useApp((s) => s.addPlan);
  const focusFriend = useMapState((s) => s.focusFriend);

  const friends = people.filter((p) => isFriendNow(p, social));
  const byId = (id: string) => people.find((p) => p.id === id);
  const show = (t: ToastData) => { setToast(t); setTimeout(() => setToast((c) => (c === t ? null : c)), 3500); };

  // Рядом — только те, кто сам включил геолокацию для друзей.
  const near = spots
    .map((s) => ({ s, p: byId(s.personId), d: PERSON_DETAILS[s.personId] }))
    .filter((x) => x.p && isFriendNow(x.p, social) && x.d && canSee('friend', 'location', x.d.privacy))
    .map((x) => ({ ...x, dist: me ? distanceM(me, x.s) : 0 }))
    .sort((a, b) => (b.s.state === 'moving' ? 1 : 0) - (a.s.state === 'moving' ? 1 : 0) || a.dist - b.dist);

  const friendPlans = useMemo(() => {
    const map = new Map<string, { e: EventItem; who: Person[] }>();
    for (const e of events) {
      const who = e.friendsGoing.map(byId).filter((p): p is Person => !!p && isFriendNow(p, social));
      if (who.length && new Date(e.endsAt ?? e.startsAt).getTime() > now.getTime()) map.set(e.id, { e, who });
    }
    return [...map.values()].sort((a, b) => a.e.startsAt.localeCompare(b.e.startsAt)).slice(0, 4);
  }, [events, people, social]); // eslint-disable-line react-hooks/exhaustive-deps

  const pending = requests.filter((r) => !social.answered[r.personId]);
  const maybe = ['ainura', 'erlan', 'mira', 'sasha'].map(byId).filter((p): p is Person => !!p && !isFriendNow(p, social) && !social.hidden[p.id]);
  const showOnMap = (id: string) => { focusFriend(id); router.push('/'); };
  const openChat = (id: string) => router.push({ pathname: '/chat/[id]', params: { id: `dm-${id}` } });
  const openPerson = (id: string) => router.push({ pathname: '/person/[id]', params: { id } });
  const inviteLink = () => {
    social.inviteByLink();
    Share.share({ message: 'Пойдём куда-нибудь вместе? Я в «рядом.» — по этой ссылке сразу станем друзьями: https://ryadom.kz/i/danil' }).catch(() => {});
  };

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={{ paddingTop: Math.max(50, insets.top + 6), paddingHorizontal: 16, paddingBottom: 40, gap: 14 }}>
        <View style={styles.head}>
          <Text style={styles.h1} accessibilityRole="header">Люди</Text>
          <Pressable onPress={() => router.push('/')} style={styles.mapBtn} accessibilityRole="button" accessibilityLabel="Друзья на карте">
            <Ic d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3zM9 3v15M15 6v15" size={18} color={colors.ink} />
            <Text style={styles.mapBtnText}>На карте</Text>
          </Pressable>
          <Pressable onPress={() => router.push('/settings')} style={styles.round} accessibilityRole="button" accessibilityLabel="Приватность">
            <Ic d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" size={18} color={colors.ink} />
          </Pressable>
          <Pressable onPress={inviteLink} style={[styles.round, { backgroundColor: colors.ink, borderColor: colors.ink }]} accessibilityRole="button" accessibilityLabel="Добавить друга">
            <Ic d={IC.userPlus} c={[[9, 8, 3.5]]} size={20} color={colors.paper} />
          </Pressable>
        </View>
        <Segments<Tab> label="Люди" value={tab} onChange={setTab} options={[['friends', 'Друзья'], ['interests', 'По интересам']]} />

        {tab === 'friends' ? (
          <>
            <View style={{ gap: 2 }}>
              <Text style={styles.h2}>Рядом с тобой</Text>
              <Text style={styles.sub}>Видно тех, кто сам включил геолокацию для друзей</Text>
            </View>
            {near.length === 0 && <Text style={styles.sub}>Сейчас никто из друзей не делится геолокацией.</Text>}
            {near.map(({ s, p, dist }, idx) => {
              const moving = s.state === 'moving';
              const featured = idx === 0 && moving;
              const title = moving ? `${p!.name} ${s.doing ?? 'в пути'}` : `${p!.name} ${distanceLabel(dist)}`;
              const sub = moving ? [s.vehicle, `${s.speedKmh} км/ч`, s.note].filter(Boolean).join(' · ') : s.note ?? s.place;
              return featured ? (
                <View key={p!.id} style={styles.featured}>
                  <Pressable onPress={() => openPerson(p!.id)} style={styles.featRow} accessibilityRole="button">
                    <View>
                      <Avatar p={p!} size={46} ring={colors.friend} />
                      <View style={styles.featBadge}><Ic d={CAT_ICON.art} size={11} color={colors.ink} w={2.2} /></View>
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={[styles.name, { color: colors.paper }]}>{title}</Text>
                      <Text style={[styles.sub, { color: '#BDB8AD' }]}>{sub}</Text>
                    </View>
                  </Pressable>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <Pressable onPress={() => showOnMap(p!.id)} style={[styles.bigBtn, { backgroundColor: colors.accent }]} accessibilityRole="button"><Text style={styles.bigBtnText}>На карте</Text></Pressable>
                    <Pressable onPress={() => openChat(p!.id)} style={[styles.bigBtn, { borderWidth: 1, borderColor: '#55524C' }]} accessibilityRole="button"><Text style={[styles.bigBtnText, { color: colors.paper }]}>Написать</Text></Pressable>
                  </View>
                </View>
              ) : (
                <Pressable key={p!.id} onPress={() => openPerson(p!.id)} style={styles.card} accessibilityRole="button">
                  <Avatar p={p!} size={42} ring={colors.friend} />
                  <View style={{ flex: 1, gap: 2 }}><Text style={styles.name}>{title}</Text><Text style={styles.sub}>{sub}</Text></View>
                  <Pressable onPress={() => (idx % 2 ? showOnMap(p!.id) : openChat(p!.id))} style={styles.outline} accessibilityRole="button">
                    <Text style={styles.outlineText}>{idx % 2 ? 'На карте' : 'Написать'}</Text>
                  </Pressable>
                </Pressable>
              );
            })}

            <View style={styles.row}>
              <Text style={styles.h2}>Друзья · {friends.length + 8}</Text>
              <Pressable hitSlop={8} accessibilityRole="button"><Text style={styles.link}>Все</Text></Pressable>
            </View>
            <View style={styles.faces}>
              {friends.slice(0, 4).map((p) => (
                <Pressable key={p.id} onPress={() => openPerson(p.id)} style={styles.face} accessibilityRole="button" accessibilityLabel={p.name}>
                  <Avatar p={p} size={58} ring={colors.friend} />
                  <Text style={styles.faceName}>{p.name}</Text>
                </Pressable>
              ))}
              <View style={styles.face}><View style={styles.more}><Text style={styles.moreText}>+8</Text></View><Text style={styles.faceName}>Ещё</Text></View>
            </View>

            {pending.length > 0 && (
              <>
                <View style={[styles.row, { justifyContent: 'flex-start', gap: 8 }]}>
                  <Text style={styles.h2}>Заявки в друзья</Text>
                  <View style={styles.count}><Text style={styles.countText}>{pending.length}</Text></View>
                </View>
                {pending.map((r) => {
                  const p = byId(r.personId)!;
                  return (
                    <View key={r.id} style={styles.card}>
                      <Avatar p={p} size={44} />
                      <View style={{ flex: 1, gap: 2 }}><Text style={styles.name}>{p.name}</Text><Text style={styles.sub}>{r.note}</Text></View>
                      <Pressable onPress={() => { social.answer(p.id, 'accepted'); show({ text: `${p.name} теперь в друзьях` }); }} style={styles.dark} accessibilityRole="button" accessibilityLabel={`Принять: ${p.name}`}><Text style={styles.darkText}>Принять</Text></Pressable>
                      <Pressable onPress={() => social.answer(p.id, 'declined')} style={styles.x} accessibilityRole="button" accessibilityLabel={`Отклонить: ${p.name}`}><Ic d={IC.close} size={14} color={colors.ink} w={2.2} /></Pressable>
                    </View>
                  );
                })}
              </>
            )}

            <Text style={styles.h2}>Планы друзей</Text>
            <View>
              {friendPlans.map(({ e, who }, i) => {
                const mine = !!going[e.id];
                return (
                  <View key={e.id} style={[styles.plan, i < friendPlans.length - 1 && styles.line]}>
                    <View style={{ flexDirection: 'row', width: who.length > 1 ? 58 : 40 }}>{who.slice(0, 2).map((p) => <Avatar key={p.id} p={p} size={36} ring={colors.friend} style={{ marginRight: -14 }} />)}</View>
                    <Pressable onPress={() => router.push({ pathname: '/event/[id]', params: { id: e.id } })} style={{ flex: 1, gap: 2 }} accessibilityRole="button">
                      <Text style={styles.name}>{who.length > 1 ? `${who[0].name} и ${who[1].name}` : who[0].name}</Text>
                      <Text style={styles.sub}>{e.short === 'ДЖАЗ' ? e.title : e.title.split('«')[0].trim()} · {planWhen(e, now).text.toLowerCase().replace(' · ', ' ')}</Text>
                    </Pressable>
                    <Pressable disabled={mine} onPress={() => { go(e.id); addPlan(); show({ text: `В планах: ${e.title}` }); }} style={[styles.outline, mine && { backgroundColor: colors.sand, borderColor: colors.sand }]} accessibilityRole="button">
                      <Text style={styles.outlineText}>{mine ? 'Ты идёшь' : 'Тоже пойду'}</Text>
                    </Pressable>
                  </View>
                );
              })}
            </View>
          </>
        ) : null}

        <Text style={styles.h2}>{tab === 'friends' ? 'Могут стать твоим другом' : 'По общим интересам'}</Text>
        <View style={styles.grid}>
          {maybe.slice(0, tab === 'friends' ? 2 : 4).map((p) => {
            const d = PERSON_DETAILS[p.id];
            const common = d?.interests.filter((x) => x.common).length ?? 0;
            return (
              <Pressable key={p.id} onPress={() => openPerson(p.id)} style={styles.maybe} accessibilityRole="button">
                <Avatar p={p} size={52} radius={16} />
                <Text style={[styles.name, { marginTop: 8 }]}>{p.name}{p.age ? `, ${p.age}` : ''}</Text>
                <Text style={styles.sub}>{d?.suggestNote ?? p.note}</Text>
                <Text style={styles.common}>{common} {common === 1 ? 'ОБЩИЙ ИНТЕРЕС' : common < 5 ? 'ОБЩИХ ИНТЕРЕСА' : 'ОБЩИХ ИНТЕРЕСОВ'}</Text>
              </Pressable>
            );
          })}
        </View>
        <Pressable onPress={inviteLink} style={styles.link2} accessibilityRole="button">
          <Text style={styles.link2Text}>{social.linkInvited ? 'Ссылка отправлена — позвать ещё' : 'Позвать друзей по ссылке'}</Text>
        </Pressable>
      </ScrollView>
      {toast && <Toast t={toast} style={{ position: 'absolute', left: 16, right: 16, bottom: 16 }} />}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  h1: { flex: 1, fontFamily: fonts.display700, fontSize: 30, letterSpacing: -0.75, color: colors.ink },
  mapBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 44, paddingHorizontal: 14, borderRadius: 22, borderWidth: 1.5, borderColor: colors.friend, backgroundColor: colors.card },
  mapBtnText: { fontFamily: fonts.body600, fontSize: 14, color: colors.ink },
  round: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  h2: { fontFamily: fonts.display700, fontSize: 20, color: colors.ink },
  sub: { fontFamily: fonts.body400, fontSize: 13, color: colors.muted },
  name: { fontFamily: fonts.body600, fontSize: 15, color: colors.ink },
  featured: { padding: 14, borderRadius: 22, backgroundColor: colors.ink, gap: 14 },
  featRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  featBadge: { position: 'absolute', right: -4, bottom: -4, width: 22, height: 22, borderRadius: 7, backgroundColor: colors.accent, borderWidth: 2, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  bigBtn: { flex: 1, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  bigBtnText: { fontFamily: fonts.body600, fontSize: 14, color: colors.ink },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 18, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card },
  outline: { height: 36, paddingHorizontal: 12, borderRadius: 18, borderWidth: 1.5, borderColor: colors.ink, justifyContent: 'center' },
  outlineText: { fontFamily: fonts.body600, fontSize: 13, color: colors.ink },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  link: { fontFamily: fonts.body600, fontSize: 13, color: colors.ink, textDecorationLine: 'underline' },
  faces: { flexDirection: 'row', justifyContent: 'space-between' },
  face: { alignItems: 'center', gap: 6 },
  faceName: { fontFamily: fonts.body600, fontSize: 12, color: colors.ink },
  more: { width: 58, height: 58, borderRadius: 29, backgroundColor: colors.sand, alignItems: 'center', justifyContent: 'center' },
  moreText: { fontFamily: fonts.body600, fontSize: 14, color: colors.ink },
  count: { minWidth: 22, height: 22, borderRadius: 11, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  countText: { fontFamily: fonts.mono600, fontSize: 11, color: colors.ink },
  dark: { height: 36, paddingHorizontal: 14, borderRadius: 18, backgroundColor: colors.ink, justifyContent: 'center' },
  darkText: { fontFamily: fonts.body600, fontSize: 13, color: colors.paper },
  x: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: colors.line2, alignItems: 'center', justifyContent: 'center' },
  plan: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  line: { borderBottomWidth: 1, borderBottomColor: colors.line },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  maybe: { flex: 1, minWidth: '45%', padding: 14, borderRadius: 18, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, gap: 2 },
  common: { fontFamily: fonts.mono600, fontSize: 10, letterSpacing: 0.4, color: colors.ink, marginTop: 8 },
  link2: { height: 52, borderRadius: 16, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.line2, alignItems: 'center', justifyContent: 'center' },
  link2Text: { fontFamily: fonts.body500, fontSize: 14, color: colors.ink },
});
