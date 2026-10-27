// «Чаты»: один список от новых к старым, закреплённые сверху. Без папок (21 окт.): все чаты и серая строка «Архив» сверху.
// Связь — как в Telegram: вместо плашки об ошибке заголовок «Соединение…» / «Обновление…».
// Заявки в чат — не чаты: отдельная строка «Запросы» сверху, как в Instagram, открывает свой список.
import { NONE } from '../../lib/empty';
import { useShallow } from 'zustand/react/shallow';
import { Tick, tickOf } from '../../chat/ui/Tick';
import { useQuery } from '@tanstack/react-query';
import { useNet } from '../../live/net';
import { StateView } from '../../ui/StateView';
import { ActivityBell } from '../activity/ActivityBell';
import { router } from 'expo-router';
import { config } from '../../lib/config';
import { createFriendGroup } from '../../live/api';
import { queryClient } from '../../live/query';
import { uid } from '../../lib/uid';
import { isFriendNow, useSocial } from '../../state/social';
import { SwipeRow, type RowAction } from '../../ui/SwipeRow';
import { Archive, ArchiveRestore, CalendarCheck, Camera, EyeOff, Pin, PinOff, SquarePen, Users } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { friendActivity, previewText } from '../../chat/activity';
import { getInvites, type Invite } from '../../live/api';
import { myId } from '../../live/auth';
import { Backdrop, BottomSheet } from '../../ui/sheet';
import { now as clockNow } from '../../lib/clock';
import { useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
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
import { plate } from '../../ui/glass';

type Filter = 'all' | 'requests' | 'archive';

export default function ChatsScreen() {
  const insets = useSafeAreaInsets();
  const tabPad = useTabInset() + 16;
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState<string | null>(null);
  const chatsQuery = useQuery({ queryKey: ['chats'], queryFn: () => data.getChats() });
  const { data: chats = [] } = chatsQuery;
  const online = useNet((s) => s.online);
  const { data: requests = NONE } = useQuery({ queryKey: ['chatRequests'], queryFn: () => data.getChatRequests() });
  const { data: people = NONE } = useQuery({ queryKey: ['people'], queryFn: () => data.getPeople() });
  const { data: events = NONE } = useQuery({ queryKey: ['events'], queryFn: () => data.getEvents(), placeholderData: eventsSnapshot });
  const { data: invites = NONE } = useQuery<Invite[]>({ queryKey: ['invites'], queryFn: getInvites, enabled: config.dataMode !== 'demo', staleTime: 30e3 });
  // Только нужные части хранилищ — список не перерисовывается от голосов в опросах, раскрытых фото и т. п.
  const chat = useChat(useShallow((s) => ({ addGroup: s.addGroup, answerRequest: s.answerRequest, archive: s.archive, archived: s.archived, blocked: s.blocked,
    groups: s.groups, hidden: s.hidden, hide: s.hide, pinned: s.pinned, read: s.read, requests: s.requests, sent: s.sent, togglePin: s.togglePin })));
  const social = useSocial(useShallow((s) => ({ answered: s.answered, removed: s.removed })));
  const [group, setGroup] = useState(false);
  const [compose, setCompose] = useState(false);
  const [who, setWho] = useState('');
  const startGroup = () => { setCompose(false); setGroupTitle(''); setGroupPhoto(null); setMembers([]); setGroup(true); setError(''); };
  const [groupPhoto, setGroupPhoto] = useState<string | null>(null);
  const pickGroupPhoto = async () => {
    try {
      const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.7 });
      if (!r.canceled && r.assets[0]) setGroupPhoto(r.assets[0].uri);
    } catch { /* галерея недоступна — без фото */ }
  };
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
      const id = config.dataMode === 'demo' ? uid('group') : await createFriendGroup(groupTitle.trim(), members, groupPhoto);
      if(config.dataMode === 'demo') chat.addGroup({id,kind:'group',title:groupTitle.trim(),members:members.length+1,memberIds:members,lastText:'Группа создана',lastTime:'',unread:0,photo:groupPhoto ?? undefined});
      await queryClient.invalidateQueries({queryKey:['chats']});
      setGroup(false); router.push({pathname:'/chat/[id]',params:{id}});
    } catch { setError('Не удалось создать группу. Проверь связь и список друзей'); }
    finally { creating.current = false; setBusy(false); }
  };
  const plans = usePlans(useShallow((s) => ({ go: s.go, going: s.going })));
  const addPlan = useApp((s) => s.addPlan);
  const pending = requests.filter((r) => !chat.requests[r.id]);
  const q = (search ?? '').trim().toLowerCase();
  const match = (c: Chat) => !q || c.title.toLowerCase().includes(q) || c.lastText.toLowerCase().includes(q);
  // Своё неотправленное показываем, только если оно новее того, что уже на сервере: раньше одно застрявшее сообщение
  // навсегда закрывало собой всю переписку в списке.
  const last = (c: Chat) => {
    const mine = chat.sent.filter((m) => m.chatId === c.id && m.delivery).at(-1);
    const newer = mine && (!c.lastAt || !mine.createdAt || Date.parse(mine.createdAt) > Date.parse(c.lastAt));
    return newer ? { text: previewText(mine.kind, mine.text), time: mine.time, mine: true, tick: tickOf(mine) }
      : { text: previewText(c.lastKind, c.lastText), time: c.lastTime, mine: !!c.lastMine, tick: c.lastMine ? tickOf({ createdAt: c.lastAt }, c.readUpTo) : undefined };
  };
  // В настоящей базе непрочитанные считает сервер (после «прочитал» он сам отдаёт 0); локальная поправка — только для демо.
  const unread = (c: Chat) => config.dataMode === 'demo' ? Math.max(0, c.unread - (chat.read[c.id] ?? 0)) : c.unread;
  const list = sortChats(
    [...chats, ...chat.groups.filter(g => !chats.some(c => c.id === g.id))]
      .filter((c) => match(c) && !chat.hidden[c.id] && !(c.personId && chat.blocked[c.personId]) && (filter === 'archive' ? !!chat.archived[c.id] : !chat.archived[c.id]))
      .map((c) => ({ ...c, l: last(c), time: last(c).time })),
    chat.pinned,
  );
  const archivedCount = chats.filter((c) => chat.archived[c.id] && !chat.hidden[c.id]).length;
  // Как в Telegram: нет сети — «Соединение…», сеть вернулась и список обновляется после сбоя — «Обновление…».
  const headTitle = !online ? 'Соединение…' : chatsQuery.isFetching && (chatsQuery.isError || chatsQuery.failureCount > 0) ? 'Обновление…' : 'Чаты';
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
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }} accessibilityLiveRegion="polite">
          {headTitle !== 'Чаты' && <ActivityIndicator size="small" color={colors.muted2} />}
          <Text style={[styles.h1, headTitle !== 'Чаты' && styles.h1Wait]} accessibilityRole="header" numberOfLines={1}>{headTitle}</Text>
        </View>
        {/* Уведомления (FIX5): колокольчик с числом нового — заявки, приглашения, стикеры, входы в аккаунт. */}
        <ActivityBell style={[styles.round, { marginRight: 8 }]} dot={styles.bellBadge} dotText={styles.bellBadgeText} />
        <Pressable onPress={() => setCompose(true)} style={[styles.round,{marginRight:8}]} accessibilityRole="button" accessibilityLabel="Новый чат"><SquarePen size={20} color={colors.ink} strokeWidth={1.9} /></Pressable>
        <Pressable onPress={() => setSearch(search == null ? '' : null)} style={styles.round} accessibilityRole="button" accessibilityLabel="Поиск по чатам">
          <Ic d="M20 20l-3.5-3.5" c={[[11, 11, 7]]} size={20} color={colors.ink} w={1.9} />
        </Pressable>
      </View>
      {search != null && <TextInput value={search} onChangeText={setSearch} autoFocus placeholder="Найти чат или сообщение" placeholderTextColor={colors.muted3} style={styles.search} accessibilityLabel="Поиск по чатам" />}
      {filter !== 'all' ? (
        <Pressable onPress={() => setFilter('all')} style={styles.reqHead} accessibilityRole="button" accessibilityLabel="Назад к чатам">
          <Ic d={IC.back} size={20} color={colors.ink} w={2} />
          <Text style={styles.reqTitle}>{filter === 'archive' ? 'Архив' : 'Запросы'}</Text>
        </Pressable>
      ) : archivedCount > 0 && !q ? (
        <Pressable onPress={() => setFilter('archive')} style={({ pressed }) => [styles.archiveRow, pressed && { opacity: 0.7 }]} accessibilityRole="button" accessibilityLabel={`Архив: ${archivedCount}`}>
          <View style={styles.archiveIcon}><Archive size={20} color="#FFFFFF" strokeWidth={1.9} /></View>
          <Text style={styles.archiveText}>Архив</Text>
          <Text style={styles.archiveCount}>{archivedCount}</Text>
        </Pressable>
      ) : null}

      {filter === 'all' && pending.length > 0 && (
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
      {filter === 'requests' && pending.length === 0 && <StateView kind="empty" compact title="Новых заявок нет" />}
      {/* Список не загрузился — говорим об этом, а не показываем пустоту, будто переписок нет. */}
      {chatsQuery.isError && !chats.length && online && <StateView kind="error" compact text="Чаты не загрузились" onAction={() => void chatsQuery.refetch()} />}

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
                  style={({ pressed }) => [styles.row, n > 0 && styles.rowNew, pressed && { opacity: 0.7 }]}
                  accessibilityRole="button" accessibilityLabel={`${c.title}. ${c.l.mine ? 'Ты: ' : ''}${c.l.text}${act ? `. ${act}` : ''}${pin ? '. Закреплён' : ''}`}>
                  {p ? <Avatar p={p} size={56} /> : c.photo ? <Image source={{ uri: c.photo }} style={styles.groupPhoto} /> : (
                    <View style={[styles.evIcon, { backgroundColor: e ? CAT_COLOR[e.category] : colors.ink }]}>
                      <Ic d={e ? CAT_ICON[e.category] : 'M4 5h16v11H9l-5 4z'} size={23} color={e ? catFg(e.category) : colors.paper} w={2} />
                    </View>
                  )}
                  <View style={{ flex: 1, gap: 3 }}>
                    <View style={styles.titleRow}>
                      <Text style={[styles.name, { flex: 1 }, n > 0 && { fontFamily: fonts.display700 }]} numberOfLines={1}>{c.title}</Text>
                      {c.l.tick && c.l.mine && <Tick kind={c.l.tick} color={colors.muted} size={14} />}
                      <Text style={[styles.time, n > 0 && styles.timeNew]}>{c.l.time}</Text>
                    </View>
                    <View style={styles.titleRow}>
                      <Text style={[styles.sub, { flex: 1 }, n > 0 && { color: colors.ink, fontFamily: fonts.body600 }]} numberOfLines={1}>
                        {c.l.text ? `${c.l.mine ? 'Ты: ' : ''}${c.l.text}` : 'Напиши первым'}
                      </Text>
                      {n > 0 ? <View style={styles.unread}><Text style={styles.unreadText}>{n > 99 ? '99+' : n}</Text></View>
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
      {list.length === 0 && lonely.length === 0 && filter !== 'requests' && (
        q ? <StateView kind="nothing-found" text="Попробуй другое имя или название." />
        : !online && !chatsQuery.data ? <StateView kind="offline" onAction={() => void chatsQuery.refetch()} />
        : chatsQuery.isError ? <StateView kind="error" text="Чаты не загрузились." onAction={() => void chatsQuery.refetch()} />
        : chatsQuery.isPending ? <StateView kind="loading" title="Загружаю чаты…" />
        : <StateView kind="empty" title="Пока нет чатов" text="Нажми «Пойду» на событии — появится чат с теми, кто идёт. Или напиши другу." />
      )}
    </ScrollView>
    {compose && <><Backdrop label="Закрыть" onPress={() => setCompose(false)}/><BottomSheet onClose={() => setCompose(false)} label="Новый чат" scroll style={{paddingBottom:24+insets.bottom}}>
      <Text style={styles.h1}>Новый чат</Text>
      <TextInput value={who} onChangeText={setWho} placeholder="Имя друга" placeholderTextColor={colors.muted3} accessibilityLabel="Найти друга" style={styles.search} />
      <View style={styles.composeRow}>
        <Pressable onPress={() => startGroup()} style={({ pressed }) => [styles.composeBtn, pressed && { opacity: 0.8 }]} accessibilityRole="button">
          <View style={[styles.composeIcon, { backgroundColor: colors.friend }]}><Users size={20} color="#FFFFFF" strokeWidth={2} /></View>
          <Text style={styles.composeText}>Группа</Text>
          <Text style={styles.composeSub}>друзья, название и фото</Text>
        </Pressable>
      </View>
      {(() => {
        const t = who.trim().toLowerCase();
        const f = friends.filter(p => !t || p.name.toLowerCase().includes(t));
        const rec = people.filter(p => !isFriendNow(p, social) && !chat.blocked[p.id] && (!t || p.name.toLowerCase().includes(t))).slice(0, 8);
        return <>
          {f.length > 0 && <Text style={styles.cap}>ДРУЗЬЯ</Text>}
          {f.map(p => (
            <Pressable key={p.id} onPress={() => { setCompose(false); open(`dm-${p.id}`); }} style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]} accessibilityRole="button" accessibilityLabel={`Написать ${p.name}`}>
              <Avatar p={p} size={46} /><Text style={[styles.name, { flex: 1 }]} numberOfLines={1}>{p.name}</Text><Text style={styles.write}>Написать</Text>
            </Pressable>
          ))}
          {rec.length > 0 && <Text style={styles.cap}>МОГУТ БЫТЬ ЗНАКОМЫ</Text>}
          {rec.map(p => (
            <Pressable key={p.id} onPress={() => { setCompose(false); router.push({ pathname: '/person/[id]', params: { id: p.id } }); }} style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]} accessibilityRole="button" accessibilityLabel={`Профиль ${p.name}`}>
              <Avatar p={p} size={46} />
              <View style={{ flex: 1 }}><Text style={styles.name} numberOfLines={1}>{p.name}</Text><Text style={styles.sub} numberOfLines={1}>написать можно запросом</Text></View>
              <Text style={styles.write}>Профиль</Text>
            </Pressable>
          ))}
          {!f.length && !rec.length && <Text style={styles.sub}>{t ? 'Никого не нашлось' : 'Добавь друзей — и пиши им отсюда'}</Text>}
        </>;
      })()}
    </BottomSheet></>}
    {group && <><Backdrop label="Закрыть" onPress={() => setGroup(false)}/><BottomSheet onClose={() => setGroup(false)} label="Новая группа" scroll style={{paddingBottom:24+insets.bottom}}>
      <Text style={styles.h1}>Новая группа</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Pressable onPress={() => void pickGroupPhoto()} style={styles.photoPick} accessibilityRole="button" accessibilityLabel={groupPhoto ? 'Сменить фото группы' : 'Выбрать фото группы'}>
          {groupPhoto ? <Image source={{ uri: groupPhoto }} style={StyleSheet.absoluteFill} /> : <Camera size={24} color={colors.muted2} strokeWidth={1.9} />}
        </Pressable>
        <TextInput value={groupTitle} onChangeText={setGroupTitle} placeholder="Название группы" placeholderTextColor={colors.muted3} accessibilityLabel="Название группы" style={[styles.search, { flex: 1 }]} maxLength={60}/>
      </View>
      <Text style={styles.cap}>{members.length ? `ВЫБРАНО: ${members.length}` : 'КОГО ДОБАВИТЬ'}</Text>
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
  bellBadge: { position: 'absolute', top: -4, right: -4, minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, backgroundColor: colors.accent, borderWidth: 2, borderColor: colors.paper, alignItems: 'center', justifyContent: 'center' },
  bellBadgeText: { fontFamily: fonts.mono600, fontSize: 10.5, color: colors.ink },
  search: { height: 46, paddingHorizontal: 16, borderRadius: 23, borderWidth: 1, borderColor: colors.line2, backgroundColor: colors.card, fontFamily: fonts.body400, fontSize: 15, color: colors.ink },
  filters: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 34, paddingHorizontal: 13, borderRadius: 17, borderWidth: 1, borderColor: colors.line2, backgroundColor: colors.card },
  chipText: { fontFamily: fonts.body500, fontSize: 13.5, color: colors.ink },
  badge: { minWidth: 22, height: 22, borderRadius: 11, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  badgeText: { fontFamily: fonts.mono600, fontSize: 10, color: colors.ink },
  h1Wait: { fontSize: 22, color: colors.muted2 },
  archiveRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 18, backgroundColor: '#E9E4D9' },
  archiveIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#A9A294', alignItems: 'center', justifyContent: 'center' },
  archiveText: { flex: 1, fontFamily: fonts.body600, fontSize: 15, color: colors.muted2 },
  archiveCount: { fontFamily: fonts.mono600, fontSize: 12, color: colors.muted },
  groupPhoto: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.sand },
  photoPick: { width: 64, height: 64, borderRadius: 32, overflow: 'hidden', backgroundColor: colors.sand, alignItems: 'center', justifyContent: 'center' },
  reqHead: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 44 },
  reqTitle: { fontFamily: fonts.display700, fontSize: 20, color: colors.ink },
  reqRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 18, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  cap: { fontFamily: fonts.mono600, fontSize: 10.5, letterSpacing: 0.8, color: colors.muted, marginTop: 4 },
  request: { padding: 14, borderRadius: 20, ...plate, gap: 12 },
  name: { fontFamily: fonts.body700, fontSize: 15, color: colors.ink },
  sub: { fontFamily: fonts.body400, fontSize: 13, color: colors.muted },
  quote: { fontFamily: fonts.body400, fontSize: 14, color: colors.ink, marginTop: 2 },
  btn: { flex: 1, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontFamily: fonts.body600, fontSize: 14, color: colors.ink },
  answerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 18, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card },
  row: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 20 },
  rowNew: { backgroundColor: '#FBEFE6' },
  timeNew: { color: colors.accentText, fontFamily: fonts.mono600 },
  card: { borderRadius: 20, ...plate },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  act: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', maxWidth: '100%', paddingHorizontal: 8, height: 22, borderRadius: 11, backgroundColor: '#F0C5AE' },
  actText: { flexShrink: 1, fontFamily: fonts.body600, fontSize: 11.5, color: colors.accentText },
  write: { fontFamily: fonts.body700, fontSize: 13, color: colors.friend },
  composeRow: { flexDirection: 'row', gap: 8 },
  composeBtn: { flex: 1, padding: 12, borderRadius: 18, ...plate, gap: 4 },
  composeIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  composeText: { fontFamily: fonts.body700, fontSize: 15, color: colors.ink },
  composeSub: { fontFamily: fonts.body400, fontSize: 12, color: colors.muted },
  evIcon: { width: 48, height: 48, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  time: { fontFamily: fonts.mono500, fontSize: 11, color: colors.muted },
  unread: { minWidth: 22, height: 22, borderRadius: 11, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  unreadText: { fontFamily: fonts.body700, fontSize: 12, color: colors.ink },
});
