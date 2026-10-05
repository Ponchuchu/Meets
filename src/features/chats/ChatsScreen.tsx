// «Чаты»: один список от новых к старым, закреплённые сверху (долгое нажатие). Фильтры — все, события, личные.
// Заявки в чат — не чаты: отдельная строка «Запросы» сверху, как в Instagram, открывает свой список.
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTabInset } from '../../components/TabBar';
import { data, eventsSnapshot, type Chat } from '../../data';
import { sortChats } from '../../chat/rules';
import { CAT_COLOR, CAT_ICON, catFg } from '../../map/icons';
import { useApp } from '../../state/app';
import { useChat } from '../../state/chat';
import { usePlans } from '../../state/plans';
import { colors, fonts } from '../../theme';
import { Avatar } from '../../ui/Avatar';
import { Ic, IC } from '../../ui/Ic';

type Filter = 'all' | 'events' | 'direct' | 'requests';

export default function ChatsScreen() {
  const insets = useSafeAreaInsets();
  const tabPad = useTabInset() + 16;
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState<string | null>(null);
  const { data: chats = [] } = useQuery({ queryKey: ['chats'], queryFn: () => data.getChats() });
  const { data: requests = [] } = useQuery({ queryKey: ['chatRequests'], queryFn: () => data.getChatRequests() });
  const { data: people = [] } = useQuery({ queryKey: ['people'], queryFn: () => data.getPeople() });
  const { data: events = [] } = useQuery({ queryKey: ['events'], queryFn: () => data.getEvents(), placeholderData: eventsSnapshot });
  const chat = useChat();
  const plans = usePlans();
  const addPlan = useApp((s) => s.addPlan);
  const pending = requests.filter((r) => !chat.requests[r.id]);
  const q = (search ?? '').trim().toLowerCase();
  const match = (c: Chat) => !q || c.title.toLowerCase().includes(q) || c.lastText.toLowerCase().includes(q);
  const last = (c: Chat) => {
    const mine = chat.sent.filter((m) => m.chatId === c.id).at(-1);
    return mine ? { text: mine.text || (mine.kind === 'voice' ? 'Голосовое' : mine.kind === 'circle' ? 'Кружок' : mine.kind === 'photo' ? 'Фото' : mine.kind === 'video' ? 'Видео' : ''), time: mine.time } : { text: c.lastText, time: c.lastTime };
  };
  const unread = (c: Chat) => Math.max(0, c.unread - (chat.read[c.id] ?? 0));
  const list = sortChats(
    chats
      .filter((c) => match(c) && !(c.personId && chat.blocked[c.personId]))
      .filter((c) => filter === 'all' || (filter === 'events' ? c.kind === 'event' : filter === 'direct' ? c.kind === 'direct' : false))
      .map((c) => ({ ...c, l: last(c), time: last(c).time })),
    chat.pinned,
  );
  const open = (id: string) => router.push({ pathname: '/chat/[id]', params: { id } });

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingTop: Math.max(50, insets.top + 6), paddingHorizontal: 16, paddingBottom: tabPad, gap: 14 }}>
      <View style={styles.head}>
        <Text style={styles.h1} accessibilityRole="header">Чаты</Text>
        <Pressable onPress={() => setSearch(search == null ? '' : null)} style={styles.round} accessibilityRole="button" accessibilityLabel="Поиск по чатам">
          <Ic d="M20 20l-3.5-3.5" c={[[11, 11, 7]]} size={20} color={colors.ink} w={1.9} />
        </Pressable>
      </View>
      {search != null && <TextInput value={search} onChangeText={setSearch} autoFocus placeholder="Найти чат или сообщение" placeholderTextColor={colors.muted3} style={styles.search} accessibilityLabel="Поиск по чатам" />}
      {filter === 'requests' ? (
        <Pressable onPress={() => setFilter('all')} style={styles.reqHead} accessibilityRole="button" accessibilityLabel="Назад к чатам">
          <Ic d={IC.back} size={20} color={colors.ink} w={2} />
          <Text style={styles.reqTitle}>Запросы</Text>
        </Pressable>
      ) : (
        <View style={styles.filters}>
          {([['all', 'Все'], ['events', 'События'], ['direct', 'Личные']] as [Filter, string][]).map(([k, label]) => {
            const on = filter === k;
            return (
              <Pressable key={k} onPress={() => setFilter(k)} style={[styles.chip, on && { backgroundColor: colors.ink, borderColor: colors.ink }]} accessibilityRole="button" accessibilityState={{ selected: on }}>
                <Text style={[styles.chipText, on && { color: colors.paper }]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {filter !== 'requests' && pending.length > 0 && (
        <Pressable onPress={() => setFilter('requests')} style={({ pressed }) => [styles.reqRow, pressed && { opacity: 0.75 }]} accessibilityRole="button" accessibilityLabel={`Запросы: ${pending.length}`}>
          <View style={{ flexDirection: 'row' }}>
            {pending.slice(0, 3).map((r, i) => {
              const p = people.find((x) => x.id === r.personId);
              return p ? <Avatar key={r.id} p={p} size={34} style={{ marginLeft: i ? -12 : 0, borderWidth: 2, borderColor: colors.paper }} /> : null;
            })}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>Запросы</Text>
            <Text style={styles.sub} numberOfLines={1}>Хотят в чат события или написать тебе</Text>
          </View>
          <View style={styles.badge}><Text style={styles.badgeText}>{pending.length}</Text></View>
          <Ic d={IC.chevron} size={18} color={colors.muted} w={2} />
        </Pressable>
      )}

      {filter === 'requests' && pending.length > 0 && (
        <>
          {pending.map((r) => {
            const p = people.find((x) => x.id === r.personId);
            if (!p) return null;
            // Все запросы — одна карточка: кто, что хочет, цитата и две кнопки.
            const join = r.kind === 'join';
            return (
              <View key={r.id} style={styles.request}>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <Avatar p={p} size={44} ring={p.isFriend ? colors.friend : undefined} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.name}>{r.title}</Text>
                    <Text style={styles.sub}>{r.sub}</Text>
                    {r.quote && <Text style={styles.quote}>{r.quote}</Text>}
                  </View>
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Pressable onPress={() => {
                    chat.answerRequest(r.id, 'accepted');
                    if (join) { if (!plans.going.bike) { plans.go('bike'); addPlan(); } } else open(`dm-${p.id}`);
                  }} style={[styles.btn, { backgroundColor: colors.ink }]} accessibilityRole="button">
                    <Text style={[styles.btnText, { color: colors.paper }]}>{join ? 'Принять' : 'Ответить'}</Text>
                  </Pressable>
                  <Pressable onPress={() => chat.answerRequest(r.id, 'later')} style={[styles.btn, { backgroundColor: colors.sand2 }]} accessibilityRole="button"><Text style={styles.btnText}>Не сейчас</Text></Pressable>
                </View>
              </View>
            );
          })}
        </>
      )}
      {filter === 'requests' && pending.length === 0 && <Text style={styles.sub}>Новых заявок нет.</Text>}

      {list.length > 0 && filter !== 'requests' && (
        <View>
          {list.map((c, i) => {
            const e = c.kind === 'event' ? events.find((x) => x.id === c.eventId) : undefined;
            const p = c.kind === 'direct' ? people.find((x) => x.id === c.personId) : undefined;
            const n = unread(c);
            const pin = !!chat.pinned[c.id];
            return (
              <Pressable key={c.id} onPress={() => open(c.id)} onLongPress={() => chat.togglePin(c.id)} delayLongPress={350}
                style={({ pressed }) => [styles.row, i < list.length - 1 && styles.line, pressed && { opacity: 0.7 }]}
                accessibilityRole="button" accessibilityLabel={`${c.title}. ${c.l.text}${pin ? '. Закреплён' : ''}`}
                accessibilityActions={[{ name: 'longpress', label: pin ? 'Открепить' : 'Закрепить' }]} onAccessibilityAction={() => chat.togglePin(c.id)}>
                {p ? <Avatar p={p} size={48} ring={p.isFriend ? colors.friend : undefined} /> : (
                  <View style={[styles.evIcon, { backgroundColor: e ? CAT_COLOR[e.category] : colors.ink }]}>
                    <Ic d={e ? CAT_ICON[e.category] : 'M4 5h16v11H9l-5 4z'} size={21} color={e ? catFg(e.category) : colors.paper} w={2} />
                  </View>
                )}
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.name} numberOfLines={1}>{c.title}</Text>
                  <Text style={styles.sub} numberOfLines={1}>{c.l.text}</Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 6 }}>
                  <Text style={styles.time}>{c.l.time}</Text>
                  {n > 0 ? <View style={styles.unread}><Text style={styles.unreadText}>{n}</Text></View>
                    : pin ? <Ic d="M9 4h6l-1 5 3 3v2H7v-2l3-3zM12 14v6" size={14} color={colors.muted} w={2} /> : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      )}
      {list.length === 0 && filter !== 'requests' && <Text style={styles.sub}>{q ? 'Ничего не нашли.' : 'Пока нет чатов.'}</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  h1: { fontFamily: fonts.display700, fontSize: 30, letterSpacing: -0.75, color: colors.ink },
  round: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  search: { height: 46, paddingHorizontal: 16, borderRadius: 23, borderWidth: 1, borderColor: colors.line2, backgroundColor: colors.card, fontFamily: fonts.body400, fontSize: 15, color: colors.ink },
  filters: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 34, paddingHorizontal: 13, borderRadius: 17, borderWidth: 1, borderColor: colors.line2, backgroundColor: colors.card },
  chipText: { fontFamily: fonts.body500, fontSize: 13.5, color: colors.ink },
  badge: { minWidth: 22, height: 22, borderRadius: 11, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  badgeText: { fontFamily: fonts.mono600, fontSize: 10, color: colors.ink },
  reqHead: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 44 },
  reqTitle: { fontFamily: fonts.display700, fontSize: 20, color: colors.ink },
  reqRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 18, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  cap: { fontFamily: fonts.mono600, fontSize: 10.5, letterSpacing: 0.8, color: colors.muted, marginTop: 4 },
  request: { padding: 14, borderRadius: 20, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, gap: 12 },
  name: { fontFamily: fonts.body700, fontSize: 15, color: colors.ink },
  sub: { fontFamily: fonts.body400, fontSize: 13, color: colors.muted },
  quote: { fontFamily: fonts.body400, fontSize: 14, color: colors.ink, marginTop: 2 },
  btn: { flex: 1, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontFamily: fonts.body600, fontSize: 14, color: colors.ink },
  answerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 18, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  line: { borderBottomWidth: 1, borderBottomColor: colors.line },
  evIcon: { width: 48, height: 48, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  time: { fontFamily: fonts.mono500, fontSize: 11, color: colors.muted },
  unread: { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  unreadText: { fontFamily: fonts.mono600, fontSize: 10.5, color: colors.paper },
});
