// «Уведомления» (FIX5, как «Активность» в Instagram): заявки в друзья, новые друзья, приглашения и ответы,
// стикеры, напоминания, подборки и входы в аккаунт — одним списком по группам «Новые / Сегодня / Вчера…».
// Заявку можно принять, на приглашение ответить, а чужой вход — закрыть «Выйти на других устройствах» прямо в строке.
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useFocusEffect } from 'expo-router';
import { Ban, Bell, CalendarHeart, ChevronLeft, MapPin, ShieldCheck, Sparkles, Sticker, UserCheck, UserPlus, type LucideIcon } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getActivity, useActivitySeen } from '../../activity/data';
import { groupActivity, shortAgo, type ActivityIcon, type ActivityItem } from '../../activity/model';
import { data } from '../../data';
import { config } from '../../lib/config';
import { answerInvite, getInvites } from '../../live/api';
import { useSocialActions } from '../../live/socialActions';
import { supabase } from '../../data/client';
import { usePlans } from '../../state/plans';
import { colors, fonts } from '../../theme';
import { Avatar } from '../../ui/Avatar';
import { StateView } from '../../ui/StateView';
import { Toast, type ToastData } from '../../ui/Toast';

const ICON: Record<ActivityIcon, { Icon: LucideIcon; bg: string }> = {
  person: { Icon: UserPlus, bg: colors.friend }, friend: { Icon: UserCheck, bg: '#2FA35A' }, calendar: { Icon: CalendarHeart, bg: colors.accent },
  sticker: { Icon: Sticker, bg: '#9167CE' }, near: { Icon: MapPin, bg: colors.friend }, bell: { Icon: Bell, bg: '#C98A1B' },
  cancel: { Icon: Ban, bg: '#8C8577' }, shield: { Icon: ShieldCheck, bg: colors.ink }, sparkles: { Icon: Sparkles, bg: colors.accent },
};

export default function ActivityScreen() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['activity'], queryFn: getActivity, staleTime: 30e3 });
  const { data: people = [] } = useQuery({ queryKey: ['people'], queryFn: () => data.getPeople() });
  // Что было новым при открытии — остаётся в «Новых», пока экран открыт; отметка «прочитано» — при уходе.
  const [seenAt] = useState(() => useActivitySeen.getState().seenAt);
  const [now] = useState(() => Date.now());
  useFocusEffect(useCallback(() => () => useActivitySeen.getState().seen(), []));
  const [toast, setToast] = useState<ToastData | null>(null);
  const show = (text: string) => { const t = { text }; setToast(t); setTimeout(() => setToast((c) => (c === t ? null : c)), 3500); };
  const social = useSocialActions(show);
  const [done, setDone] = useState<Record<string, string>>({});
  const [refreshing, setRefreshing] = useState(false);
  const items = (q.data ?? []).map((it) => {
    if (it.who || !it.personId) return it;
    const p = people.find((x) => x.id === it.personId);
    return p ? { ...it, who: p.name, photo: it.photo ?? (p.photo as string | null) ?? null } : it;
  });
  const groups = groupActivity(items, seenAt, now);
  const refresh = async () => { setRefreshing(true); await q.refetch(); setRefreshing(false); };

  const acceptFriend = async (it: ActivityItem, yes: boolean) => {
    if (!it.personId) return;
    if (await social.answer(it.personId, yes ? 'accepted' : 'declined')) setDone((d) => ({ ...d, [it.id]: yes ? 'Теперь вы друзья' : 'Скрыто' }));
  };
  const answer = async (it: ActivityItem, yes: boolean) => {
    if (!it.eventId) return;
    try {
      if (config.dataMode !== 'demo') {
        const inv = (await getInvites()).find((x) => x.event_id === it.eventId && x.from_id === it.personId && !x.answer);
        if (inv) await answerInvite(inv, yes);
      }
      if (yes) usePlans.getState().go(it.eventId);
      setDone((d) => ({ ...d, [it.id]: yes ? 'Ты идёшь — в «Планах»' : 'Ответил «не смогу»' }));
      void qc.invalidateQueries({ queryKey: ['invites'] });
    } catch { show('Не удалось ответить. Проверь связь'); }
  };
  const signOutOthers = async () => {
    try {
      if (config.dataMode !== 'demo') { const { error } = await supabase().auth.signOut({ scope: 'others' }); if (error) throw error; }
      show('Готово: на других устройствах ты вышел из аккаунта');
    } catch { show('Не удалось. Проверь связь и повтори'); }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + 6 }]}>
      <View style={styles.head}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/chats'))} style={styles.back} accessibilityRole="button" accessibilityLabel="Назад" hitSlop={6}>
          <ChevronLeft size={26} color={colors.ink} strokeWidth={1.8} />
        </Pressable>
        <Text style={styles.title} accessibilityRole="header">Уведомления</Text>
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 40, gap: 18 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />}>
        {q.isPending && <StateView kind="loading" title="Загружаю…" />}
        {q.isError && !items.length && <StateView kind="error" text="Не загрузились. Проверь связь." onAction={() => void q.refetch()} />}
        {!q.isPending && !q.isError && !items.length && <StateView kind="empty" title="Пока тихо" text="Здесь появятся заявки в друзья, приглашения, стикеры и всё важное от приложения." />}
        {groups.map((g, gi) => (
          <Animated.View key={g.title} entering={FadeIn.delay(gi * 60)} style={{ gap: 4 }}>
            <View style={styles.groupHead}>
              {g.title === 'Новые' && <View style={styles.newDot} />}
              <Text style={styles.groupTitle}>{g.title}</Text>
            </View>
            {g.items.map((it, i) => {
              const ic = ICON[it.icon];
              const fresh = Date.parse(it.at) > seenAt;
              const result = done[it.id];
              return (
                <Animated.View key={it.id} entering={FadeInDown.delay(Math.min(i, 8) * 35).duration(240)} layout={LinearTransition}>
                  <Pressable onPress={() => it.href && router.push(it.href as never)} disabled={!it.href}
                    style={({ pressed }) => [styles.row, fresh && styles.rowNew, pressed && { opacity: 0.75 }]} accessibilityRole={it.href ? 'button' : 'text'}
                    accessibilityLabel={`${it.who ? `${it.who} ` : ''}${it.text}, ${shortAgo(it.at, now)}`}>
                    <View>
                      {it.who ? <Avatar p={{ photo: it.photo, initial: it.who[0], tint: '#D5CFC1' }} size={48} />
                        : <View style={[styles.iconBig, { backgroundColor: ic.bg }]}><ic.Icon size={22} color="#FFFFFF" strokeWidth={2} /></View>}
                      {it.who && <View style={[styles.badge, { backgroundColor: ic.bg }]}><ic.Icon size={11} color="#FFFFFF" strokeWidth={2.6} /></View>}
                    </View>
                    <View style={{ flex: 1, gap: 8 }}>
                      <Text style={styles.text}>
                        {it.who && <Text style={styles.who}>{it.who} </Text>}{it.text}
                        <Text style={styles.time}>  {shortAgo(it.at, now)}</Text>
                      </Text>
                      {result ? <Text style={styles.result}>{result}</Text> : it.action === 'friend' ? (
                        <View style={styles.btns}>
                          <Btn label="Принять" solid onPress={() => void acceptFriend(it, true)} />
                          <Btn label="Не сейчас" onPress={() => void acceptFriend(it, false)} />
                        </View>
                      ) : it.action === 'invite' ? (
                        <View style={styles.btns}>
                          <Btn label="Иду" solid onPress={() => void answer(it, true)} />
                          <Btn label="Не смогу" onPress={() => void answer(it, false)} />
                        </View>
                      ) : it.action === 'security' ? (
                        <Text style={styles.sec}>Это не ты? <Text onPress={() => void signOutOthers()} style={styles.secLink} accessibilityRole="link">Выйти на других устройствах</Text></Text>
                      ) : null}
                    </View>
                  </Pressable>
                </Animated.View>
              );
            })}
          </Animated.View>
        ))}
      </ScrollView>
      {toast && <Toast t={toast} style={{ position: 'absolute', left: 16, right: 16, bottom: 24 + insets.bottom }} />}
    </View>
  );
}

function Btn({ label, solid, onPress }: { label: string; solid?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.btn, solid && styles.btnSolid, pressed && { transform: [{ scale: 0.97 }] }]} accessibilityRole="button">
      <Text style={[styles.btnText, solid && { color: colors.paper }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  head: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, minHeight: 52, marginBottom: 6 },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: fonts.display800, fontSize: 26, letterSpacing: -0.6, color: colors.ink },
  groupHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  newDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent },
  groupTitle: { fontFamily: fonts.display700, fontSize: 17, color: colors.ink },
  row: { flexDirection: 'row', gap: 12, paddingVertical: 10, paddingHorizontal: 10, marginHorizontal: -10, borderRadius: 18 },
  rowNew: { backgroundColor: 'rgba(240,82,31,0.07)' },
  iconBig: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', right: -3, bottom: -3, width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.paper, alignItems: 'center', justifyContent: 'center' },
  text: { fontFamily: fonts.body400, fontSize: 14.5, lineHeight: 20, color: colors.ink, paddingTop: 2 },
  who: { fontFamily: fonts.body700 },
  time: { fontFamily: fonts.body400, fontSize: 13, color: colors.muted },
  btns: { flexDirection: 'row', gap: 8 },
  btn: { flex: 1, height: 38, borderRadius: 12, backgroundColor: 'rgba(23,22,26,0.07)', alignItems: 'center', justifyContent: 'center' },
  btnSolid: { backgroundColor: colors.ink },
  btnText: { fontFamily: fonts.body700, fontSize: 14, color: colors.ink },
  result: { fontFamily: fonts.body600, fontSize: 13.5, color: colors.muted2 },
  sec: { fontFamily: fonts.body400, fontSize: 13.5, color: colors.muted2 },
  secLink: { fontFamily: fonts.body700, color: colors.accentText, textDecorationLine: 'underline' },
});
