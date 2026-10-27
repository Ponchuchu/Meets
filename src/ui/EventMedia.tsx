import { useFocusEffect } from 'expo-router';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Volume2, VolumeX } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { photo } from '../data/photos';
import type { EventItem } from '../data/types';
import { colors, fonts } from '../theme';

export type Media = NonNullable<EventItem['media']>[number];
export function eventMedia(e: Pick<EventItem, 'media' | 'cover'>): Media[] {
  const seen = new Set<string>();
  const items = e.media?.length ? e.media : e.cover ? [{ type: 'image' as const, url: e.cover }] : [];
  return items.filter(m => !!m.url && !seen.has(m.url) && !!seen.add(m.url));
}

function MediaImage({ item }: { item: Media }) {
  const [broken, setBroken] = useState(false);
  return broken ? <View style={[styles.fill, { alignItems: 'center', justifyContent: 'center' }]}><Text style={styles.counterText}>Фото недоступно</Text></View>
    : <Image source={photo(item.type === 'video' ? item.poster : item.url)} style={styles.fill} contentFit="contain" cachePolicy="memory-disk" recyclingKey={item.url} onError={() => setBroken(true)} />;
}

function Clip({ item, active, controls, controlsTop }: { item: Media; active: boolean; controls: boolean; controlsTop: number }) {
  const [muted, setMuted] = useState(true);
  const [failed, setFailed] = useState(false);
  const player = useVideoPlayer({ uri: item.url, useCaching: true }, p => { p.loop = true; p.muted = true; });
  const pause = useCallback(() => {
    // useVideoPlayer can release its shared object before navigation's unmount cleanup.
    try { player.pause(); } catch { /* An already released player has no playback to stop. */ }
  }, [player]);
  useEffect(() => {
    // expo-video exposes mutable native player properties.
    // eslint-disable-next-line react-hooks/immutability
    player.muted = muted;
  }, [muted, player]);
  useFocusEffect(useCallback(() => {
    if (active && !failed && AppState.currentState === 'active') player.play(); else pause();
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active' && active && !failed) player.play(); else pause();
    });
    return () => {
      subscription.remove();
      // A frozen tab may postpone React state updates. Stop native playback immediately.
      pause();
    };
  }, [active, failed, pause, player]));
  useEffect(() => {
    const sub = player.addListener('statusChange', s => { if (s.status === 'error') setFailed(true); });
    return () => sub.remove();
  }, [player]);
  return <View style={styles.fill}>
    {item.poster && <Image source={{ uri: item.poster }} style={styles.fill} contentFit="contain" cachePolicy="memory-disk" />}
    {!failed && <VideoView player={player} style={styles.fill} contentFit="contain" nativeControls={false} surfaceType="textureView" />}
    {failed && <Text style={styles.error}>Видео не загрузилось</Text>}
    {controls && !failed && <Pressable onPress={() => setMuted(v => !v)} style={[styles.sound, { top: controlsTop }]} accessibilityRole="button" accessibilityLabel={muted ? 'Включить звук' : 'Выключить звук'}>
      {muted ? <VolumeX size={20} color="white" /> : <Volume2 size={20} color="white" />}
    </Pressable>}
  </View>;
}

/** Only the visible item owns a decoder. Pause on navigation, background and opening a sheet. */
export function EventMedia({ items, active = true, gallery = false, height, controlsTop = 72, children }: {
  items: Media[]; active?: boolean; gallery?: boolean; height: number; controlsTop?: number; children?: React.ReactNode;
}) {
  const [focused, setFocused] = useState(false);
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const [page, setPage] = useState(0);
  const [width, setWidth] = useState(0);
  const galleryRef = useRef<FlatList<Media>>(null);
  useFocusEffect(useCallback(() => { setFocused(true); return () => setFocused(false); }, []));
  useEffect(() => { const s = AppState.addEventListener('change', state => setForeground(state === 'active')); return () => s.remove(); }, []);
  const list = useMemo(() => gallery ? items : [items.find(m => m.type === 'video') ?? items[0]].filter((m): m is Media => !!m), [gallery, items]);
  const playing = active && focused && foreground;
  const visiblePage = Math.min(page, Math.max(0, list.length - 1));
  useEffect(() => {
    if (page === visiblePage) return;
    // A refreshed gallery can contain fewer items than the old selected page.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(visiblePage);
    galleryRef.current?.scrollToOffset({ offset: visiblePage * width, animated: false });
  }, [page, visiblePage, width]);
  const media = (item: Media, index: number) => item.type === 'video' && playing && index === visiblePage
    ? <Clip key={item.url} item={item} active controls={gallery} controlsTop={controlsTop} />
    : <MediaImage key={item.url} item={item} />;
  return <View onLayout={e => setWidth(e.nativeEvent.layout.width)} style={{ height, overflow: 'hidden', backgroundColor: colors.ink }}>
    {list.length === 1 ? media(list[0], 0) : width > 0 && list.length > 1 && <FlatList ref={galleryRef} data={list} horizontal pagingEnabled showsHorizontalScrollIndicator={false}
      keyExtractor={m => m.url} initialNumToRender={1} maxToRenderPerBatch={1} windowSize={3}
      getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
      onMomentumScrollEnd={e => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
      renderItem={({ item, index }) => <View style={{ width, height }}>{media(item, index)}</View>} />}
    {gallery && list.length > 1 && <View pointerEvents="none" style={styles.counter}><Text style={styles.counterText}>{visiblePage + 1} / {list.length}</Text></View>}
    {children}
  </View>;
}
const styles = StyleSheet.create({
  fill: { ...StyleSheet.absoluteFill },
  sound: { position: 'absolute', right: 16, width: 44, height: 44, borderRadius: 22, backgroundColor: '#17161A99', alignItems: 'center', justifyContent: 'center' },
  counter: { position: 'absolute', bottom: 40, right: 16, borderRadius: 12, padding: 7, backgroundColor: '#17161A99' },
  counterText: { fontFamily: fonts.body600, color: '#FFFFFF', fontSize: 12 },
  error: { position: 'absolute', bottom: 20, alignSelf: 'center', color: '#FFFFFF', fontFamily: fonts.body500 },
});
