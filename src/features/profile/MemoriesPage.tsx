// «Воспоминания» (FIX3 Ф9): альбомы прошедших событий, где ты был, плюс свои альбомы. Как «сохранёнки» ВКонтакте,
// только привязаны к событиям. Видишь только ты; друзьям — если включишь внизу (profiles.memories_visible).
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { ImagePlus, Plus, Trash2, X } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import type { Category } from '../../data/types';
import { CAT_COLOR, CAT_ICON, catFg } from '../../map/icons';
import { addMemoryPhoto, createMemory, deleteMemory, getMemories, getPastEvents, getProfileExtras, removeMemoryPhoto, saveMemoryNote, saveProfileExtras, type Memory } from '../../live/profileExtras';
import { colors, fonts, radii } from '../../theme';
import { Ic } from '../../ui/Ic';
import { plate } from '../../ui/glass';
import { Group, Note, SettingsPage, ToggleRow } from '../../ui/v6/Settings';

const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const dateRu = (iso: string) => { const d = new Date(new Date(iso).getTime() + 5 * 3600e3); return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`; };
const cat = (c?: string): Category => (c && c in CAT_COLOR ? c : 'music') as Category;

function Cover({ uri, category, size = 34 }: { uri?: string | null; category?: string; size?: number }) {
  if (uri) return <Image source={{ uri }} style={StyleSheet.absoluteFill} />;
  const c = cat(category);
  return <View style={[StyleSheet.absoluteFill, { backgroundColor: CAT_COLOR[c], alignItems: 'center', justifyContent: 'center' }]}><Ic d={CAT_ICON[c]} size={size} color={catFg(c)} w={1.6} /></View>;
}

export default function MemoriesPage() {
  const qc = useQueryClient();
  const { width } = useWindowDimensions();
  const memories = useQuery({ queryKey: ['me', 'memories'], queryFn: () => getMemories() });
  const past = useQuery({ queryKey: ['me', 'past-events'], queryFn: getPastEvents });
  const extras = useQuery({ queryKey: ['me', 'extras'], queryFn: getProfileExtras });
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

  return (
    <SettingsPage title="Воспоминания" sub="Фото с событий, где ты был. Пусть останутся.">
      {albums.length > 0 && (
        <View style={styles.grid}>
          {albums.map(m => (
            <Pressable key={m.id} onPress={() => router.push({ pathname: '/profile/[page]', params: { page: `memory-${m.id}` } })} style={[styles.album, { width: tileW, height: tileW * 1.2 }]} accessibilityRole="button" accessibilityLabel={`Альбом ${m.title}, ${m.photos.length} фото`}>
              <Cover uri={m.cover} category={past.data?.find(p => p.event_id === m.event_id)?.category} size={44} />
              <View style={styles.shade} />
              <Text style={styles.albumTitle} numberOfLines={2}>{m.title}</Text>
              <Text style={styles.albumMeta}>{dateRu(m.happened_at).toUpperCase()} · {m.photos.length} ФОТО</Text>
            </Pressable>
          ))}
        </View>
      )}
      {!albums.length && !memories.isPending && (
        <View style={styles.empty}>
          <ImagePlus size={34} color={colors.muted2} strokeWidth={1.6} />
          <Text style={styles.emptyTitle}>Здесь будут твои вечера</Text>
          <Text style={styles.emptySub}>Сходи на событие — оно появится ниже. Добавь фото, и альбом останется навсегда.</Text>
        </View>
      )}

      {fresh.length > 0 && (
        <View style={{ gap: 8 }}>
          <Text style={styles.cap}>ГДЕ ТЫ БЫЛ — СДЕЛАЙ АЛЬБОМ</Text>
          {fresh.slice(0, 12).map(p => (
            <Pressable key={p.event_id} disabled={!!busy} onPress={() => void make({ event_id: p.event_id, title: p.title, happened_at: p.starts_at })} style={styles.pastRow} accessibilityRole="button" accessibilityLabel={`Сделать альбом: ${p.title}`}>
              <View style={styles.pastCover}><Cover uri={p.cover_url} category={p.category} size={20} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.pastTitle} numberOfLines={1}>{p.title}</Text>
                <Text style={styles.pastSub} numberOfLines={1}>{dateRu(p.starts_at)}{p.venue_name ? ` · ${p.venue_name}` : ''}{p.arrived ? ' · был на месте' : ''}</Text>
              </View>
              <View style={styles.addBtn}><Plus size={18} color={colors.paper} strokeWidth={2.4} /></View>
            </Pressable>
          ))}
        </View>
      )}

      <Pressable onPress={() => setNaming(true)} style={styles.own} accessibilityRole="button">
        <Plus size={18} color={colors.ink} strokeWidth={2.2} />
        <Text style={styles.ownText}>Свой альбом — без события</Text>
      </Pressable>
      {!!error && <Text style={{ color: colors.accentText }}>{error}</Text>}

      <Group>
        <ToggleRow title="Друзья видят мои воспоминания" sub="Без этого альбомы видишь только ты" on={!!extras.data?.memoriesVisible}
          onChange={v => { void saveProfileExtras({ memoriesVisible: v }).then(() => qc.invalidateQueries({ queryKey: ['me', 'extras'] })).catch(() => setError('Не получилось сохранить. Проверь связь')); }} last />
      </Group>

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
            <Image source={{ uri: p.url }} style={StyleSheet.absoluteFill} />
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
          {photo && <Image source={{ uri: photo.url }} style={{ width: '100%', height: '78%' }} resizeMode="contain" />}
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
  own: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 52, borderRadius: 17, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.line2 },
  ownText: { fontFamily: fonts.body700, fontSize: 15, color: colors.ink },
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
