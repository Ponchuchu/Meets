// Карточка друга на карте (MapFocus / MapMoving) и шторка «Позвать …» (MapInvite).
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Keyframe } from 'react-native-reanimated';
import type { FriendSpot, Person, PersonDetails } from '../../data/types';
import type { InviteIdea } from '../../people/inviteFor';
import { colors, fonts } from '../../theme';
import { Avatar } from '../../ui/Avatar';
import { Ic, IC } from '../../ui/Ic';
import { CAT_ICON } from '../icons';
import { planWhen } from '../../profile/ui/Plans';

export const STICKERS: { label: string; bg: string; fg: string; rot: number }[] = [
  { label: 'ГО?', bg: colors.accent, fg: colors.ink, rot: -4 },
  { label: 'ТЫ ГДЕ?', bg: colors.friend, fg: '#FFFFFF', rot: 3 },
  { label: 'КОФЕ?', bg: colors.sand, fg: colors.ink, rot: -2 },
  { label: 'ЖДУ', bg: colors.softGreen, fg: colors.ink, rot: 4 },
  { label: 'ПРИВЕТ', bg: colors.ink, fg: colors.paper, rot: -3 },
];

const cardIn = new Keyframe({ 0: { opacity: 0, transform: [{ translateY: 60 }] }, 100: { opacity: 1, transform: [{ translateY: 0 }] } }).duration(300);

export function FriendCard({ p, d, spot, ring, onProfile, onPlan, onSticker, onWrite, onInvite }: {
  p: Person; d: PersonDetails | undefined; spot: FriendSpot; ring: string;
  onProfile: () => void; onPlan: () => void; onSticker: (i: number) => void; onWrite: () => void; onInvite: () => void;
}) {
  const moving = spot.state === 'moving';
  const status = moving ? `${(spot.vehicle ?? 'в пути').toUpperCase()} · ОБНОВЛЯЕТСЯ ВЖИВУЮ`
    : spot.state === 'paused' ? 'ГЕОЛОКАЦИЯ НА ПАУЗЕ' : `НА МЕСТЕ · ОБНОВЛЕНО ${spot.minutesAgo ?? 1} МИН НАЗАД`;
  return (
    <Animated.View entering={cardIn} style={styles.card}>
      <View style={styles.top}>
        <Avatar p={p} size={52} ring={ring} style={{ borderWidth: 3 }} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.name}>{p.name}</Text>
          <Text style={styles.place} numberOfLines={1}>{spot.place}</Text>
        </View>
        <Pressable onPress={onProfile} hitSlop={10} accessibilityRole="link"><Text style={styles.link}>Профиль</Text></Pressable>
      </View>
      <View style={styles.statusRow}>
        {moving && <View style={styles.speed}><Text style={styles.speedText}>{spot.speedKmh} КМ/Ч</Text></View>}
        <Text style={styles.status}>{status}</Text>
      </View>
      {d?.planLine && (
        <Pressable onPress={onPlan} style={styles.plan} accessibilityRole="button">
          <View style={[styles.planSq, { backgroundColor: d.planLine.color }]} />
          <Text style={styles.planText}>{d.planLine.text}</Text>
          <Ic d={IC.chevron} size={16} color={colors.muted} w={2} />
        </Pressable>
      )}
      <View style={styles.stickers} accessibilityLabel="Кинуть стикер">
        {STICKERS.map((s, i) => (
          <Pressable key={s.label} onPress={() => onSticker(i)} accessibilityRole="button" accessibilityLabel={`Кинуть стикер «${s.label}»`}
            style={({ pressed }) => [styles.sticker, { backgroundColor: s.bg, transform: [{ rotate: `${s.rot}deg` }, { scale: pressed ? 0.92 : 1 }] }]}>
            <Text style={[styles.stickerText, { color: s.fg }]}>{s.label}</Text>
          </Pressable>
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Pressable onPress={onWrite} style={[styles.btn, { borderWidth: 1.5, borderColor: colors.ink }]} accessibilityRole="button"><Text style={styles.btnText}>Написать</Text></Pressable>
        <Pressable onPress={onInvite} style={[styles.btn, { backgroundColor: colors.ink }]} accessibilityRole="button"><Text style={[styles.btnText, { color: colors.paper }]}>Позвать куда-то</Text></Pressable>
      </View>
    </Animated.View>
  );
}

const COLOR: Record<string, string> = { music: colors.accent, games: colors.softGreen, standup: colors.ink, art: colors.sand, food: colors.softYellow, hike: colors.ink, concert: colors.ink };

export function InviteFriendSheet({ p, title, ideas, now, onOwn, onSend }: {
  p: Person; title: string; ideas: InviteIdea[]; now: Date; onOwn: () => void; onSend: (eventId: string) => void;
}) {
  const [pick, setPick] = useState(0);
  return (
    <>
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
        <Avatar p={p} size={46} ring={colors.friend} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.sheetTitle}>{title}</Text>
          <Text style={styles.place}>Подобрали по вашим общим интересам и планам</Text>
        </View>
      </View>
      <View style={{ gap: 8 }} accessibilityRole="radiogroup" accessibilityLabel="Куда позвать">
        {ideas.map((it, i) => {
          const on = pick === i;
          const bg = COLOR[it.e.category] ?? colors.sand;
          const w = planWhen(it.e, now).text.toLowerCase().replace(' · ', ' ');
          return (
            <Pressable key={it.e.id} onPress={() => setPick(i)} accessibilityRole="radio" accessibilityState={{ selected: on }}
              style={[styles.idea, { borderColor: on ? colors.ink : colors.line, borderWidth: on ? 1.5 : 1 }]}>
              <View style={[styles.ideaIcon, { backgroundColor: bg }]}><Ic d={CAT_ICON[it.e.category]} size={20} color={bg === colors.ink ? colors.paper : colors.ink} w={2} /></View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.ideaTitle} numberOfLines={1}>{it.e.title}</Text>
                <Text style={styles.place} numberOfLines={1}>{w} · {it.e.address.replace(/^.*?, (?=[А-ЯA-Z][^,]*, \d)/, '')}</Text>
                <Text style={styles.why}>{it.why}</Text>
              </View>
              <View style={[styles.radio, on && { borderColor: colors.ink }]}>{on && <View style={styles.radioDot} />}</View>
            </Pressable>
          );
        })}
        <Pressable onPress={onOwn} style={styles.own} accessibilityRole="button">
          <View style={[styles.ideaIcon, { backgroundColor: colors.sand }]}><Ic d={IC.plus} size={18} color={colors.ink} w={2} /></View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.ideaTitle}>Своё: кофе, прогулка, ужин</Text>
            <Text style={styles.place}>выбрать место и время самому</Text>
          </View>
        </Pressable>
      </View>
      <Pressable onPress={() => ideas[pick] && onSend(ideas[pick].e.id)} style={styles.send} accessibilityRole="button">
        <Text style={[styles.btnText, { color: colors.paper, fontSize: 16 }]}>{title}</Text>
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.cardAlt, borderRadius: 22, padding: 16, gap: 12, shadowColor: colors.ink, shadowOpacity: 0.14, shadowRadius: 12, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  name: { fontFamily: fonts.display700, fontSize: 20, color: colors.ink },
  place: { fontFamily: fonts.body400, fontSize: 13, color: colors.muted2 },
  link: { fontFamily: fonts.body600, fontSize: 13, color: colors.ink, textDecorationLine: 'underline' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  speed: { height: 20, paddingHorizontal: 7, borderRadius: 10, backgroundColor: colors.friend, justifyContent: 'center' },
  speedText: { fontFamily: fonts.mono600, fontSize: 10.5, color: '#FFFFFF' },
  status: { fontFamily: fonts.mono600, fontSize: 10.5, letterSpacing: 0.4, color: colors.muted },
  plan: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, paddingHorizontal: 12, borderRadius: 14, backgroundColor: colors.paper },
  planSq: { width: 28, height: 28, borderRadius: 9 },
  planText: { flex: 1, fontFamily: fonts.body400, fontSize: 13.5, lineHeight: 18, color: colors.ink },
  stickers: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  sticker: { height: 40, paddingHorizontal: 10, borderRadius: 12, borderWidth: 2, borderColor: '#FFFFFF', justifyContent: 'center', shadowColor: colors.ink, shadowOpacity: 0.18, shadowRadius: 4, shadowOffset: { width: 0, height: 3 }, elevation: 3 },
  stickerText: { fontFamily: fonts.display800, fontSize: 13 },
  btn: { flex: 1, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontFamily: fonts.body600, fontSize: 15, color: colors.ink },
  sheetTitle: { fontFamily: fonts.display700, fontSize: 22, letterSpacing: -0.2, color: colors.ink },
  idea: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 18, backgroundColor: colors.card },
  ideaIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  ideaTitle: { fontFamily: fonts.body600, fontSize: 15, color: colors.ink },
  why: { fontFamily: fonts.mono600, fontSize: 10, letterSpacing: 0.4, color: colors.accentText },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: '#B9B2A3', alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.ink },
  own: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 18, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.line2 },
  send: { height: 56, borderRadius: 16, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
});
