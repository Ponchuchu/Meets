// «Редактировать профиль» (26 октября, новый дизайн): сверху фото в своей рамке на мягком фоне, ниже — одна карточка
// «Имя · Ник · О себе» и строка «Рамка и метка на карте». «Сохранить» — в шапке справа и внизу, активна, только когда есть изменения.
// Статус, интересы и Instagram пока убраны (просьба владельца) — в базе поля остаются, экран их не трогает.
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { Camera, ChevronLeft, ChevronRight, Eye, Plus, Star, Trash2 } from 'lucide-react-native';
import { Image } from 'expo-image';
import { photo as photoSrc } from '../../data/photos';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../data/client';
import { config } from '../../lib/config';
import { getMyPhotos, saveMyPhotos, uploadAvatar, uploadPhoto } from '../../live/api';
import { myId } from '../../live/auth';
import { AvatarFrame, frameById } from '../../profile/frames';
import { useBackClose } from '../../state/app';
import { useProfile } from '../../state/profile';
import { useSession } from '../../state/session';
import { colors, fonts } from '../../theme';
import { Aura } from './ProfileScreen';

const LIVE = config.dataMode !== 'demo';

interface Row { name: string; handle: string | null; photo_url: string | null; about: string | null; map_frame: string | null; map_shape: string | null }
interface Form { name: string; handle: string; about: string }

export default function EditProfile() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const draft = useSession((s) => s.draft);
  const local = useProfile((s) => s.card);
  const demoFrame = useProfile((s) => s.mapFrame);
  const demoShape = useProfile((s) => s.mapShape);
  const q = useQuery({ queryKey: ['me', 'edit'], enabled: LIVE, queryFn: async () => {
    const { data, error } = await supabase().from('profiles').select('name,handle,photo_url,about,map_frame,map_shape').eq('id', myId() ?? '').maybeSingle();
    if (error) throw error;
    return data as Row | null;
  } });
  const src: Row | null = LIVE ? q.data ?? null : { name: draft.name, handle: null, photo_url: draft.photo, about: local.about, map_frame: demoFrame, map_shape: demoShape };
  const start: Form | null = src ? { name: src.name ?? '', handle: src.handle ?? '', about: src.about ?? '' } : null;
  const [form, setForm] = useState<Form | null>(null);
  const f = form ?? start;
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState<'photo' | 'save' | null>(null);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const set = (p: Partial<Form>) => { if (f) { setForm({ ...f, ...p }); setNote(null); } };
  const dirty = !!f && !!start && (f.name !== start.name || f.handle !== start.handle || f.about !== start.about);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/me'));
  useBackClose(back);

  // Фото профиля (до 6, как в Telegram): первое — главное. Меняются сразу, без «Сохранить».
  const photosQ = useQuery({ queryKey: ['me', 'photos'], queryFn: getMyPhotos, enabled: LIVE });
  const demoPhotos = useProfile((s) => s.photos);
  const myPhotos = LIVE ? photosQ.data?.photos ?? (src?.photo_url ? [src.photo_url] : []) : demoPhotos.length ? demoPhotos : draft.photo ? [draft.photo] : [];
  const [sel, setSel] = useState<number | null>(null);
  const putPhotos = async (list: string[]) => {
    if (LIVE) { await saveMyPhotos(list); void qc.invalidateQueries({ queryKey: ['me'] }); }
    else useProfile.getState().setPhotos(list);
    useSession.getState().update({ photo: list[0] ?? null });
    setPhoto(list[0] ?? null);
  };
  const addPhoto = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) { setNote({ ok: false, text: 'Разреши доступ к фотографиям в настройках телефона' }); return; }
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [4, 5], quality: 0.85 });
      if (res.canceled || !res.assets[0]) return;
      setBusy('photo');
      const url = LIVE ? await uploadPhoto(res.assets[0].uri) : res.assets[0].uri;
      await putPhotos([...myPhotos, url].slice(0, 6));
      setNote({ ok: true, text: 'Фото добавлено' });
    } catch { setNote({ ok: false, text: 'Не удалось добавить фото. Проверь связь' }); }
    finally { setBusy(null); }
  };
  const photoAct = async (kind: 'main' | 'del') => {
    if (sel == null) return;
    const list = kind === 'main' ? [myPhotos[sel], ...myPhotos.filter((_, k) => k !== sel)] : myPhotos.filter((_, k) => k !== sel);
    setSel(null);
    try { await putPhotos(list); setNote({ ok: true, text: kind === 'main' ? 'Теперь это главное фото' : 'Фото убрано' }); }
    catch { setNote({ ok: false, text: 'Не получилось. Проверь связь' }); }
  };

  const pick = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) { setNote({ ok: false, text: 'Разреши доступ к фотографиям в настройках телефона' }); return; }
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.85 });
      if (res.canceled || !res.assets[0]) return;
      setBusy('photo');
      const url = LIVE ? await uploadAvatar(res.assets[0].uri) : res.assets[0].uri;
      useSession.getState().update({ photo: url });
      if (!LIVE && demoPhotos.length) useProfile.getState().setPhotos([url, ...demoPhotos.slice(1)]);
      if (LIVE) void qc.invalidateQueries({ queryKey: ['me', 'photos'] });
      setPhoto(url);
      setNote({ ok: true, text: 'Фото обновлено' });
    } catch { setNote({ ok: false, text: 'Не удалось сохранить фото. Проверь связь' }); }
    finally { setBusy(null); }
  };

  const save = async () => {
    if (!f || busy || !dirty) return;
    const name = f.name.trim();
    if (!name) { setNote({ ok: false, text: 'Имя не может быть пустым' }); return; }
    setBusy('save'); setNote(null);
    const handle = f.handle.trim().replace(/^@/, '').toLowerCase();
    try {
      if (LIVE) {
        const { error } = await supabase().from('profiles').update({ name, handle: handle || null, about: f.about.trim() || null }).eq('id', myId() ?? '');
        if (error) throw new Error(/duplicate|unique/i.test(error.message) ? 'Такой ник уже занят' : 'Проверь связь');
        void qc.invalidateQueries({ queryKey: ['me'] });
      } else {
        useProfile.getState().setCard({ ...local, about: f.about.trim() });
      }
      useSession.getState().update({ name });
      setForm(null);
      setNote({ ok: true, text: 'Сохранено' });
    } catch (e) { setNote({ ok: false, text: e instanceof Error ? e.message : 'Проверь связь' }); }
    finally { setBusy(null); }
  };
  const preview = () => router.push({ pathname: '/person/[id]', params: { id: LIVE ? myId() ?? 'me' : 'me', preview: '1' } });

  const frameId = src?.map_frame ?? 'classic';
  const frame = frameById(frameId);
  const heroH = insets.top + 250;
  const canSave = dirty && !busy;

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false}>
        <View style={{ height: heroH, paddingTop: insets.top }}>
          <Aura color={frame.color} height={heroH} />
          <View style={styles.bar}>
            <Pressable onPress={back} style={styles.round} accessibilityRole="button" accessibilityLabel="Назад" hitSlop={6}>
              <ChevronLeft size={24} color={colors.ink} strokeWidth={2.2} />
            </Pressable>
            <Text style={styles.title} accessibilityRole="header">Профиль</Text>
            <Pressable onPress={() => void save()} disabled={!canSave} style={[styles.saveTop, !canSave && { opacity: 0.35 }]} accessibilityRole="button" accessibilityLabel="Сохранить" accessibilityState={{ disabled: !canSave }}>
              {busy === 'save' ? <ActivityIndicator color={colors.paper} size="small" /> : <Text style={styles.saveTopText}>Готово</Text>}
            </Pressable>
          </View>
          {f && (
            <Pressable onPress={() => void pick()} style={styles.photo} accessibilityRole="button" accessibilityLabel="Сменить фото">
              <AvatarFrame frameId={frameId} shape={src?.map_shape ?? undefined} photo={photo ?? src?.photo_url ?? draft.photo} initial={(f.name[0] ?? '·').toUpperCase()} size={124} animate={false} />
              <View style={styles.cam}>{busy === 'photo' ? <ActivityIndicator color={colors.paper} size="small" /> : <Camera size={17} color={colors.paper} strokeWidth={2.2} />}</View>
            </Pressable>
          )}
          <Pressable onPress={() => void pick()} hitSlop={8} accessibilityRole="button" style={{ alignSelf: 'center', marginTop: 10 }}>
            <Text style={styles.change}>Сменить фото</Text>
          </Pressable>
        </View>

        {!f ? <ActivityIndicator color={colors.ink} style={{ marginTop: 30 }} /> : (
          <View style={styles.body}>
            <View style={styles.card}>
              <View style={styles.photosHead}><Text style={styles.label}>Фото · {myPhotos.length} из 6</Text><Text style={styles.count}>первое — главное</Text></View>
              <View style={styles.photos}>
                {myPhotos.map((ph, k) => (
                  <Pressable key={`${ph}-${k}`} onPress={() => setSel(sel === k ? null : k)} style={[styles.ph, sel === k && styles.phOn]} accessibilityRole="button" accessibilityLabel={`Фото ${k + 1}${k === 0 ? ', главное' : ''}`}>
                    <Image source={photoSrc(ph)} style={StyleSheet.absoluteFill} contentFit="cover" />
                    {k === 0 && <View style={styles.mainTag}><Star size={11} color="#FFFFFF" fill="#FFFFFF" strokeWidth={2} /></View>}
                  </Pressable>
                ))}
                {myPhotos.length < 6 && (
                  <Pressable onPress={() => void addPhoto()} style={[styles.ph, styles.phAdd]} accessibilityRole="button" accessibilityLabel="Добавить фото">
                    {busy === 'photo' ? <ActivityIndicator color={colors.ink} /> : <Plus size={24} color={colors.ink} strokeWidth={2} />}
                  </Pressable>
                )}
              </View>
              {sel != null && (
                <View style={styles.phActs}>
                  {sel > 0 && <Pressable onPress={() => void photoAct('main')} style={styles.phAct} accessibilityRole="button"><Star size={16} color={colors.ink} strokeWidth={2} /><Text style={styles.phActText}>Сделать главным</Text></Pressable>}
                  <Pressable onPress={() => void photoAct('del')} style={styles.phAct} accessibilityRole="button"><Trash2 size={16} color={colors.accentText} strokeWidth={2} /><Text style={[styles.phActText, { color: colors.accentText }]}>Убрать</Text></Pressable>
                </View>
              )}
            </View>

            <View style={styles.card}>
              <Field label="Имя" value={f.name} onChange={(v) => set({ name: v })} max={40} placeholder="Как тебя зовут" />
              <View style={styles.sep} />
              <Field label="Ник" value={f.handle} onChange={(v) => set({ handle: v.replace(/[^a-z0-9._]/g, '') })} max={24} prefix="@" lower placeholder="nickname" />
              <View style={styles.sep} />
              <Field label="О себе" value={f.about} onChange={(v) => set({ about: v })} max={300} multiline placeholder="Пара слов: что любишь, куда зовёшь друзей" />
            </View>
            <Text style={styles.hint}>Ник — для поиска и ссылки на профиль. Латиница, цифры, точка и _.</Text>

            <View style={styles.card}>
              <Pressable onPress={() => router.push('/profile/level')} style={({ pressed }) => [styles.link, pressed && styles.pressed]} accessibilityRole="button">
                <View style={[styles.swatch, { backgroundColor: frame.color }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.linkText}>Рамка и метка на карте</Text>
                  <Text style={styles.linkSub}>{frame.name}</Text>
                </View>
                <ChevronRight size={18} color="#A8A296" strokeWidth={2} />
              </Pressable>
              <View style={styles.sep} />
              <Pressable onPress={preview} style={({ pressed }) => [styles.link, pressed && styles.pressed]} accessibilityRole="button">
                <View style={styles.eye}><Eye size={17} color={colors.ink} strokeWidth={2} /></View>
                <Text style={[styles.linkText, { flex: 1 }]}>Как видят другие</Text>
                <ChevronRight size={18} color="#A8A296" strokeWidth={2} />
              </Pressable>
            </View>

            {note && <Text style={[styles.note, { color: note.ok ? colors.ok : colors.accentText }]}>{note.text}</Text>}
            <Pressable onPress={() => void save()} disabled={!canSave} style={({ pressed }) => [styles.save, !canSave && styles.saveOff, pressed && styles.pressed]} accessibilityRole="button" accessibilityState={{ disabled: !canSave }}>
              <Text style={[styles.saveText, !canSave && { color: colors.muted }]}>{busy === 'save' ? 'Сохраняю…' : dirty ? 'Сохранить' : 'Нет изменений'}</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function Field({ label, value, onChange, max, multiline, placeholder, prefix, lower }: { label: string; value: string; onChange: (v: string) => void; max: number; multiline?: boolean; placeholder?: string; prefix?: string; lower?: boolean }) {
  const [focus, setFocus] = useState(false);
  return (
    <View style={styles.field}>
      <View style={styles.labelRow}>
        <Text style={[styles.label, focus && { color: colors.accentText }]}>{label}</Text>
        {(focus || value.length > max * 0.8) && <Text style={styles.count}>{value.length}/{max}</Text>}
      </View>
      <View style={styles.inputRow}>
        {prefix && <Text style={styles.prefix}>{prefix}</Text>}
        <TextInput value={prefix ? value.replace(/^@/, '') : value} onChangeText={(v) => onChange(lower ? v.toLowerCase() : v)} maxLength={max} multiline={multiline} placeholder={placeholder}
          onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
          placeholderTextColor={colors.muted3} autoCapitalize={lower ? 'none' : 'sentences'} autoCorrect={!lower}
          style={[styles.input, multiline && { minHeight: 72, textAlignVertical: 'top' }]} accessibilityLabel={label} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 10 },
  round: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(251,250,246,0.85)', alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: fonts.display700, fontSize: 18, color: colors.ink },
  saveTop: { minWidth: 84, height: 40, paddingHorizontal: 16, borderRadius: 20, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  saveTopText: { fontFamily: fonts.body600, fontSize: 15, color: colors.paper },
  photo: { alignSelf: 'center', marginTop: 14 },
  cam: { position: 'absolute', right: 4, bottom: 4, width: 36, height: 36, borderRadius: 18, backgroundColor: colors.ink, borderWidth: 3, borderColor: colors.paper, alignItems: 'center', justifyContent: 'center' },
  change: { fontFamily: fonts.body600, fontSize: 15, color: colors.accentText },
  body: { paddingHorizontal: 16, gap: 10 },
  card: { borderRadius: 22, backgroundColor: colors.card, overflow: 'hidden' },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: colors.line2, marginLeft: 16 },
  field: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between' },
  label: { fontFamily: fonts.body500, fontSize: 13, color: colors.muted },
  count: { fontFamily: fonts.body500, fontSize: 12.5, color: colors.muted3 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-start' },
  prefix: { fontFamily: fonts.body500, fontSize: 17, color: colors.muted, paddingTop: 6, marginRight: 1 },
  input: { flex: 1, fontFamily: fonts.body500, fontSize: 17, color: colors.ink, paddingVertical: 6, outlineStyle: 'none' } as object,
  hint: { fontFamily: fonts.body400, fontSize: 13, color: colors.muted, paddingHorizontal: 16, marginTop: -2, marginBottom: 8 },
  link: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, paddingHorizontal: 16 },
  swatch: { width: 30, height: 30, borderRadius: 15, borderWidth: 3, borderColor: colors.paper, boxShadow: '0 0 0 1px rgba(23,22,26,0.12)' },
  eye: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.sand, alignItems: 'center', justifyContent: 'center' },
  linkText: { fontFamily: fonts.body600, fontSize: 16, color: colors.ink },
  linkSub: { fontFamily: fonts.body400, fontSize: 13.5, color: colors.muted },
  note: { fontFamily: fonts.body600, fontSize: 14, textAlign: 'center', marginTop: 6 },
  save: { marginTop: 8, minHeight: 54, borderRadius: 18, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  saveOff: { backgroundColor: colors.sand },
  saveText: { fontFamily: fonts.body700, fontSize: 16, color: colors.paper },
  pressed: { opacity: 0.7 },
  photosHead: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 12 },
  photos: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 12 },
  ph: { width: '31.5%', aspectRatio: 0.8, borderRadius: 16, overflow: 'hidden', backgroundColor: colors.sand },
  phOn: { borderWidth: 3, borderColor: colors.accent },
  phAdd: { alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.line2, backgroundColor: 'transparent' },
  mainTag: { position: 'absolute', left: 6, top: 6, width: 22, height: 22, borderRadius: 11, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  phActs: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingBottom: 12 },
  phAct: { flex: 1, flexDirection: 'row', gap: 6, minHeight: 44, borderRadius: 14, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center' },
  phActText: { fontFamily: fonts.body600, fontSize: 14, color: colors.ink },
});
