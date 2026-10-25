// Карточка друга на карте (MapFocus / MapMoving) и шторка «Позвать …» (MapInvite).
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { Keyframe } from 'react-native-reanimated';
import type { FriendSpot, Person } from '../../data/types';
import type { InviteIdea } from '../../people/inviteFor';
import { colors, fonts } from '../../theme';
import { Avatar } from '../../ui/Avatar';
import { glass } from '../../ui/glass';
import { AvatarFrame } from '../../profile/frames';
import { CalendarPlus, ChevronRight, MapPin, MessageCircle, UserRound } from 'lucide-react-native';
import { Ic, IC } from '../../ui/Ic';
import { CAT_ICON } from '../icons';
import { BatteryTag } from '../pins';
import { planWhen } from '../../lib/planWhen';
import {STICKERS,stickerUnlocked} from '../../stickers/catalog';
import {StickerView} from '../../stickers/StickerView';
import {useQuery} from '@tanstack/react-query';
import {getMeStats} from '../../live/api';
import {config} from '../../lib/config';

export {STICKERS} from '../../stickers/catalog';
const cardIn = new Keyframe({ 0: { opacity: 0, transform: [{ translateY: 60 }] }, 100: { opacity: 1, transform: [{ translateY: 0 }] } }).duration(300);

/** «обновлено 2 мин назад», «обновлено только что». */
export function updatedText(min: number | undefined): string {
  const m = min ?? 1;
  if (m < 1) return 'обновлено только что';
  if (m < 60) return `обновлено ${m} мин назад`;
  return `обновлено ${Math.floor(m / 60)} ч назад`;
}

export function FriendCard({ p, spot, ring, onProfile, onSticker, onWrite, onInvite }: {
  p: Person; spot: FriendSpot; ring: string;
  onProfile: () => void; onSticker: (i: number) => void; onWrite: () => void; onInvite: () => void;
}) {
  const {data:stats}=useQuery({queryKey:['me','stats'],queryFn:getMeStats,enabled:config.dataMode!=='demo'});
  const level=stats?.level??1;
  const moving = spot.state === 'moving';
  const paused = spot.state === 'paused';
  const status = paused ? 'геолокация на паузе' : updatedText(spot.minutesAgo);
  // Только открытые стикеры — закрытые в быстрой ленте не нужны (они есть в чате, в «Откроются позже»).
  const quick = STICKERS.map((st, i) => ({ st, i })).filter(({ st }) => stickerUnlocked(st, level));
  return (
    <Animated.View entering={cardIn} style={[styles.card, glass]}>
      <Pressable onPress={onProfile} style={({ pressed }) => [styles.top, pressed && { opacity: 0.7 }]} accessibilityRole="link" accessibilityLabel={`Профиль: ${p.name}`}>
        <AvatarFrame frameId={p.mapFrame} shape={p.mapShape} photo={p.photo} initial={p.initial} tint={p.tint} size={58} ring={paused ? '#8C8577' : ring} animate={false} />
        <View style={{ flex: 1, gap: 5 }}>
          <Text style={styles.name} numberOfLines={1}>{p.name}</Text>
          <View style={styles.statusRow}>
            <View style={[styles.placeChip, paused && { backgroundColor: '#D9D3C5' }]}>
              <MapPin size={12} color={paused ? colors.muted2 : colors.friend} strokeWidth={2.4} />
              <Text style={[styles.placeText, paused && { color: colors.muted2 }]} numberOfLines={1}>{spot.place}</Text>
            </View>
            {moving && spot.speedKmh != null && <View style={styles.speed}><Text style={styles.speedText}>{spot.speedKmh} КМ/Ч</Text></View>}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={styles.status}>{status}</Text>
            {spot.battery != null && !paused && <BatteryTag level={spot.battery} charging={!!spot.charging} />}
          </View>
        </View>
        <ChevronRight size={20} color={colors.muted} strokeWidth={2} />
      </Pressable>
      {quick.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stickers} accessibilityLabel="Кинуть стикер">
          {quick.map(({ st, i }) => (
            <Pressable key={st.id} onPress={() => onSticker(i)} accessibilityRole="button" accessibilityLabel={`Кинуть стикер «${st.label}»`}
              style={({ pressed }) => [styles.stickerTile, pressed && { transform: [{ scale: 0.88 }] }]}>
              <View style={{ transform: [{ scale: 0.72 }] }}><StickerView st={st} /></View>
            </Pressable>
          ))}
        </ScrollView>
      )}
      <View style={styles.actions}>
        <Pressable onPress={onWrite} style={({ pressed }) => [styles.act, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel={`Написать ${p.name}`}>
          <MessageCircle size={20} color={colors.ink} strokeWidth={1.9} /><Text style={styles.actText}>Написать</Text>
        </Pressable>
        <Pressable onPress={onInvite} style={({ pressed }) => [styles.act, styles.actMain, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel={`Позвать ${p.name}`}>
          <CalendarPlus size={20} color={colors.ink} strokeWidth={1.9} /><Text style={styles.actText}>Позвать</Text>
        </Pressable>
        <Pressable onPress={onProfile} style={({ pressed }) => [styles.act, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel={`Профиль ${p.name}`}>
          <UserRound size={20} color={colors.ink} strokeWidth={1.9} /><Text style={styles.actText}>Профиль</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

const COLOR: Record<string, string> = { music: colors.accent, games: colors.softGreen, standup: colors.ink, art: colors.sand, food: colors.softYellow, hike: colors.ink, concert: colors.ink };

export function InviteFriendSheet({ p, title, ideas, now, onOwn, onSend, busy = false }: {
  busy?: boolean; p: Person; title: string; ideas: InviteIdea[]; now: Date; onOwn: () => void; onSend: (eventId: string) => void;
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
      <Pressable disabled={busy || !ideas[pick]} onPress={() => ideas[pick] && onSend(ideas[pick].e.id)} style={styles.send} accessibilityRole="button">
        <Text style={[styles.btnText, { color: colors.paper, fontSize: 16 }]}>{busy ? 'Отправляю…' : title}</Text>
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 28, padding: 14, gap: 12 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  name: { fontFamily: fonts.display800, fontSize: 21, letterSpacing: -0.4, color: colors.ink },
  place: { fontFamily: fonts.body400, fontSize: 13, color: colors.muted2 },
  placeChip: { flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: 190, height: 24, paddingHorizontal: 8, borderRadius: 12, backgroundColor: 'rgba(36,71,184,0.1)' },
  placeText: { fontFamily: fonts.body600, fontSize: 12.5, color: colors.friend, flexShrink: 1 },
  stickerTile: { width: 66, height: 72, borderRadius: 16, backgroundColor: 'rgba(23,22,26,0.04)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  actions: { flexDirection: 'row', gap: 8 },
  act: { flex: 1, height: 60, borderRadius: 18, backgroundColor: '#EDE8DD', alignItems: 'center', justifyContent: 'center', gap: 4 },
  actMain: { backgroundColor: colors.accent },
  actText: { fontFamily: fonts.body600, fontSize: 12.5, color: colors.ink },
  pressed: { transform: [{ scale: 0.96 }] },
  link: { fontFamily: fonts.body600, fontSize: 13, color: colors.ink, textDecorationLine: 'underline' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  speed: { height: 20, paddingHorizontal: 7, borderRadius: 10, backgroundColor: colors.friend, justifyContent: 'center' },
  speedText: { fontFamily: fonts.mono600, fontSize: 10.5, color: '#FFFFFF' },
  status: { fontFamily: fonts.mono600, fontSize: 10.5, letterSpacing: 0.4, color: colors.muted },
  plan: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, paddingHorizontal: 12, borderRadius: 14, backgroundColor: colors.paper },
  planSq: { width: 28, height: 28, borderRadius: 9 },
  planText: { flex: 1, fontFamily: fonts.body400, fontSize: 13.5, lineHeight: 18, color: colors.ink },
  stickers: { flexDirection: 'row', gap: 10, alignItems: 'center', paddingVertical: 6, paddingHorizontal: 2 },
  sticker: { paddingHorizontal: 10, borderRadius: 12, borderWidth: 2, borderColor: '#FFFFFF', justifyContent: 'center', shadowColor: colors.ink, shadowOpacity: 0.18, shadowRadius: 4, shadowOffset: { width: 0, height: 3 }, elevation: 3 },
  stickerBig: { paddingHorizontal: 2, borderWidth: 0, shadowOpacity: 0, elevation: 0, backgroundColor: 'transparent' },
  stickerTape: { borderRadius: 3, borderWidth: 0, shadowOpacity: 0.28, shadowRadius: 2, shadowOffset: { width: 2, height: 2 } },
  stickerText: { fontFamily: fonts.display800, fontSize: 13, letterSpacing: 0.3 },
  stickerEmoji: { fontSize: 28, lineHeight: 34 },
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
