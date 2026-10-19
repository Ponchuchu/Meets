import { useInfiniteQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Image, Linking, Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Link, X } from 'lucide-react-native';
import { registerPlayback, usePlayback } from '../playback';
import { isRemoteId } from '../../data/realtime';
import { getMessages } from '../../data/remote';
import { photo } from '../../data/photos';
import type { Message } from '../../data/types';
import { useChat } from '../../state/chat';
import { colors, fonts } from '../../theme';
import { Backdrop, BottomSheet } from '../../ui/sheet';
import { Bubble } from './Bubble';
import { VideoPreview } from './VideoPreview';

type Tab = 'media' | 'voice' | 'links';
const tabs = [{ id: 'media', label: 'Медиа' }, { id: 'voice', label: 'Голосовые' }, { id: 'links', label: 'Ссылки' }] as const;
function Video({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, p => p.play());
  useEffect(() => { const id = `video:${uri}`; usePlayback.getState().play(id, true); const unregister = registerPlayback(id, () => player.pause()); return () => { unregister(); if (usePlayback.getState().active === id) usePlayback.getState().play(null); }; }, [uri, player]);
  return <VideoView player={player} style={{ width: '100%', height: '75%' }} surfaceType="textureView" contentFit="contain" nativeControls />;
}

export function AttachmentsSheet({ chatId, messages, title, friend, onClose }: { chatId: string; messages: Message[]; title: string; friend: boolean; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('media');
  const [open, setOpen] = useState<Message | null>(null);
  const { height } = useWindowDimensions();
  const revealed = useChat(s => s.revealed);
  const query = useInfiniteQuery({
    queryKey: ['attachments', chatId, tab], enabled: isRemoteId(chatId), initialPageParam: undefined as { at: string; id: string } | undefined,
    queryFn: ({ pageParam }) => getMessages(chatId, pageParam, tab),
    getNextPageParam: page => page.length === 100 && page[0].createdAt ? { at: page[0].createdAt, id: page[0].id } : undefined,
  });
  const items = useMemo(() => {
    const source = isRemoteId(chatId) ? query.data?.pages.flat() ?? [] : messages;
    return source.filter(m => tab === 'media' ? ['photo', 'video', 'circle'].includes(m.kind) : tab === 'voice' ? m.kind === 'voice' : /https?:\/\//.test(m.text)).sort((a, b) => (b.createdAt ?? b.time).localeCompare(a.createdAt ?? a.time));
  }, [query.data, messages, chatId, tab]);
  const reveal = (m: Message) => !friend && m.authorId !== 'me' && !revealed[m.id];
  const select = (m: Message) => { if (usePlayback.getState().recording) return; if (reveal(m)) useChat.getState().reveal(m.id); else setOpen(m); };
  return <>
    <Backdrop label="Закрыть вложения" onPress={onClose} />
    <BottomSheet label="Вложения" onClose={onClose} style={{ height: Math.min(height * 0.82, 720), paddingHorizontal: 12 }}>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.tabs}>{tabs.map(t => <Pressable key={t.id} onPress={() => setTab(t.id)} style={[styles.tab, tab === t.id && styles.on]} accessibilityRole="tab" accessibilityState={{ selected: tab === t.id }}><Text style={[styles.label, tab === t.id && { color: colors.paper }]}>{t.label}</Text></Pressable>)}</View>
      <FlatList key={tab} data={items} keyExtractor={m => m.id} numColumns={tab === 'media' ? 3 : 1} style={{ flex: 1 }} initialNumToRender={12} windowSize={5} maxToRenderPerBatch={9}
        onEndReached={() => { if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage(); }} onEndReachedThreshold={0.3}
        ListEmptyComponent={<Text style={styles.empty}>{query.isPending && isRemoteId(chatId) ? 'Загружаю…' : query.isError ? 'Не удалось загрузить. Проверь связь' : 'В этом разделе пока пусто'}</Text>}
        renderItem={({ item: m }) => tab === 'media' ? <Pressable onPress={() => select(m)} style={styles.tile} accessibilityLabel={reveal(m) ? 'Показать вложение' : m.kind === 'photo' ? 'Открыть фото' : 'Открыть видео'}>
          {reveal(m) ? <View style={styles.hidden}><Text style={{ color: colors.paper }}>Показать</Text></View> : m.kind === 'photo' ? <Image source={photo(m.media)} style={StyleSheet.absoluteFill} resizeMode="cover" /> : m.media && /^(https?:|file:|content:|blob:)/.test(m.media) ? <VideoPreview uri={m.media} id={m.id} /> : <Image source={photo(m.media)} style={StyleSheet.absoluteFill} resizeMode="cover" />}
          {m.kind !== 'photo' && <Text style={styles.duration}>{m.duration || 'Видео'}</Text>}
        </Pressable> : tab === 'voice' ? <View style={{ flex: 1, paddingVertical: 5 }}><Bubble m={m} mine={false} friendChat={friend} revealed={!!revealed[m.id]} onReveal={() => useChat.getState().reveal(m.id)} /></View> : <Pressable onPress={() => { const url = /https?:\/\/[^\s]+/.exec(m.text)?.[0]; if (url) void Linking.openURL(url).catch(() => undefined); }} style={styles.link}><Link size={20} color={colors.friend} /><View style={{ flex: 1 }}><Text style={styles.label} numberOfLines={3}>{m.text}</Text><Text style={styles.date}>{m.time}</Text></View></Pressable>} />
    </BottomSheet>
    <Modal visible={!!open} transparent animationType="fade" onRequestClose={() => setOpen(null)}>
      <View style={styles.viewer}>
        <Pressable onPress={() => setOpen(null)} style={styles.close} accessibilityLabel="Закрыть просмотр"><X size={26} color={colors.paper} /></Pressable>
        {open?.kind === 'photo' ? <Image source={photo(open.media)} style={{ width: '100%', height: '80%' }} resizeMode="contain" /> : open?.media && <Video uri={open.media} />}
      </View>
    </Modal>
  </>;
}
const styles = StyleSheet.create({
  title: { fontFamily: fonts.display700, fontSize: 22, color: colors.ink }, tabs: { flexDirection: 'row', gap: 5 },
  tab: { flex: 1, minHeight: 44, borderRadius: 14, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' }, on: { backgroundColor: colors.ink },
  label: { fontFamily: fonts.body600, fontSize: 13, color: colors.ink }, empty: { fontFamily: fonts.body400, color: colors.muted2, textAlign: 'center', padding: 30 },
  tile: { flex: 1 / 3, aspectRatio: 1, margin: 2, borderRadius: 8, overflow: 'hidden', backgroundColor: colors.card }, hidden: { flex: 1, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  duration: { position: 'absolute', bottom: 5, right: 5, paddingHorizontal: 5, borderRadius: 5, backgroundColor: 'rgba(23,22,26,0.65)', fontFamily: fonts.mono500, fontSize: 10, color: colors.paper },
  link: { padding: 12, flexDirection: 'row', gap: 12, borderBottomWidth: 1, borderBottomColor: colors.line }, date: { fontFamily: fonts.body400, fontSize: 11, color: colors.muted2, marginTop: 5 },
  viewer: { flex: 1, backgroundColor: '#17161A', justifyContent: 'center' }, close: { position: 'absolute', top: 50, right: 16, width: 44, height: 44, zIndex: 2, alignItems: 'center', justifyContent: 'center' },
});
