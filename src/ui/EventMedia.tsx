import { useFocusEffect } from 'expo-router';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Volume2, VolumeX } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
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

function Clip({ item, active, controls }: { item: Media; active: boolean; controls: boolean }) {
  const [muted, setMuted] = useState(true);
  const [failed, setFailed] = useState(false);
  const player = useVideoPlayer({ uri: item.url, useCaching: true }, p => { p.loop = true; p.muted = true; });
  useEffect(() => {
    // expo-video exposes mutable native player properties.
    // eslint-disable-next-line react-hooks/immutability
    player.muted = muted;
    if (active && !failed) player.play(); else player.pause();
  }, [active, failed, muted, player]);
  useEffect(() => {
    const sub = player.addListener('statusChange', s => { if (s.status === 'error') setFailed(true); });
    return () => sub.remove();
  }, [player]);
  return <View style={styles.fill}>
    {item.poster && <Image source={{ uri: item.poster }} style={styles.fill} contentFit="contain" cachePolicy="memory-disk" />}
    {!failed && <VideoView player={player} style={styles.fill} contentFit="contain" nativeControls={false} surfaceType="textureView" />}
    {failed && <Text style={styles.error}>Видео не загрузилось</Text>}
    {controls && !failed && <Pressable onPress={() => setMuted(v => !v)} style={styles.sound} accessibilityRole="button" accessibilityLabel={muted ? 'Включить звук' : 'Выключить звук'}>
      {muted ? <VolumeX size={20} color="white" /> : <Volume2 size={20} color="white" />}
    </Pressable>}
  </View>;
}

/** Only the visible item owns a decoder. Pause on navigation, background and opening a sheet. */
export function EventMedia({ items, active = true, gallery = false, height, children }: {
  items: Media[]; active?: boolean; gallery?: boolean; height: number; children?: React.ReactNode;
}) {
  const [focused, setFocused] = useState(false);
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const [page, setPage] = useState(0);
  const [width, setWidth] = useState(0);
  useFocusEffect(useCallback(() => { setFocused(true); return () => setFocused(false); }, []));
  useEffect(() => { const s = AppState.addEventListener('change', state => setForeground(state === 'active')); return () => s.remove(); }, []);
  const list = useMemo(() => gallery ? items : [items.find(m => m.type === 'video') ?? items[0]].filter((m): m is Media => !!m), [gallery, items]);
  const playing = active && focused && foreground;
  return <View onLayout={e => setWidth(e.nativeEvent.layout.width)} style={{ height, overflow: 'hidden', backgroundColor: colors.ink }}>
    {width > 0 && <FlatList data={list} horizontal pagingEnabled scrollEnabled={gallery && list.length > 1} showsHorizontalScrollIndicator={false}
      keyExtractor={m => m.url} initialNumToRender={1} maxToRenderPerBatch={1} windowSize={3}
      getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
      onMomentumScrollEnd={e => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
      renderItem={({ item, index }) => <View style={{ width, height }}>
        {item.type === 'video' && playing && index === page ? <Clip item={item} active controls={gallery} />
          : <MediaImage key={item.url} item={item} />}
      </View>} />}
    {gallery && list.length > 1 && <View pointerEvents="none" style={styles.counter}><Text style={styles.counterText}>{Math.min(page + 1, list.length)} / {list.length}</Text></View>}
    {children}
  </View>;
}
const styles = StyleSheet.create({
  fill: { ...StyleSheet.absoluteFill },
  sound: { position: 'absolute', right: 16, top: 72, width: 44, height: 44, borderRadius: 22, backgroundColor: '#17161A99', alignItems: 'center', justifyContent: 'center' },
  counter: { position: 'absolute', bottom: 14, right: 16, borderRadius: 12, padding: 7, backgroundColor: '#17161A99' },
  counterText: { fontFamily: fonts.body600, color: '#FFFFFF', fontSize: 12 },
  error: { position: 'absolute', bottom: 20, alignSelf: 'center', color: '#FFFFFF', fontFamily: fonts.body500 },
});
