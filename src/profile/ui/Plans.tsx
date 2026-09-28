// «Мои планы»: Иду · Зовут · Сохранено — сразу под шапкой профиля.
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { EventItem, Person } from '../../data/types';
import { almaty, dayIndex } from '../../lib/clock';
import { CAT_ICON } from '../../map/icons';
import { colors, fonts } from '../../theme';
import { Ic, IC } from '../../ui/Ic';
import { Segments } from '../../ui/kit';

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
}

type Tab = 'going' | 'invites' | 'saved';

export function Plans({ going, invites, saved, now }: { going: PlanRow[]; invites: PlanRow[]; saved: PlanRow[]; now: Date }) {
  const [tab, setTab] = useState<Tab>('going');
  const rows = tab === 'going' ? going : tab === 'invites' ? invites : saved;
  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.h2}>Мои планы</Text>
        <Pressable onPress={() => router.push('/foryou')} hitSlop={8} accessibilityRole="link"><Text style={styles.link}>Найти ещё</Text></Pressable>
      </View>
      <Segments<Tab> label="Мои планы" value={tab} onChange={setTab}
        options={[['going', `Иду · ${going.length}`], ['invites', `Зовут · ${invites.length}`], ['saved', `Сохранено · ${saved.length}`]]} />
      {rows.length === 0 && (
        <Text style={styles.empty}>{tab === 'going' ? 'Пока пусто — свайпни вправо в «Для тебя» или нажми «Я иду» на событии.' : tab === 'invites' ? 'Никто пока не позвал. Позови сам — это работает.' : 'Закладка на карточке сохраняет сюда «может быть».'}</Text>
      )}
      {rows.map((r, i) => {
        const w = planWhen(r.e, now);
        const bg = r.e.coverColor ?? COVER[r.e.category] ?? colors.ink;
        const dark = bg === colors.ink;
        return (
          <Pressable key={r.e.id} onPress={() => router.push({ pathname: '/event/[id]', params: { id: r.e.id } })}
            style={[styles.row, i < rows.length - 1 && styles.line]} accessibilityRole="button" accessibilityLabel={`${r.e.title}, ${w.text}`}>
            <View style={[styles.icon, { backgroundColor: bg }]}><Ic d={r.e.meetup ? IC.home : CAT_ICON[r.e.category]} size={18} color={dark ? colors.paper : colors.ink} w={2} /></View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[styles.when, w.today && { color: colors.accentText }]}>{w.text}</Text>
              <View style={styles.titleRow}>
                <Text style={styles.title} numberOfLines={1}>{r.e.title}</Text>
                {r.tag && <View style={[styles.tag, { backgroundColor: r.tag.bg }]}><Text style={[styles.tagText, { color: r.tag.fg }]}>{r.tag.text}</Text></View>}
              </View>
              <Text style={styles.sub} numberOfLines={1}>{r.sub}</Text>
              {r.invite && (
                <View style={styles.inviteRow}>
                  <Pressable onPress={r.invite.onYes} style={[styles.inviteBtn, { backgroundColor: colors.ink }]} accessibilityRole="button"><Text style={[styles.inviteText, { color: colors.paper }]}>Иду</Text></Pressable>
                  <Pressable onPress={r.invite.onNo} style={[styles.inviteBtn, { borderWidth: 1.5, borderColor: colors.ink }]} accessibilityRole="button"><Text style={styles.inviteText}>Не смогу</Text></Pressable>
                </View>
              )}
            </View>
            <Ic d={IC.chevron} size={18} color={colors.muted} w={2} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 24, borderWidth: 1.5, borderColor: colors.ink, backgroundColor: colors.card, padding: 14, gap: 12 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  h2: { fontFamily: fonts.display700, fontSize: 21, color: colors.ink },
  link: { fontFamily: fonts.body600, fontSize: 13, color: colors.ink, textDecorationLine: 'underline' },
  empty: { fontFamily: fonts.body400, fontSize: 14, lineHeight: 20, color: colors.muted, paddingVertical: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  line: { borderBottomWidth: 1, borderBottomColor: colors.sand },
  icon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  when: { fontFamily: fonts.mono600, fontSize: 10.5, letterSpacing: 0.5, color: colors.muted },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { flexShrink: 1, fontFamily: fonts.body700, fontSize: 15, color: colors.ink },
  tag: { paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4 },
  tagText: { fontFamily: fonts.mono600, fontSize: 9, letterSpacing: 0.4 },
  sub: { fontFamily: fonts.body400, fontSize: 13, color: colors.muted },
  inviteRow: { flexDirection: 'row', gap: 8, marginTop: 6 },
  inviteBtn: { height: 36, paddingHorizontal: 16, borderRadius: 18, justifyContent: 'center' },
  inviteText: { fontFamily: fonts.body600, fontSize: 13, color: colors.ink },
});
