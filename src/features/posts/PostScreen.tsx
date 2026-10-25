// Пост (26 октября, как в Instagram): автор сверху, фото листаются вбок (двойное касание — лайк с сердцем),
// «нравится», комментарии, подпись, прикреплённое событие карточкой, с кем был, комментарии и поле ввода внизу.
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, ChevronRight, Heart, MessageCircle, MoreHorizontal, Send, Share2, Trash2 } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { data } from '../../data';
import { photo as photoSrc } from '../../data/photos';
import type { Person } from '../../data/types';
import { APP_URL, config } from '../../lib/config';
import { getProfile } from '../../live/api';
import { myId } from '../../live/auth';
import { addComment, deleteComment, deletePost, getComments, getPost, toggleLike } from '../../live/posts';
import { useBackClose } from '../../state/app';
import { useSession } from '../../state/session';
import { colors, fonts } from '../../theme';
import { Avatar } from '../../ui/Avatar';
import { EventIcon } from '../../ui/EventIcon';
import { StateView } from '../../ui/StateView';
import { Backdrop, BottomSheet } from '../../ui/sheet';

const LIVE = config.dataMode !== 'demo';
const MON = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
export function ago(iso: string): string {
  const d = (Date.now() - new Date(iso).getTime()) / 1000;
  if (d < 60) return 'только что';
  if (d < 3600) return `${Math.floor(d / 60)} мин назад`;
  if (d < 86400) return `${Math.floor(d / 3600)} ч назад`;
  if (d < 7 * 86400) return `${Math.floor(d / 86400)} дн назад`;
  const t = new Date(iso);
  return `${t.getDate()} ${MON[t.getMonth()]}`;
}

/** Кто это: я, друг из списка или профиль из базы. */
export function usePerson(id: string | undefined): Pick<Person, 'id' | 'name' | 'photo' | 'initial' | 'tint'> | null {
  const draft = useSession((s) => s.draft);
  const { data: people = [] } = useQuery({ queryKey: ['people'], queryFn: () => data.getPeople() });
  const isMe = !!id && (id === 'me' || id === myId());
  const known = people.find((p) => p.id === id);
  const prof = useQuery({ queryKey: ['profile', id], queryFn: () => getProfile(id!), enabled: LIVE && !!id && !isMe && !known });
  if (!id) return null;
  if (isMe) return { id, name: draft.name || 'Ты', photo: draft.photo, initial: (draft.name?.[0] ?? 'Я').toUpperCase(), tint: '#DDE8D9' };
  if (known) return known;
  if (prof.data) return { id, name: prof.data.name, photo: prof.data.photo_url, initial: prof.data.name[0]?.toUpperCase() ?? '·', tint: '#D5CFC1' };
  return null;
}

function CommentRow({ c, canDelete, onDelete }: { c: { id: string; author: string; author_name?: string; author_photo?: string | null; body: string; created_at: string }; canDelete: boolean; onDelete: () => void }) {
  const p = usePerson(c.author);
  const name = p?.name ?? c.author_name ?? 'Кто-то';
  return (
    <View style={styles.comment}>
      <Pressable onPress={() => c.author !== 'me' && router.push({ pathname: '/person/[id]', params: { id: c.author } })} accessibilityRole="button" accessibilityLabel={name}>
        <Avatar p={p ?? { photo: c.author_photo ?? null, initial: name[0] ?? '·', tint: '#D5CFC1' }} size={34} />
      </Pressable>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.commentText}><Text style={styles.bold}>{name} </Text>{c.body}</Text>
        <Text style={styles.time}>{ago(c.created_at)}</Text>
      </View>
      {canDelete && <Pressable onPress={onDelete} hitSlop={8} accessibilityRole="button" accessibilityLabel="Удалить комментарий"><Trash2 size={15} color={colors.muted3} strokeWidth={2} /></Pressable>}
    </View>
  );
}

export default function PostScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const qc = useQueryClient();
  const postQ = useQuery({ queryKey: ['post', id], queryFn: () => getPost(id) });
  const comQ = useQuery({ queryKey: ['post', id, 'comments'], queryFn: () => getComments(id) });
  const post = postQ.data;
  const owner = usePerson(post?.owner);
  const me = LIVE ? myId() : 'me';
  const mine = !!post && post.owner === me;
  const [page, setPage] = useState(0);
  const [text, setText] = useState('');
  const [menu, setMenu] = useState(false);
  const input = useRef<TextInput>(null);
  const heart = useSharedValue(0);
  const heartSt = useAnimatedStyle(() => ({ opacity: heart.get(), transform: [{ scale: 0.6 + heart.get() * 0.6 }] }));
  const lastTap = useRef(0);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/me'));
  useBackClose(back);
  const refresh = () => { void qc.invalidateQueries({ queryKey: ['post', id] }); void qc.invalidateQueries({ queryKey: ['posts'] }); };

  if (!post) return (
    <View style={[styles.root, { justifyContent: 'center' }]}>
      <StateView kind={postQ.isPending ? 'loading' : 'empty'} title={postQ.isPending ? 'Открываю…' : 'Пост недоступен'} text={postQ.isPending ? undefined : 'Его удалили или автор закрыл воспоминания.'} action={postQ.isPending ? undefined : 'Назад'} onAction={back} />
    </View>
  );

  const like = (on = !post.liked) => {
    qc.setQueryData(['post', id], { ...post, liked: on, likes: Math.max(0, post.likes + (on === post.liked ? 0 : on ? 1 : -1)) });
    void toggleLike(id, on).catch(() => undefined).finally(refresh);
  };
  const tap = () => {
    const now = Date.now();
    if (now - lastTap.current < 280) { if (!post.liked) like(true); heart.set(withSequence(withSpring(1, { damping: 9 }), withTiming(1, { duration: 300 }), withTiming(0, { duration: 250 }))); }
    lastTap.current = now;
  };
  const send = async () => {
    const t = text.trim();
    if (!t) return;
    setText('');
    await addComment(id, t).catch(() => setText(t));
    void qc.invalidateQueries({ queryKey: ['post', id] });
  };
  const ph = width;
  const when = post.event ? new Date(post.event.starts_at) : null;

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.bar, { paddingTop: insets.top + 6 }]}>
        <Pressable onPress={back} style={styles.round} accessibilityRole="button" accessibilityLabel="Назад" hitSlop={4}><ChevronLeft size={24} color={colors.ink} strokeWidth={2.2} /></Pressable>
        <Pressable onPress={() => !mine && router.push({ pathname: '/person/[id]', params: { id: post.owner } })} style={styles.author} accessibilityRole="button">
          {owner && <Avatar p={owner} size={36} />}
          <View style={{ flex: 1 }}>
            <Text style={styles.authorName} numberOfLines={1}>{owner?.name ?? ''}</Text>
            <Text style={styles.time}>{ago(post.created_at)}</Text>
          </View>
        </Pressable>
        <Pressable onPress={() => setMenu(true)} style={styles.round} accessibilityRole="button" accessibilityLabel="Ещё"><MoreHorizontal size={22} color={colors.ink} strokeWidth={2.2} /></Pressable>
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 20 }}>
        <View>
          <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}>
            {post.photos.map((p) => (
              <Pressable key={p.id} onPress={tap} accessibilityRole="image" accessibilityLabel="Фото, двойное касание — нравится">
                <Image source={photoSrc(p.url)} style={{ width, height: ph * 1.15 }} contentFit="cover" cachePolicy="memory-disk" />
              </Pressable>
            ))}
          </ScrollView>
          <Animated.View style={[styles.bigHeart, heartSt]} pointerEvents="none"><Heart size={96} color="#FFFFFF" fill="#FFFFFF" strokeWidth={1.5} /></Animated.View>
          {post.photos.length > 1 && <View style={styles.count}><Text style={styles.countText}>{page + 1}/{post.photos.length}</Text></View>}
        </View>

        <View style={styles.body}>
          <View style={styles.actions}>
            <Pressable onPress={() => like()} style={styles.act} accessibilityRole="button" accessibilityLabel={post.liked ? 'Убрать «нравится»' : 'Нравится'} accessibilityState={{ selected: post.liked }}>
              <Heart size={26} color={post.liked ? '#E8344E' : colors.ink} fill={post.liked ? '#E8344E' : 'none'} strokeWidth={2} />
            </Pressable>
            <Pressable onPress={() => input.current?.focus()} style={styles.act} accessibilityRole="button" accessibilityLabel="Комментировать"><MessageCircle size={25} color={colors.ink} strokeWidth={2} /></Pressable>
            <Pressable onPress={() => Share.share({ message: `${owner?.name ?? ''} в рядом.: ${APP_URL}/post/${post.id}` }).catch(() => undefined)} style={styles.act} accessibilityRole="button" accessibilityLabel="Поделиться"><Share2 size={23} color={colors.ink} strokeWidth={2} /></Pressable>
            <View style={{ flex: 1 }} />
            {post.photos.length > 1 && <View style={styles.dots}>{post.photos.map((_, k) => <View key={k} style={[styles.dot, k === page && styles.dotOn]} />)}</View>}
          </View>
          {post.likes > 0 && <Text style={styles.likes}>Нравится: {post.likes}</Text>}
          {!!post.caption && <Text style={styles.caption}><Text style={styles.bold}>{owner?.name ?? ''} </Text>{post.caption}</Text>}

          {post.event && (
            <Pressable onPress={() => router.push({ pathname: '/event/[id]', params: { id: post.event!.id } })} style={({ pressed }) => [styles.event, pressed && { opacity: 0.8 }]} accessibilityRole="button" accessibilityLabel={`Событие: ${post.event.title}`}>
              <EventIcon e={{ category: post.event.category as never, title: post.event.title, venueName: post.event.venue_name }} size={44} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.eventTitle} numberOfLines={2}>{post.event.title}</Text>
                <Text style={styles.time} numberOfLines={1}>{when ? `${when.getDate()} ${MON[when.getMonth()]}` : ''}{post.event.venue_name ? ` · ${post.event.venue_name}` : ''}</Text>
              </View>
              <ChevronRight size={18} color={colors.muted} strokeWidth={2} />
            </Pressable>
          )}

          {post.tags.length > 0 && <Tagged ids={post.tags} />}

          <View style={{ gap: 12, marginTop: 6 }}>
            {(comQ.data ?? []).length > 0 && <Text style={styles.cap}>Комментарии · {(comQ.data ?? []).length}</Text>}
            {(comQ.data ?? []).map((c) => (
              <CommentRow key={c.id} c={c} canDelete={mine || c.author === me} onDelete={() => { void deleteComment(id, c.id).finally(() => void qc.invalidateQueries({ queryKey: ['post', id] })); }} />
            ))}
          </View>
        </View>
      </ScrollView>

      <View style={[styles.inputBar, { paddingBottom: insets.bottom + 8 }]}>
        <TextInput ref={input} value={text} onChangeText={setText} placeholder="Добавить комментарий…" placeholderTextColor={colors.muted3} style={styles.input} maxLength={500}
          onSubmitEditing={() => void send()} returnKeyType="send" accessibilityLabel="Комментарий" />
        <Pressable onPress={() => void send()} disabled={!text.trim()} style={[styles.send, !text.trim() && { opacity: 0.35 }]} accessibilityRole="button" accessibilityLabel="Отправить"><Send size={18} color="#FFFFFF" strokeWidth={2.2} /></Pressable>
      </View>

      {menu && (
        <>
          <Backdrop onPress={() => setMenu(false)} label="Закрыть" />
          <BottomSheet onClose={() => setMenu(false)} label="Ещё" style={{ paddingBottom: 30 + insets.bottom }}>
            <View style={styles.menu}>
              <Pressable onPress={() => { setMenu(false); Share.share({ message: `${APP_URL}/post/${post.id}` }).catch(() => undefined); }} style={styles.menuRow} accessibilityRole="button"><Share2 size={19} color={colors.ink} strokeWidth={2} /><Text style={styles.menuText}>Поделиться</Text></Pressable>
              {mine && <Pressable onPress={() => { setMenu(false); void deletePost(post.id).then(() => { refresh(); back(); }); }} style={[styles.menuRow, styles.menuLine]} accessibilityRole="button"><Trash2 size={19} color={colors.accentText} strokeWidth={2} /><Text style={[styles.menuText, { color: colors.accentText }]}>Удалить пост</Text></Pressable>}
            </View>
          </BottomSheet>
        </>
      )}
    </KeyboardAvoidingView>
  );
}

function Tagged({ ids }: { ids: string[] }) {
  return (
    <View style={styles.tagged}>
      <Text style={styles.time}>С кем:</Text>
      {ids.map((t) => <TagChip key={t} id={t} />)}
    </View>
  );
}
function TagChip({ id }: { id: string }) {
  const p = usePerson(id);
  if (!p) return null;
  return (
    <Pressable onPress={() => id !== 'me' && id !== myId() && router.push({ pathname: '/person/[id]', params: { id } })} style={styles.tag} accessibilityRole="button" accessibilityLabel={p.name}>
      <Avatar p={p} size={22} /><Text style={styles.tagText}>{id === 'me' || id === myId() ? 'ты' : p.name}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingBottom: 8 },
  round: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  author: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 },
  authorName: { fontFamily: fonts.body700, fontSize: 15.5, color: colors.ink },
  time: { fontFamily: fonts.body500, fontSize: 12.5, color: colors.muted },
  bigHeart: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  count: { position: 'absolute', top: 12, right: 12, paddingHorizontal: 10, height: 26, borderRadius: 13, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center' },
  countText: { fontFamily: fonts.body700, fontSize: 12.5, color: '#FFFFFF' },
  body: { paddingHorizontal: 16, gap: 8 },
  actions: { flexDirection: 'row', alignItems: 'center', marginLeft: -10, marginTop: 4 },
  act: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  dots: { flexDirection: 'row', gap: 4 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.line2 },
  dotOn: { backgroundColor: colors.accent },
  likes: { fontFamily: fonts.body700, fontSize: 14.5, color: colors.ink },
  caption: { fontFamily: fonts.body400, fontSize: 15, lineHeight: 21, color: colors.ink },
  bold: { fontFamily: fonts.body700 },
  event: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 20, backgroundColor: '#FBFAF6', marginTop: 4 },
  eventTitle: { fontFamily: fonts.body700, fontSize: 15, color: colors.ink },
  tagged: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 32, paddingLeft: 4, paddingRight: 10, borderRadius: 16, backgroundColor: '#FBFAF6' },
  tagText: { fontFamily: fonts.body600, fontSize: 13.5, color: colors.ink },
  cap: { fontFamily: fonts.body600, fontSize: 13.5, color: colors.muted },
  comment: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  commentText: { fontFamily: fonts.body400, fontSize: 14.5, lineHeight: 20, color: colors.ink },
  inputBar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line2, backgroundColor: colors.paper },
  input: { flex: 1, minHeight: 44, paddingHorizontal: 16, borderRadius: 22, backgroundColor: '#FBFAF6', fontFamily: fonts.body500, fontSize: 15, color: colors.ink },
  send: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  menu: { borderRadius: 18, backgroundColor: colors.card },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 54, paddingHorizontal: 16 },
  menuLine: { borderTopWidth: 1, borderTopColor: colors.sand },
  menuText: { fontFamily: fonts.body600, fontSize: 15, color: colors.ink },
});
