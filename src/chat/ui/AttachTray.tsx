// Скрепка (переделано 21 октября, как в Telegram): сразу сетка своих фото и видео из галереи телефона (не Google Фото),
// сверху — камера, вся галерея (системный выбор), событие, опрос, стикеры. Выбранные — с номером, внизу «Отправить · N».
// Галерея читается страницами по 60, превью — системные миниатюры; на web и без разрешения — только кнопки.
import { BarChart3, CalendarDays, Camera, Images, Smile, X } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Image, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { colors, fonts } from '../../theme';

export interface Picked { uri: string; video: boolean; width: number; height: number; duration?: number }

type Lib = typeof import('expo-media-library/legacy');
// Нет модуля в старой APK — показываем только кнопки, без сетки.
function lib(): Lib | null {
  if (Platform.OS === 'web') return null;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  try { return require('expo-media-library/legacy') as Lib; } catch { return null; }
}

const COLS = 3, GAP = 3, PAGE = 60;
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s) % 60).padStart(2, '0')}`;

export function AttachTray({ height, onSend, onCamera, onGallery, onEvent, onPoll, onStickers, onClose }: {
  height: number; onSend: (items: Picked[]) => void; onCamera: () => void; onGallery: () => void; onEvent: () => void; onPoll: () => void; onStickers: () => void; onClose: () => void;
}) {
  const { width } = useWindowDimensions();
  const tile = Math.floor((width - 24 - GAP * (COLS - 1)) / COLS);
  const [assets, setAssets] = useState<Picked[]>([]);
  const [cursor, setCursor] = useState<string | undefined>();
  const [more, setMore] = useState(true);
  const [perm, setPerm] = useState<'unknown' | 'ok' | 'no' | 'none'>(() => (lib() ? 'unknown' : 'none'));
  const [picked, setPicked] = useState<string[]>([]);

  const load = useCallback(async (after?: string) => {
    const L = lib();
    if (!L) return;
    try {
      const page = await L.getAssetsAsync({ first: PAGE, after, mediaType: [L.MediaType.photo, L.MediaType.video], sortBy: [[L.SortBy.creationTime, false]] });
      setAssets((a) => [...(after ? a : []), ...page.assets.map((x) => ({ uri: x.uri, video: x.mediaType === 'video', width: x.width, height: x.height, duration: x.duration || undefined }))]);
      setCursor(page.endCursor); setMore(page.hasNextPage);
    } catch { setMore(false); }
  }, []);

  useEffect(() => {
    const L = lib();
    if (!L) return;
    let live = true;
    void L.getPermissionsAsync(false, ['photo', 'video']).then((p) => {
      if (!live) return;
      if (p.granted) { setPerm('ok'); void load(); } else setPerm('no');
    }).catch(() => live && setPerm('none'));
    return () => { live = false; };
  }, [load]);

  const ask = async () => {
    const L = lib();
    if (!L) return;
    const p = await L.requestPermissionsAsync(false, ['photo', 'video']).catch(() => null);
    if (p?.granted) { setPerm('ok'); void load(); } else onGallery();
  };
  const toggle = (uri: string) => setPicked((p) => (p.includes(uri) ? p.filter((x) => x !== uri) : p.length >= 10 ? p : [...p, uri]));
  const send = () => { onSend(picked.map((u) => assets.find((a) => a.uri === u)!).filter(Boolean)); setPicked([]); };

  const actions = [
    { key: 'cam', label: 'Камера', Icon: Camera, bg: colors.ink, fg: colors.paper, on: onCamera },
    { key: 'all', label: 'Галерея', Icon: Images, bg: '#2E7BD8', fg: '#FFFFFF', on: onGallery },
    { key: 'ev', label: 'Событие', Icon: CalendarDays, bg: colors.accent, fg: colors.ink, on: onEvent },
    { key: 'poll', label: 'Опрос', Icon: BarChart3, bg: '#2F8F5B', fg: '#FFFFFF', on: onPoll },
    { key: 'st', label: 'Стикеры', Icon: Smile, bg: '#9167CE', fg: '#FFFFFF', on: onStickers },
  ];

  return (
    <View style={[styles.root, { height }]}>
      <View style={styles.head}>
        <Text style={styles.h}>{picked.length ? `Выбрано: ${picked.length}` : 'Недавние'}</Text>
        <Pressable onPress={onClose} hitSlop={8} style={styles.x} accessibilityRole="button" accessibilityLabel="Закрыть вложения"><X size={18} color={colors.ink} strokeWidth={2.2} /></Pressable>
      </View>
      <View style={styles.actions}>
        {actions.map(({ key, label, Icon, bg, fg, on }) => (
          <Pressable key={key} onPress={on} style={({ pressed }) => [styles.act, pressed && { transform: [{ scale: 0.94 }] }]} accessibilityRole="button" accessibilityLabel={label}>
            <View style={[styles.actIcon, { backgroundColor: bg }]}><Icon size={22} color={fg} strokeWidth={2} /></View>
            <Text style={styles.actText}>{label}</Text>
          </Pressable>
        ))}
      </View>
      {perm === 'ok' ? (
        <FlatList
          data={assets}
          keyExtractor={(a) => a.uri}
          numColumns={COLS}
          columnWrapperStyle={{ gap: GAP }}
          contentContainerStyle={{ gap: GAP, paddingBottom: picked.length ? 72 : 12 }}
          onEndReachedThreshold={0.6}
          onEndReached={() => { if (more && cursor) void load(cursor); }}
          removeClippedSubviews
          initialNumToRender={18}
          windowSize={5}
          renderItem={({ item }) => {
            const n = picked.indexOf(item.uri);
            return (
              <Pressable onPress={() => toggle(item.uri)} style={{ width: tile, height: tile }} accessibilityRole="checkbox" accessibilityState={{ checked: n >= 0 }} accessibilityLabel={item.video ? `Видео ${mmss(item.duration ?? 0)}` : 'Фото'}>
                <Image source={{ uri: item.uri, width: tile * 2, height: tile * 2 }} resizeMethod="resize" style={[styles.img, n >= 0 && { transform: [{ scale: 0.9 }], borderRadius: 10 }]} />
                <View style={[styles.mark, n >= 0 ? styles.markOn : null]}>{n >= 0 && <Text style={styles.markText}>{n + 1}</Text>}</View>
                {item.video && <View style={styles.dur}><Text style={styles.durText}>{mmss(item.duration ?? 0)}</Text></View>}
              </Pressable>
            );
          }}
          ListEmptyComponent={<Text style={styles.empty}>В галерее пока пусто</Text>}
        />
      ) : perm === 'no' ? (
        <Pressable onPress={() => void ask()} style={styles.allow} accessibilityRole="button">
          <Images size={28} color={colors.ink} strokeWidth={1.8} />
          <Text style={styles.allowT}>Показывать фото прямо здесь</Text>
          <Text style={styles.allowS}>Разреши доступ к галерее — выбирай и отправляй в пару нажатий</Text>
        </Pressable>
      ) : null}
      {picked.length > 0 && (
        <Pressable onPress={send} style={styles.send} accessibilityRole="button" accessibilityLabel={`Отправить ${picked.length}`}>
          <Text style={styles.sendText}>Отправить · {picked.length}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: colors.paper, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 12, paddingTop: 10, boxShadow: '0 -8px 24px -12px rgba(23,22,26,0.35)' },
  head: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4, marginBottom: 8 },
  h: { flex: 1, fontFamily: fonts.display700, fontSize: 18, color: colors.ink },
  x: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.sand, alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4, marginBottom: 12 },
  act: { alignItems: 'center', gap: 5, width: 62 },
  actIcon: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
  actText: { fontFamily: fonts.body500, fontSize: 12, color: colors.ink },
  img: { width: '100%', height: '100%', backgroundColor: colors.sand },
  mark: { position: 'absolute', top: 6, right: 6, width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: '#FFFFFF', backgroundColor: 'rgba(23,22,26,0.2)', alignItems: 'center', justifyContent: 'center' },
  markOn: { backgroundColor: colors.accent, borderColor: '#FFFFFF' },
  markText: { fontFamily: fonts.body700, fontSize: 12, color: colors.ink },
  dur: { position: 'absolute', left: 6, bottom: 6, paddingHorizontal: 5, borderRadius: 6, backgroundColor: 'rgba(23,22,26,0.6)' },
  durText: { fontFamily: fonts.mono600, fontSize: 10.5, color: '#FFFFFF' },
  empty: { fontFamily: fonts.body400, fontSize: 14, color: colors.muted, textAlign: 'center', marginTop: 24 },
  allow: { alignItems: 'center', gap: 6, padding: 20, borderRadius: 20, backgroundColor: colors.card, marginTop: 4 },
  allowT: { fontFamily: fonts.body700, fontSize: 15.5, color: colors.ink },
  allowS: { fontFamily: fonts.body400, fontSize: 13, color: colors.muted2, textAlign: 'center' },
  send: { position: 'absolute', left: 16, right: 16, bottom: 14, height: 52, borderRadius: 17, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', boxShadow: '0 10px 22px -10px rgba(240,82,31,0.7)' },
  sendText: { fontFamily: fonts.body700, fontSize: 16, color: colors.ink },
});
