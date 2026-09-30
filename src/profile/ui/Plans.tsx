// «Планы» в профиле: Иду · Зовут · Сохранено — карусель карточек-афиш. Без рамки и текстовых подсказок:
// пустая вкладка — одна «призрачная» карточка-действие.
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import type { EventItem, Person } from '../../data/types';
import { almaty, dayIndex } from '../../lib/clock';
import { CAT_ICON } from '../../map/icons';
import { Avatar } from '../../ui/Avatar';
import { colors, fonts } from '../../theme';
import { Ic, IC } from '../../ui/Ic';

const COVER: Partial<Record<EventItem['category'], string>> = {
  music: colors.accent, art: colors.sand, games: colors.softGreen, food: colors.softYellow, sport: colors.softBlue, bike: colors.softBlue,
  talks: colors.softBlue, lecture: colors.softGreen, theatre: colors.softPink, meetup: colors.softYellow,
};
const DAYS = ['ВС', 'ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ'];

export function planWhen(e: EventItem, now: Date): { text: string; today: boolean } {
  const a = almaty(e.startsAt);
  const hm = (d: Date) => `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
  const today = dayIndex(e.startsAt) === dayIndex(now) || (e.isLong && dayIndex(e.startsAt) <= dayIndex(now));
  if (e.isLong && e.endsAt && today) return { text: `СЕГОДНЯ · ДО ${hm(almaty(e.endsAt))}`, today };
  if (today) return { text: `СЕГОДНЯ · ${hm(a)}`, today };
  if (dayIndex(e.startsAt) - dayIndex(now) === 1) return { text: `ЗАВТРА · ${hm(a)}`, today: false };
  return { text: `${DAYS[a.getUTCDay()]} ${a.getUTCDate()}.${a.getUTCMonth() + 1} · ${hm(a)}`, today: false };
}

export function withFriends(e: EventItem, people: Person[]): string {
  const ns = e.friendsGoing.map((id) => people.find((p) => p.id === id)).filter(Boolean).map((p) => p!.withName ?? p!.name);
  if (!ns.length) return e.lookers?.length ? `ищут компанию: ${e.lookers.length}` : e.address.split(',')[0];
  return `с ${ns.length === 1 ? ns[0] : `${ns.slice(0, -1).join(', ')} и ${ns[ns.length - 1]}`}`;
}

export interface PlanRow {
  e: EventItem;
  sub: string;
  tag?: { text: string; bg: string; fg: string };
  invite?: { fromName: string; onYes: () => void; onNo: () => void };
  faces?: Person[];
}

type Tab = 'going' | 'invites' | 'saved';
const TABS: [Tab, string][] = [['going', 'Иду'], ['invites', 'Зовут'], ['saved', 'Сохранено']];
const GHOST: Record<Tab, { text: string; icon: string; to: '/foryou' | '/create' }> = {
  going: { text: 'Выбрать в рекомендациях', icon: 'M5 12h14M13 6l6 6-6 6', to: '/foryou' },
  invites: { text: 'Позвать друзей самому', icon: 'M12 5v14M5 12h14', to: '/create' },
  saved: { text: 'Сохраняй закладкой на карточке', icon: 'M6 3.5h12v17l-6-4-6 4z', to: '/foryou' },
};

export function Plans({ going, invites, saved, now, onCalendar }: { going: PlanRow[]; invites: PlanRow[]; saved: PlanRow[]; now: Date; onCalendar?: () => void }) {
  const [tab, setTab] = useState<Tab>(going.length || !invites.length ? 'going' : 'invites');
  const rows = tab === 'going' ? going : tab === 'invites' ? invites : saved;
  const count = { going: going.length, invites: invites.length, saved: saved.length };
  const ghost = GHOST[tab];
  return (
    <View style={{ gap: 12 }}>
      <View style={styles.head}>
        <Text style={styles.h2}>Планы</Text>
        {onCalendar && (
          <Pressable onPress={onCalendar} style={({ pressed }) => [styles.cal, pressed && { opacity: 0.7 }]} accessibilityRole="button" accessibilityLabel="Планы в календаре">
            <Ic d="M4 6.5A1.5 1.5 0 015.5 5h13A1.5 1.5 0 0120 6.5v12a1.5 1.5 0 01-1.5 1.5h-13A1.5 1.5 0 014 18.5zM4 10h16M8.5 3v4M15.5 3v4" size={16} color={colors.ink} w={2} />
            <Text style={styles.calText}>Календарь</Text>
          </Pressable>
        )}
      </View>
      <View style={{ paddingHorizontal: 4 }}>
        <View style={styles.tabs} accessibilityRole="tablist">
          {TABS.map(([k, label]) => {
            const on = k === tab;
            return (
              <Pressable key={k} onPress={() => setTab(k)} style={[styles.tab, on && styles.tabOn]} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={`${label}: ${count[k]}`}>
                <Text style={[styles.tabText, on && { color: colors.paper }]}>{label}</Text>
                {count[k] > 0 && <Text style={[styles.tabN, on && { color: colors.accent }]}>{count[k]}</Text>}
              </Pressable>
            );
          })}
        </View>
      </View>
      <ScrollView key={tab} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingHorizontal: 4, paddingRight: 16 }}>
        {rows.map((r, i) => {
          const w = planWhen(r.e, now);
          const bg = r.e.coverColor ?? COVER[r.e.category] ?? colors.ink;
          const dark = bg === colors.ink || bg === colors.accent;
          return (
            <Animated.View key={r.e.id} entering={FadeIn.delay(i * 50).duration(220)} style={styles.card}>
              <Pressable onPress={() => router.push({ pathname: '/event/[id]', params: { id: r.e.id } })} accessibilityRole="button" accessibilityLabel={`${r.e.title}, ${w.text}`}>
                <View style={[styles.cover, { backgroundColor: bg }]}>
                  <View style={styles.bigIcon} pointerEvents="none"><Ic d={r.e.meetup ? IC.home : CAT_ICON[r.e.category]} size={84} color={dark ? 'rgba(255,255,255,0.22)' : 'rgba(23,22,26,0.12)'} w={1.6} /></View>
                  <View style={[styles.when, w.today && { backgroundColor: colors.ink }]}><Text style={[styles.whenText, w.today && { color: colors.paper }]}>{w.text}</Text></View>
                  {r.tag && <View style={[styles.tag, { backgroundColor: r.tag.bg }]}><Text style={[styles.tagText, { color: r.tag.fg }]}>{r.tag.text}</Text></View>}
                </View>
                <View style={styles.body}>
                  <Text style={styles.title} numberOfLines={2}>{r.e.title}</Text>
                  <View style={styles.subRow}>
                    {!!r.faces?.length && (
                      <View style={{ flexDirection: 'row', marginRight: 2 }}>
                        {r.faces.slice(0, 3).map((p, j) => <Avatar key={p.id} p={p} size={22} style={{ marginLeft: j ? -7 : 0, borderWidth: 1.5, borderColor: colors.card }} />)}
                      </View>
                    )}
                    <Text style={styles.sub} numberOfLines={1}>{r.sub}</Text>
                  </View>
                </View>
              </Pressable>
              {r.invite && (
                <View style={styles.inviteRow}>
                  <Pressable onPress={r.invite.onYes} style={[styles.inviteBtn, { backgroundColor: colors.ink }]} accessibilityRole="button" accessibilityLabel={`Иду: ${r.e.title}`}><Text style={[styles.inviteText, { color: colors.paper }]}>Иду</Text></Pressable>
                  <Pressable onPress={r.invite.onNo} style={[styles.inviteBtn, { backgroundColor: colors.sand2 }]} accessibilityRole="button" accessibilityLabel={`Не смогу: ${r.e.title}`}><Text style={styles.inviteText}>Не смогу</Text></Pressable>
                </View>
              )}
            </Animated.View>
          );
        })}
        <Pressable onPress={() => router.push(ghost.to)} style={({ pressed }) => [styles.ghost, rows.length > 0 && styles.ghostSmall, pressed && { opacity: 0.7 }]} accessibilityRole="button" accessibilityLabel={ghost.text}>
          <View style={styles.ghostIcon}><Ic d={ghost.icon} size={20} color={colors.ink} w={2.2} /></View>
          <Text style={styles.ghostText}>{ghost.text}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const CARD_W = 214;
const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 },
  h2: { fontFamily: fonts.display700, fontSize: 21, color: colors.ink },
  tabs: { flexDirection: 'row', gap: 4, padding: 3, borderRadius: 18, backgroundColor: colors.sand2 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, height: 34, paddingHorizontal: 8, borderRadius: 15 },
  cal: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 34, paddingHorizontal: 12, borderRadius: 17, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  calText: { fontFamily: fonts.body600, fontSize: 13, color: colors.ink },
  tabOn: { backgroundColor: colors.ink },
  tabText: { fontFamily: fonts.body600, fontSize: 13, color: colors.ink },
  tabN: { fontFamily: fonts.mono600, fontSize: 11, color: colors.muted },
  card: { width: CARD_W, borderRadius: 22, backgroundColor: colors.card, overflow: 'hidden', borderWidth: 1, borderColor: colors.line },
  cover: { height: 104, padding: 10, justifyContent: 'space-between', overflow: 'hidden' },
  bigIcon: { position: 'absolute', right: -14, bottom: -18 },
  when: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.9)' },
  whenText: { fontFamily: fonts.mono600, fontSize: 10.5, letterSpacing: 0.4, color: colors.ink },
  tag: { alignSelf: 'flex-start', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 5 },
  tagText: { fontFamily: fonts.mono600, fontSize: 9, letterSpacing: 0.4 },
  body: { padding: 12, gap: 6, minHeight: 84 },
  title: { fontFamily: fonts.display700, fontSize: 16, lineHeight: 19, color: colors.ink },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sub: { flex: 1, fontFamily: fonts.body400, fontSize: 12.5, color: colors.muted },
  inviteRow: { flexDirection: 'row', gap: 6, paddingHorizontal: 12, paddingBottom: 12 },
  inviteBtn: { flex: 1, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  inviteText: { fontFamily: fonts.body600, fontSize: 13, color: colors.ink },
  ghost: { width: CARD_W, minHeight: 188, borderRadius: 22, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.line2, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 16 },
  ghostSmall: { width: 132 },
  ghostIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.sand2, alignItems: 'center', justifyContent: 'center' },
  ghostText: { textAlign: 'center', fontFamily: fonts.body600, fontSize: 13, color: colors.ink },
});
