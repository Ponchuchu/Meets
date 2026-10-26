// «Планы» в профиле (26 октября): компактная лента карточек вбок вместо длинного списка.
// Карточка: объёмный значок события, когда (сегодня — оранжевым), название и пометка («вы идёте вместе»).
import { router } from 'expo-router';
import { ChevronRight, Users } from 'lucide-react-native';
import { type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { EventItem, Person } from '../../data/types';
import { colors, fonts } from '../../theme';
import { Avatar } from '../../ui/Avatar';
import { EventIcon } from '../../ui/EventIcon';

export interface PlanCardItem { key: string; title: string; when: string; today?: boolean; note?: string; e?: EventItem; eventId?: string }

export function PlansStrip({ title, items, onAll, total, empty }: { title: string; items: PlanCardItem[]; onAll?: () => void; total?: number; empty?: ReactNode }) {
  if (!items.length) return empty ? <View style={{ gap: 10 }}><SectionHead title={title} />{empty}</View> : null;
  const n = total ?? items.length;
  return (
    <View style={{ gap: 10 }}>
      <SectionHead title={title} n={total} onPress={onAll} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingHorizontal: 16 }} style={{ marginHorizontal: -16 }}>
        {items.map((it) => (
          <Pressable key={it.key} onPress={() => it.eventId && router.push({ pathname: '/event/[id]', params: { id: it.eventId } })} disabled={!it.eventId}
            style={({ pressed }) => [styles.card, pressed && { transform: [{ scale: 0.97 }] }]} accessibilityRole="button" accessibilityLabel={`${it.title}, ${it.when}`}>
            <View style={styles.cardTop}>
              <EventIcon e={it.e ?? { category: 'other' as EventItem['category'], title: it.title, venueName: null }} size={46} />
              <View style={[styles.when, it.today && styles.whenToday]}><Text style={[styles.whenText, it.today && { color: '#FFFFFF' }]} numberOfLines={1}>{it.when}</Text></View>
            </View>
            <Text style={styles.title} numberOfLines={2}>{it.title}</Text>
            {!!it.note && <Text style={styles.note} numberOfLines={1}>{it.note}</Text>}
          </Pressable>
        ))}
        {onAll && n > 3 && (
          <Pressable onPress={onAll} style={({ pressed }) => [styles.card, styles.all, pressed && { transform: [{ scale: 0.97 }] }]} accessibilityRole="button" accessibilityLabel="Все планы">
            <View style={styles.allIcon}><ChevronRight size={22} color={colors.ink} strokeWidth={2} /></View>
            <Text style={styles.title}>{n > items.length ? `Ещё ${n - items.length}` : 'Все планы'}</Text>
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}

const MON = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const shortDate = (iso: string) => { const d = new Date(iso); return `${d.getDate()} ${MON[d.getMonth()]}`; };

/** Пустое место в профиле: картинка, пара слов и кнопка — вместо пустоты. */
export function EmptyRow({ icon, text, action, onAction }: { icon: ReactNode; text: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>{icon}</View>
      <Text style={styles.emptyText}>{text}</Text>
      {action && <Pressable onPress={onAction} style={({ pressed }) => [styles.emptyBtn, pressed && { opacity: 0.7 }]} accessibilityRole="button"><Text style={styles.emptyBtnText}>{action}</Text></Pressable>}
    </View>
  );
}

export function SectionHead({ title, n, onPress }: { title: string; n?: number; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={styles.head} accessibilityRole={onPress ? 'button' : 'header'}>
      <Text style={styles.headTitle}>{title}</Text>
      {n != null && <Text style={styles.headN}>{n}</Text>}
      <View style={{ flex: 1 }} />
      {onPress && <ChevronRight size={18} color={colors.muted} strokeWidth={2} />}
    </Pressable>
  );
}

/** Друзья одной строкой: лица внахлёст, «6 друзей · 3 общих», шеврон. */
export function FriendsPill({ faces, title, sub, onPress, extra, total }: { faces: Pick<Person, 'id' | 'photo' | 'initial' | 'tint'>[]; title: string; sub?: string; onPress: () => void; extra?: ReactNode; total?: number }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.pill, pressed && { transform: [{ scale: 0.98 }] }]} accessibilityRole="button" accessibilityLabel={`${title}${sub ? `, ${sub}` : ''}`}>
      <View style={styles.faces}>
        {faces.slice(0, 4).map((f, i) => <Avatar key={f.id} p={f} size={36} style={{ marginLeft: i ? -12 : 0, borderWidth: 2.5, borderColor: '#F4F0E7', zIndex: 4 - i }} />)}
        {(total ?? faces.length) > 4 && faces.length >= 4 && <View style={[styles.more, { zIndex: 0 }]}><Text style={styles.moreText}>+{Math.min(99, (total ?? faces.length) - 4)}</Text></View>}
        {!faces.length && <View style={styles.noFace}><Users size={18} color={colors.ink} strokeWidth={1.9} /></View>}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.pillTitle} numberOfLines={1}>{title}</Text>
        {!!sub && <Text style={styles.pillSub} numberOfLines={1}>{sub}</Text>}
      </View>
      {extra}
      <ChevronRight size={18} color={colors.muted} strokeWidth={2} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'baseline', gap: 8, minHeight: 28, paddingHorizontal: 4 },
  headTitle: { fontFamily: fonts.display700, fontSize: 19, letterSpacing: -0.3, color: colors.ink },
  headN: { fontFamily: fonts.body600, fontSize: 15, color: colors.muted },
  card: { width: 150, minHeight: 150, borderRadius: 24, backgroundColor: '#F4F0E7', padding: 12, gap: 6 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 2 },
  when: { maxWidth: 84, height: 24, paddingHorizontal: 8, borderRadius: 12, backgroundColor: colors.sand, alignItems: 'center', justifyContent: 'center' },
  whenToday: { backgroundColor: colors.accent },
  whenText: { fontFamily: fonts.body700, fontSize: 11.5, color: colors.ink },
  title: { fontFamily: fonts.body700, fontSize: 14.5, lineHeight: 18, color: colors.ink },
  note: { fontFamily: fonts.body500, fontSize: 12.5, color: colors.muted },
  album: { width: 128, height: 172, borderRadius: 22, overflow: 'hidden', justifyContent: 'flex-end', padding: 12, backgroundColor: colors.sand },
  albumBig: { width: 172 },
  albumN: { position: 'absolute', top: 10, right: 10, minWidth: 26, height: 26, paddingHorizontal: 7, borderRadius: 13, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  albumNText: { fontFamily: fonts.body700, fontSize: 12, color: '#FFFFFF' },
  albumTitle: { fontFamily: fonts.body700, fontSize: 15, lineHeight: 18, color: '#FFFFFF' },
  albumDate: { fontFamily: fonts.body500, fontSize: 12.5, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  all: { alignItems: 'flex-start', justifyContent: 'flex-end', width: 112, backgroundColor: colors.sand },
  allIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.6)', alignItems: 'center', justifyContent: 'center', marginBottom: 'auto' },
  more: { width: 36, height: 36, borderRadius: 18, marginLeft: -12, backgroundColor: colors.ink, borderWidth: 2.5, borderColor: '#F4F0E7', alignItems: 'center', justifyContent: 'center' },
  moreText: { fontFamily: fonts.body700, fontSize: 11.5, color: '#FFFFFF' },
  empty: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 24, backgroundColor: '#F4F0E7' },
  emptyIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(23,22,26,0.06)', alignItems: 'center', justifyContent: 'center' },
  emptyText: { flex: 1, fontFamily: fonts.body500, fontSize: 14, lineHeight: 19, color: colors.muted2 },
  emptyBtn: { minHeight: 38, paddingHorizontal: 14, borderRadius: 19, backgroundColor: colors.ink, justifyContent: 'center' },
  emptyBtnText: { fontFamily: fonts.body700, fontSize: 13.5, color: '#FFFFFF' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingHorizontal: 14, borderRadius: 24, backgroundColor: '#F4F0E7' },
  faces: { flexDirection: 'row', alignItems: 'center' },
  noFace: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(23,22,26,0.07)', alignItems: 'center', justifyContent: 'center' },
  pillTitle: { fontFamily: fonts.body700, fontSize: 15.5, color: colors.ink },
  pillSub: { fontFamily: fonts.body500, fontSize: 13, color: colors.muted },
});
