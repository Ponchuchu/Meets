// «Чаты»: один список от новых к старым, закреплённые сверху (долгое нажатие). Фильтры — все, события, личные.
// Заявки в чат — не чаты: отдельная строка «Запросы» сверху, как в Instagram, открывает свой список.
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { config } from '../../lib/config';
import { createFriendGroup } from '../../live/api';
import { queryClient } from '../../live/query';
import { uid } from '../../lib/uid';
import { isFriendNow, useSocial } from '../../state/social';
import { SwipeRow, type RowAction } from '../../ui/SwipeRow';
import { Archive, ArchiveRestore, CalendarCheck, EyeOff, Pin, PinOff } from 'lucide-react-native';
import { friendActivity, previewText } from '../../chat/activity';
import { getInvites, type Invite } from '../../live/api';
import { myId } from '../../live/auth';
import { Backdrop, BottomSheet } from '../../ui/sheet';
import { now as clockNow } from '../../lib/clock';
import { useRef, useState } from 'react';
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

type Filter = 'all' | 'events' | 'direct' | 'requests' | 'archive';

export default function ChatsScreen() {
  const insets = useSafeAreaInsets();
  const tabPad = useTabInset() + 16;
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState<string | null>(null);
  const { data: chats = [] } = useQuery({ queryKey: ['chats'], queryFn: () => data.getChats() });
  const { data: requests = [] } = useQuery({ queryKey: ['chatRequests'], queryFn: () => data.getChatRequests() });
  const { data: people = [] } = useQuery({ queryKey: ['people'], queryFn: () => data.getPeople() });
  const { data: events = [] } = useQuery({ queryKey: ['events'], queryFn: () => data.getEvents(), placeholderData: eventsSnapshot });
  const { data: invites = [] } = useQuery<Invite[]>({ queryKey: ['invites'], queryFn: getInvites, enabled: config.dataMode !== 'demo', staleTime: 30e3 });
  const chat = useChat();
  const social = useSocial();
  const [group, setGroup] = useState(false);
  const [groupTitle, setGroupTitle] = useState('');
  const [members, setMembers] = useState<string[]>([]);
  const [error, setError] = useState('');
  const creating = useRef(false);
  const [busy, setBusy] = useState(false);
  const friends = people.filter(p => isFriendNow(p, social));
  const create = async () => {
    if (creating.current || !groupTitle.trim() || members.length < 1) return;
    creating.current = true; setBusy(true); setError('');
    try {
      const id = config.dataMode === 'demo' ? uid('group') : await createFriendGroup(groupTitle.trim(), members);
      if(config.dataMode === 'demo') chat.addGroup({id,kind:'group',title:groupTitle.trim(),members:members.length+1,memberIds:members,lastText:'Группа создана',lastTime:'',unread:0});
      await queryClient.invalidateQueries({queryKey:['chats']});
      setGroup(false); router.push({pathname:'/chat/[id]',params:{id}});
    } catch { setError('Не удалось создать группу. Проверь связь и список друзей'); }
    finally { creating.current = false; setBusy(false); }
  };
  const plans = usePlans();
  const addPlan = useApp((s) => s.addPlan);
  const pending = requests.filter((r) => !chat.requests[r.id]);
  const q = (search ?? '').trim().toLowerCase();
  const match = (c: Chat) => !q || c.title.toLowerCase().includes(q) || c.lastText.toLowerCase().includes(q);
  const last = (c: Chat) => {
    const mine = chat.sent.filter((m) => m.chatId === c.id).at(-1);
    return mine ? { text: previewText(mine.kind, mine.text), time: mine.time, mine: true } : { text: previewText(c.lastKind, c.lastText), time: c.lastTime, mine: !!c.lastMine };
  };
  const unread = (c: Chat) => Math.max(0, c.unread - (chat.read[c.id] ?? 0));
  const list = sortChats(
    [...chats, ...chat.groups.filter(g => !chats.some(c => c.id === g.id))]
      .filter((c) => match(c) && !chat.hidden[c.id] && !(c.personId && chat.blocked[c.personId]) && (filter === 'archive' ? !!chat.archived[c.id] : !chat.archived[c.id]))
      .filter((c) => filter === 'all' || filter === 'archive' || (filter === 'events' ? c.kind === 'event' : filter === 'direct' ? c.kind === 'direct' || c.kind === 'group' : false))
      .map((c) => ({ ...c, l: last(c), time: last(c).time })),
    chat.pinned,
  );
  const goingSet = new Set(Object.keys(plans.going));
  // Друзья, с кем ещё нет диалога: показываем их внизу, чтобы список не был пустым.
  const withChat = new Set(chats.filter((c) => c.kind === 'direct').map((c) => c.personId));
  const lonely = friends.filter((p) => !withChat.has(p.id) && !chat.blocked[p.id]);
  // Действия — значки под строкой при смахивании влево (как в Telegram), без окон.
  const chatActions = (c: Chat): RowAction[] => [
    { key: 'pin', label: chat.pinned[c.id] ? 'Открепить' : 'Закрепить', color: colors.friend, icon: chat.pinned[c.id] ? <PinOff size={22} color="#FFFFFF" strokeWidth={1.9} /> : <Pin size={22} color="#FFFFFF" strokeWidth={1.9} />, onPress: () => chat.togglePin(c.id) },
    { key: 'arc', label: chat.archived[c.id] ? 'Вернуть' : 'Архив', color: '#8C8577', icon: chat.archived[c.id] ? <ArchiveRestore size={22} color="#FFFFFF" strokeWidth={1.9} /> : <Archive size={22} color="#FFFFFF" strokeWidth={1.9} />, onPress: () => chat.archive(c.id, !chat.archived[c.id]) },
    { key: 'hide', label: 'Скрыть', color: '#D8362A', icon: <EyeOff size={22} color="#FFFFFF" strokeWidth={1.9} />, onPress: () => chat.hide(c.id) },
  ];
  const open = (id: string) => router.push({ pathname: '/chat/[id]', params: { id } });

  return (
    <View style={styles.root}><ScrollView style={styles.root} contentContainerStyle={{ paddingTop: Math.max(50, insets.top + 6), paddingHorizontal: 16, paddingBottom: tabPad, gap: 14 }}>
      <View style={styles.head}>
        <Text style={[styles.h1,{flex:1}]} accessibilityRole="header">Чаты</Text>
        <Pressable onPress={() => {setGroupTitle('');setMembers([]);setGroup(true);setError('');}} style={[styles.round,{marginRight:8}]} accessibilityRole="button" accessibilityLabel="Создать группу"><Ic d="M8 7a3 3 0 106 0 3 3 0 00-6 0M3 20v-2a6 6 0 0112 0M19 10v8M15 14h8" size={21} color={colors.ink}/></Pressable>
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
          {([['all', 'Все'], ['events', 'События'], ['direct', 'Личные'], ['archive','Архив']] as [Filter, string][]).map(([k, label]) => {
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
        <View style={{ gap: 8 }}>
          {list.map((c) => {
            const e = c.kind === 'event' ? events.find((x) => x.id === c.eventId) : undefined;
            const p = c.kind === 'direct' ? people.find((x) => x.id === c.personId) : undefined;
            const n = unread(c);
            const pin = !!chat.pinned[c.id];
            const act = !c.l.text && p ? friendActivity(p.id, myId(), events, goingSet, invites, clockNow()) : null;
            return (
              <SwipeRow key={c.id} actions={chatActions(c)} background={colors.card} radius={20}>
                <Pressable onPress={() => open(c.id)}
                  style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
                  accessibilityRole="button" accessibilityLabel={`${c.title}. ${c.l.mine ? 'Ты: ' : ''}${c.l.text}${act ? `. ${act}` : ''}${pin ? '. Закреплён' : ''}`}>
                  {p ? <Avatar p={p} size={54} ring={p.isFriend ? colors.friend : undefined} /> : (
                    <View style={[styles.evIcon, { backgroundColor: e ? CAT_COLOR[e.category] : colors.ink }]}>
                      <Ic d={e ? CAT_ICON[e.category] : 'M4 5h16v11H9l-5 4z'} size={23} color={e ? catFg(e.category) : colors.paper} w={2} />
                    </View>
                  )}
                  <View style={{ flex: 1, gap: 3 }}>
                    <View style={styles.titleRow}>
                      <Text style={[styles.name, { flex: 1 }]} numberOfLines={1}>{c.title}</Text>
                      <Text style={styles.time}>{c.l.time}</Text>
                    </View>
                    <View style={styles.titleRow}>
                      <Text style={[styles.sub, { flex: 1 }, n > 0 && { color: colors.ink, fontFamily: fonts.body600 }]} numberOfLines={1}>
                        {c.l.text ? `${c.l.mine ? 'Ты: ' : ''}${c.l.text}` : 'Напиши первым'}
                      </Text>
                      {n > 0 ? <View style={styles.unread}><Text style={styles.unreadText}>{n}</Text></View>
                        : pin ? <Pin size={14} color={colors.muted} strokeWidth={2} /> : null}
                    </View>
                    {act && (
                      <View style={styles.act}>
                        <CalendarCheck size={13} color={colors.accentText} strokeWidth={2} />
                        <Text style={styles.actText} numberOfLines={1}>{act}</Text>
                      </View>
                    )}
                  </View>
                </Pressable>
              </SwipeRow>
            );
          })}
        </View>
      )}
      {filter === 'all' && !q && lonely.length > 0 && (
        <View style={{ gap: 8 }}>
          <Text style={styles.cap}>ДРУЗЬЯ · НАПИШИ ПЕРВЫМ</Text>
          {lonely.map((p) => {
            const act = friendActivity(p.id, myId(), events, goingSet, invites, clockNow());
            return (
              <Pressable key={p.id} onPress={() => open(`dm-${p.id}`)} style={({ pressed }) => [styles.row, styles.card, pressed && { opacity: 0.7 }]} accessibilityRole="button" accessibilityLabel={`Написать: ${p.name}`}>
                <Avatar p={p} size={54} ring={colors.friend} />
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={styles.name} numberOfLines={1}>{p.name}</Text>
                  <Text style={styles.sub} numberOfLines={1}>{act ?? 'Пока без переписки'}</Text>
                </View>
                <Text style={styles.write}>Написать</Text>
              </Pressable>
            );
          })}
        </View>
      )}
      {list.length === 0 && lonely.length === 0 && filter !== 'requests' && <Text style={styles.sub}>{q ? 'Ничего не нашли.' : 'Пока нет чатов.'}</Text>}
    </ScrollView>
    {group && <><Backdrop label="Закрыть" onPress={() => setGroup(false)}/><BottomSheet onClose={() => setGroup(false)} label="Новая группа" scroll style={{paddingBottom:24+insets.bottom}}>
      <Text style={styles.h1}>Новая группа</Text>
      <TextInput value={groupTitle} onChangeText={setGroupTitle} placeholder="Название" accessibilityLabel="Название группы" style={styles.search} maxLength={60}/>
      <Text style={styles.sub}>Выбери хотя бы одного друга</Text>
      <View style={{gap:4}}>{friends.map(p => <Pressable key={p.id} style={styles.row} onPress={() => setMembers(s => s.includes(p.id)?s.filter(x=>x!==p.id):[...s,p.id])} accessibilityRole="checkbox" accessibilityState={{checked:members.includes(p.id)}}>
        <Avatar p={p}/><Text style={[styles.name,{flex:1}]}>{p.name}</Text>{members.includes(p.id)&&<Ic d={IC.check} size={20} color={colors.accent}/>}
      </Pressable>)}</View>
      {!friends.length&&<Text style={styles.sub}>Добавь друзей, чтобы собрать группу</Text>}
      {!!error&&<Text style={[styles.sub,{color:colors.accentText}]}>{error}</Text>}
      <Pressable accessibilityRole="button" accessibilityLabel={busy ? 'Создаю группу' : 'Создать группу'} onPress={create} disabled={busy||members.length<1||!groupTitle.trim()} style={[styles.btn,{flexGrow:0,flexShrink:0,flexBasis:'auto',height:48,minHeight:48,backgroundColor:colors.ink,opacity:members.length<1?0.45:1}]}><Text style={[styles.btnText,{color:colors.paper}]}>{busy?'Создаю…':'Создать группу'}</Text></Pressable>
    </BottomSheet></>}
    </View>
  );
}

const styles = StyleSheet.create({
  menuAction: {paddingVertical:16,borderBottomWidth:1,borderBottomColor:colors.line},
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
  row: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 13, paddingHorizontal: 14 },
  card: { borderRadius: 20, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  act: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', maxWidth: '100%', paddingHorizontal: 8, height: 22, borderRadius: 11, backgroundColor: '#F0C5AE' },
  actText: { flexShrink: 1, fontFamily: fonts.body600, fontSize: 11.5, color: colors.accentText },
  write: { fontFamily: fonts.body700, fontSize: 13, color: colors.friend },
  evIcon: { width: 48, height: 48, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  time: { fontFamily: fonts.mono500, fontSize: 11, color: colors.muted },
  unread: { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  unreadText: { fontFamily: fonts.mono600, fontSize: 10.5, color: colors.paper },
});
