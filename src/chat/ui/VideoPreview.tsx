import { Image } from 'expo-image';
import { createVideoPlayer, type VideoThumbnail } from 'expo-video';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Play } from 'lucide-react-native';
import { registerPreparation, usePlayback } from '../playback';
import { withTimeout } from '../../data/client';
import { colors } from '../../theme';

const cache = new Map<string, VideoThumbnail>();
let queue: Promise<unknown> = Promise.resolve();

// Миниатюры размером до 240 px, только для видимых строк и по одной; не 12 декодеров сразу.
export function VideoPreview({ uri, id }: { uri: string; id: string }) {
  const [thumb, setThumb] = useState<VideoThumbnail | null>(null);
  const blocked = usePlayback(s => s.recording || s.video || !s.screen);
  useEffect(() => {
    if (Platform.OS === 'web' || blocked) return;
    let alive = true;
    queue = queue.catch(() => undefined).then(async () => {
      if (!alive || usePlayback.getState().recording || usePlayback.getState().video || !usePlayback.getState().screen) return;
      const known = cache.get(id);
      if (known) { setThumb(known); return; }
      const player = createVideoPlayer(uri);
      let released = false;
      const stop = () => { if (!released) { released = true; player.release(); } };
      const unregister = registerPreparation(stop);
      try {
        const [image] = await withTimeout(player.generateThumbnailsAsync(0, { maxWidth: 240, maxHeight: 240 }), 8000);
        if (image) {
          cache.set(id, image);
          if (cache.size > 40) cache.delete(cache.keys().next().value!);
          if (alive) setThumb(image);
        }
      } catch { /* Просмотр остаётся доступен, даже если миниатюру не получили. */ }
      finally { unregister(); stop(); }
    });
    return () => { alive = false; };
  }, [uri, id, blocked]);
  return <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' }]}>
    {thumb && <Image source={thumb} style={StyleSheet.absoluteFill} contentFit="cover" />}
    <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(23,22,26,0.5)', alignItems: 'center', justifyContent: 'center' }}><Play size={22} color={colors.paper} fill={colors.paper} /></View>
  </View>;
}
