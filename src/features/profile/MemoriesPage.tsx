// «Воспоминания» (FIX3 Ф9): альбомы прошедших событий, где ты был, плюс свои альбомы. Как «сохранёнки» ВКонтакте,
// только привязаны к событиям. Прошедшие события сами становятся альбомами — ничего включать не нужно.
// Видишь только ты; друзьям — если разрешишь в «Приватности» (profiles.memories_visible).
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { Camera, ImagePlus, Sparkles, Trash2, X } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Image, Modal, Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import type { Category } from '../../data/types';
import { CAT_COLOR, CAT_ICON, catFg } from '../../map/icons';
import { addMemoryPhoto, createMemory, deleteMemory, getMemories, getPastEvents, removeMemoryPhoto, saveMemoryNote, type Memory } from '../../live/profileExtras';
import { colors, fonts, radii } from '../../theme';
import { Ic } from '../../ui/Ic';
import { plate } from '../../ui/glass';
import { Note, SettingsPage } from '../../ui/v6/Settings';

const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const dateRu = (iso: string) => { const d = new Date(new Date(iso).getTime() + 5 * 3600e3); return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`; };
const cat = (c?: string): Category => (c && c in CAT_COLOR ? c : 'music') as Category;

function Cover({ uri, category, size = 34 }: { uri?: string | null; category?: string; size?: number }) {
  if (uri) return <Image source={{ uri }} resizeMethod="resize" style={StyleSheet.absoluteFill} />;
  const c = cat(category);
  return <View style={[StyleSheet.absoluteFill, { backgroundColor: CAT_COLOR[c], alignItems: 'center', justifyContent: 'center' }]}><Ic d={CAT_ICON[c]} size={size} color={catFg(c)} w={1.6} /></View>;
}

export default function MemoriesPage() {
  const qc = useQueryClient();
  const { width } = useWindowDimensions();
  const memories = useQuery({ queryKey: ['me', 'memories'], queryFn: () => getMemories() });
  const past = useQuery({ queryKey: ['me', 'past-events'], queryFn: getPastEvents });
  const [naming, setNaming] = useState(false);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const albums = memories.data ?? [];
  const fresh = (past.data ?? []).filter(p => !p.memory_id && !albums.some(a => a.event_id === p.event_id));
  const tileW = (Math.min(width, 640) - 32 - 10) / 2;

  const make = async (p: { event_id: string | null; title: string; happened_at: string }) => {
    if (busy) return;
    setBusy(p.event_id ?? 'own'); setError('');
    try {
      const id = await createMemory(p);
      await qc.invalidateQueries({ queryKey: ['me', 'memories'] });
      await qc.invalidateQueries({ queryKey: ['me', 'past-events'] });
      router.push({ pathname: '/profile/[page]', params: { page: `memory-${id}` } });
    } catch { setError('Не получилось создать альбом. Проверь связь'); }
    finally { setBusy(''); }
  };

  // Свои альбомы (без события) — сверху и отдельно; альбомы событий и ещё не открытые прошедшие события — одной сеткой.
  const own = albums.filter(a => !a.event_id);
  const tiles = [
    ...albums.filter(a => a.event_id).map(a => ({ key: a.id, title: a.title, at: a.happened_at, cover: a.cover, count: a.photos.length, category: past.data?.find(p => p.event_id === a.event_id)?.category, open: () => router.push({ pathname: '/profile/[page]', params: { page: `memory-${a.id}` } }) })),
    ...fresh.map(p => ({ key: `past-${p.event_id}`, title: p.title, at: p.starts_at, cover: p.cover_url, count: 0, category: p.category, open: () => void make({ event_id: p.event_id, title: p.title, happened_at: p.starts_at }) })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  return (
    <SettingsPage title="Воспоминания" sub="Фото с событий, где ты был. Пусть останутся.">
      <View style={styles.moments}>
        <View style={styles.momentsGlow} />
        <View style={styles.momentsHead}>
          <View style={styles.momentsIcon}><Sparkles size={20} color="#FFFFFF" strokeWidth={2} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.momentsTitle}>Свои моменты</Text>
            <Text style={styles.momentsSub}>{own.length ? `${own.length} ${own.length === 1 ? 'альбом' : own.length < 5 ? 'альбома' : 'альбомов'} без события` : 'Поездки, лето, просто хороший день'}</Text>
          </View>
        </View>
        {own.length > 0 && (
          <View style={styles.momentsRow}>
            {own.slice(0, 3).map(m => (
              <Pressable key={m.id} onPress={() => router.push({ pathname: '/profile/[page]', params: { page: `memory-${m.id}` } })} style={styles.momentTile} accessibilityRole="button" accessibilityLabel={`Альбом ${m.title}`}>
                <Cover uri={m.cover} size={22} />
                <View style={styles.shade} />
                <Text style={styles.momentTileText} numberOfLines={2}>{m.title}</Text>
              </Pressable>
            ))}
          </View>
        )}
        <Pressable onPress={() => setNaming(true)} style={styles.momentsBtn} accessibilityRole="button" accessibilityLabel="Новый свой момент">
          <Camera size={18} color={colors.accent} strokeWidth={2.2} />
          <Text style={styles.momentsBtnText}>Новый момент</Text>
        </Pressable>
      </View>

      {tiles.length > 0 && <Text style={styles.cap}>С СОБЫТИЙ</Text>}
      {tiles.length > 0 && (
        <View style={styles.grid}>
          {tiles.map(t => (
            <Pressable key={t.key} disabled={!!busy} onPress={t.open} style={[styles.album, { width: tileW, height: tileW * 1.2 }]} accessibilityRole="button" accessibilityLabel={`Альбом ${t.title}, ${t.count} фото`}>
              <Cover uri={t.cover} category={t.category} size={44} />
              <View style={styles.shade} />
              <Text style={styles.albumTitle} numberOfLines={2}>{t.title}</Text>
              <Text style={styles.albumMeta}>{dateRu(t.at).toUpperCase()}{t.count ? ` · ${t.count} ФОТО` : ''}</Text>
            </Pressable>
          ))}
        </View>
      )}
      {!tiles.length && !memories.isPending && !past.isPending && (
        <View style={styles.empty}>
          <ImagePlus size={34} color={colors.muted2} strokeWidth={1.6} />
          <Text style={styles.emptyTitle}>Здесь будут твои вечера</Text>
          <Text style={styles.emptySub}>Сходи на событие — альбом появится сам. Добавь фото, и он останется навсегда.</Text>
        </View>
      )}
      {!!error && <Text style={{ color: colors.accentText }}>{error}</Text>}
      <Note>Кто видит альбомы, меняется в «Настройки → Кто видит, где я».</Note>

      <Modal visible={naming} transparent animationType="fade" onRequestClose={() => setNaming(false)}>
        <View style={styles.modalBack}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Новый альбом</Text>
            <TextInput value={title} onChangeText={setTitle} placeholder="Например: Лето в горах" placeholderTextColor={colors.muted3} style={styles.input} maxLength={120} autoFocus accessibilityLabel="Название альбома" />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pressable onPress={() => setNaming(false)} style={[styles.mBtn, { backgroundColor: colors.sand }]} accessibilityRole="button"><Text style={[styles.mBtnText, { color: colors.ink }]}>Отмена</Text></Pressable>
              <Pressable disabled={!title.trim()} onPress={() => { setNaming(false); void make({ event_id: null, title: title.trim(), happened_at: new Date().toISOString() }); setTitle(''); }} style={[styles.mBtn, !title.trim() && { opacity: 0.4 }]} accessibilityRole="button"><Text style={styles.mBtnText}>Создать</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SettingsPage>
  );
}

/** Один альбом: фото плиткой, заметка, добавить и удалить фото, удалить альбом. */
export function MemoryAlbum({ id }: { id: string }) {
  const qc = useQueryClient();
  const { width } = useWindowDimensions();
  const memories = useQuery({ queryKey: ['me', 'memories'], queryFn: () => getMemories() });
  const m: Memory | undefined = memories.data?.find(x => x.id === id);
  const [note, setNote] = useState<string | null>(null);
  const [view, setView] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const cell = (Math.min(width, 640) - 32 - 12) / 3;
  const refresh = () => qc.invalidateQueries({ queryKey: ['me', 'memories'] });

  if (!m) return <SettingsPage title="Альбом"><Note>{memories.isPending ? 'Загружаю…' : 'Альбом не найден'}</Note></SettingsPage>;

  const add = async () => {
    if (busy) return;
    setError('');
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) { setError('Разреши доступ к фотографиям в настройках телефона'); return; }
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: 20, quality: 0.8 });
      if (res.canceled) return;
      setBusy(true);
      for (const a of res.assets) await addMemoryPhoto(m.id, a.uri);
      await refresh();
    } catch { setError('Не все фото загрузились. Проверь связь и добавь ещё раз'); await refresh(); }
    finally { setBusy(false); }
  };
  const photo = m.photos.find(p => p.id === view);

  return (
    <SettingsPage title={m.title} sub={`${dateRu(m.happened_at)} · ${m.photos.length} фото`}>
      <View style={styles.photos}>
        <Pressable onPress={() => void add()} disabled={busy} style={[styles.addPhoto, { width: cell, height: cell }]} accessibilityRole="button" accessibilityLabel="Добавить фото">
          <ImagePlus size={26} color={colors.muted2} strokeWidth={1.7} />
          <Text style={styles.addPhotoText}>{busy ? 'Загружаю…' : 'Добавить'}</Text>
        </Pressable>
        {m.photos.map(p => (
          <Pressable key={p.id} onPress={() => setView(p.id)} style={{ width: cell, height: cell, borderRadius: 14, overflow: 'hidden' }} accessibilityRole="imagebutton" accessibilityLabel="Открыть фото">
            <Image source={{ uri: p.url }} resizeMethod="resize" style={StyleSheet.absoluteFill} />
          </Pressable>
        ))}
      </View>
      {!!error && <Text style={{ color: colors.accentText }}>{error}</Text>}
      <TextInput value={note ?? m.note ?? ''} onChangeText={setNote} onBlur={() => { if (note != null && note !== (m.note ?? '')) void saveMemoryNote(m.id, note).then(refresh).catch(() => setError('Заметка не сохранилась')); }}
        placeholder="Пара слов о том вечере — для себя" placeholderTextColor={colors.muted3} multiline maxLength={1000} style={[styles.input, { minHeight: 90, textAlignVertical: 'top' }]} accessibilityLabel="Заметка" />
      <Pressable onPress={() => Alert.alert('Удалить альбом?', 'Фото из него тоже удалятся', [{ text: 'Отмена', style: 'cancel' }, { text: 'Удалить', style: 'destructive', onPress: () => { void deleteMemory(m.id).then(refresh).then(() => router.back()).catch(() => setError('Не получилось удалить')); } }])}
        style={styles.del} accessibilityRole="button">
        <Trash2 size={17} color={colors.accentText} strokeWidth={1.9} />
        <Text style={styles.delText}>Удалить альбом</Text>
      </Pressable>

      <Modal visible={!!photo} transparent animationType="fade" onRequestClose={() => setView(null)}>
        <View style={styles.viewer}>
          {photo && <Image source={{ uri: photo.url }} resizeMethod="resize" style={{ width: '100%', height: '78%' }} resizeMode="contain" />}
          <View style={styles.viewerBar}>
            <Pressable onPress={() => setView(null)} style={styles.viewerBtn} accessibilityRole="button" accessibilityLabel="Закрыть"><X size={24} color="#FFFFFF" /></Pressable>
            <Pressable onPress={() => { if (!photo) return; const pid = photo.id; setView(null); void removeMemoryPhoto(m.id, pid).then(refresh).catch(() => setError('Фото не удалилось')); }} style={styles.viewerBtn} accessibilityRole="button" accessibilityLabel="Удалить фото"><Trash2 size={22} color="#FFFFFF" /></Pressable>
          </View>
        </View>
      </Modal>
    </SettingsPage>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  album: { borderRadius: 22, overflow: 'hidden', justifyContent: 'flex-end', padding: 12 },
  shade: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(23,22,26,0.3)' },
  albumTitle: { fontFamily: fonts.display700, fontSize: 17, lineHeight: 20, color: '#FFFFFF' },
  albumMeta: { fontFamily: fonts.mono600, fontSize: 10, letterSpacing: 0.4, color: '#EEE9DE', marginTop: 4 },
  empty: { borderRadius: radii.xl - 4, ...plate, padding: 24, alignItems: 'center', gap: 8 },
  emptyTitle: { fontFamily: fonts.display700, fontSize: 19, color: colors.ink, textAlign: 'center' },
  emptySub: { fontFamily: fonts.body400, fontSize: 14, lineHeight: 20, color: colors.muted, textAlign: 'center' },
  cap: { fontFamily: fonts.mono600, fontSize: 10.5, letterSpacing: 0.8, color: colors.muted, marginTop: 6 },
  pastRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 18, ...plate },
  pastCover: { width: 46, height: 46, borderRadius: 12, overflow: 'hidden' },
  pastTitle: { fontFamily: fonts.body700, fontSize: 15, color: colors.ink },
  pastSub: { fontFamily: fonts.body400, fontSize: 12.5, color: colors.muted },
  addBtn: { width: 40, height: 40, borderRadius: 14, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  moments: { borderRadius: 26, padding: 16, gap: 14, backgroundColor: colors.ink, overflow: 'hidden' },
  momentsGlow: { position: 'absolute', width: 220, height: 220, borderRadius: 110, right: -70, top: -110, backgroundColor: colors.accent, opacity: 0.35 },
  momentsHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  momentsIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  momentsTitle: { fontFamily: fonts.display700, fontSize: 20, color: '#FFFFFF' },
  momentsSub: { fontFamily: fonts.body400, fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  momentsRow: { flexDirection: 'row', gap: 8 },
  momentTile: { flex: 1, height: 92, borderRadius: 16, overflow: 'hidden', justifyContent: 'flex-end', padding: 8 },
  momentTileText: { fontFamily: fonts.body700, fontSize: 12.5, lineHeight: 15, color: '#FFFFFF' },
  momentsBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 50, borderRadius: 16, backgroundColor: '#FFFFFF' },
  momentsBtnText: { fontFamily: fonts.body700, fontSize: 15, color: colors.ink },
  modalBack: { flex: 1, backgroundColor: 'rgba(23,22,26,0.45)', justifyContent: 'center', padding: 24 },
  modal: { borderRadius: 26, backgroundColor: colors.paper, padding: 20, gap: 14 },
  modalTitle: { fontFamily: fonts.display700, fontSize: 21, color: colors.ink },
  input: { minHeight: 50, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 15, borderWidth: 1, borderColor: colors.line2, backgroundColor: colors.card, fontFamily: fonts.body400, fontSize: 15, color: colors.ink },
  mBtn: { flex: 1, minHeight: 50, borderRadius: 15, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  mBtnText: { fontFamily: fonts.body700, fontSize: 15, color: colors.paper },
  photos: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  addPhoto: { borderRadius: 14, backgroundColor: colors.sand, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.line2, alignItems: 'center', justifyContent: 'center', gap: 4 },
  addPhotoText: { fontFamily: fonts.body600, fontSize: 12, color: colors.muted2 },
  del: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 48 },
  delText: { fontFamily: fonts.body700, fontSize: 14.5, color: colors.accentText },
  viewer: { flex: 1, backgroundColor: '#0D0D10', justifyContent: 'center', alignItems: 'center' },
  viewerBar: { position: 'absolute', bottom: 40, flexDirection: 'row', gap: 24 },
  viewerBtn: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
});
