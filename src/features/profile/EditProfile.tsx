// «Редактировать профиль» (26 октября): фото, имя, @ник, статус под именем, о себе, интересы, Instagram, рамка на карте.
// Внизу — «Как видят другие»: твой профиль глазами друга. В демо всё хранится на телефоне, в живой версии — в profiles.
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { Camera, Check, Eye, Sparkles } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { supabase } from '../../data/client';
import { config } from '../../lib/config';
import { uploadAvatar } from '../../live/api';
import { myId } from '../../live/auth';
import { useProfile, type MyCard } from '../../state/profile';
import { useSession } from '../../state/session';
import { colors, fonts } from '../../theme';
import { Avatar } from '../../ui/Avatar';
import { SettingsPage } from '../../ui/v6/Settings';

const LIVE = config.dataMode !== 'demo';
/** Интересы, которые можно показать в профиле (до 8). */
export const PROFILE_TAGS = ['Живая музыка', 'Стендап', 'Горы', 'Походы', 'Настолки', 'Кино', 'Театр', 'Выставки', 'Фото', 'Стритфуд', 'Кофе', 'Вечеринки',
  'Бег', 'Велосипед', 'Йога', 'Футбол', 'Танцы', 'Книги', 'Аниме', 'Путешествия', 'Собаки', 'Кошки', 'Языки', 'IT'];
const STATUS_IDEAS = ['Ищу компанию на выходные', 'Свободен вечером', 'Хочу в горы', 'Зову на кофе'];

interface Row { name: string; handle: string | null; photo_url: string | null; about: string | null; instagram: string | null; status_line: string | null; tags: string[] | null }

export default function EditProfile() {
  const qc = useQueryClient();
  const draft = useSession((s) => s.draft);
  const local = useProfile((s) => s.card);
  const q = useQuery({ queryKey: ['me', 'edit'], enabled: LIVE, queryFn: async () => {
    const { data, error } = await supabase().from('profiles').select('name,handle,photo_url,about,instagram,status_line,tags').eq('id', myId() ?? '').maybeSingle();
    if (error) throw error;
    return data as Row | null;
  } });
  const src: Row | null = LIVE ? q.data ?? null : { name: draft.name, handle: null, photo_url: draft.photo, about: local.about, instagram: local.instagram, status_line: local.status, tags: local.tags };
  const [form, setForm] = useState<(MyCard & { name: string; handle: string }) | null>(null);
  const f = form ?? (src ? { name: src.name ?? '', handle: src.handle ?? '', status: src.status_line ?? '', about: src.about ?? '', tags: src.tags ?? [], instagram: src.instagram ?? '' } : null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState<'photo' | 'save' | null>(null);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const set = (p: Partial<NonNullable<typeof f>>) => f && setForm({ ...f, ...p });

  const pick = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) { setNote({ ok: false, text: 'Разреши доступ к фотографиям в настройках телефона' }); return; }
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.85 });
      if (res.canceled || !res.assets[0]) return;
      setBusy('photo');
      const url = LIVE ? await uploadAvatar(res.assets[0].uri) : res.assets[0].uri;
      useSession.getState().update({ photo: url });
      setPhoto(url);
    } catch { setNote({ ok: false, text: 'Не удалось сохранить фото. Проверь связь' }); }
    finally { setBusy(null); }
  };

  const save = async () => {
    if (!f || busy) return;
    const name = f.name.trim();
    if (!name) { setNote({ ok: false, text: 'Имя не может быть пустым' }); return; }
    setBusy('save'); setNote(null);
    const handle = f.handle.trim().replace(/^@/, '').toLowerCase();
    try {
      if (LIVE) {
        const { error } = await supabase().from('profiles').update({ name, handle: handle || null, status_line: f.status.trim() || null, about: f.about.trim() || null, tags: f.tags.slice(0, 8), instagram: f.instagram.trim().replace(/^@/, '') || null }).eq('id', myId() ?? '');
        if (error) throw new Error(/duplicate|unique/i.test(error.message) ? 'Такой ник уже занят' : 'Проверь связь');
        void qc.invalidateQueries({ queryKey: ['me'] });
      } else {
        useProfile.getState().setCard({ status: f.status.trim(), about: f.about.trim(), tags: f.tags.slice(0, 8), instagram: f.instagram.trim() });
      }
      useSession.getState().update({ name });
      setNote({ ok: true, text: 'Сохранено' });
    } catch (e) { setNote({ ok: false, text: e instanceof Error ? e.message : 'Проверь связь' }); }
    finally { setBusy(null); }
  };
  const preview = () => router.push({ pathname: '/person/[id]', params: { id: LIVE ? myId() ?? 'me' : 'me', preview: '1' } });

  if (!f) return <SettingsPage title="Профиль"><ActivityIndicator color={colors.ink} /></SettingsPage>;
  return (
    <SettingsPage title="Мой профиль" sub="Это видят друзья, когда открывают твою страницу.">
      <View style={{ gap: 14 }}>
        <Pressable onPress={() => void pick()} style={styles.photo} accessibilityRole="button" accessibilityLabel="Сменить фото">
          <Avatar p={{ photo: photo ?? src?.photo_url ?? draft.photo, initial: (f.name[0] ?? '·').toUpperCase(), tint: '#D5CFC1' }} size={96} />
          <View style={styles.cam}>{busy === 'photo' ? <ActivityIndicator color={colors.paper} size="small" /> : <Camera size={16} color={colors.paper} strokeWidth={2.2} />}</View>
        </Pressable>

        <Field label="Имя" value={f.name} onChange={(v) => set({ name: v })} max={40} />
        <Field label="Ник" value={f.handle} onChange={(v) => set({ handle: v })} max={24} prefix="@" lower />
        <Field label="Статус под именем" value={f.status} onChange={(v) => set({ status: v })} max={60} placeholder="Например: ищу компанию на выходные" />
        <View style={styles.ideas}>
          {STATUS_IDEAS.map((s) => <Pressable key={s} onPress={() => set({ status: s })} style={styles.idea} accessibilityRole="button"><Sparkles size={12} color={colors.accentText} strokeWidth={2.2} /><Text style={styles.ideaText}>{s}</Text></Pressable>)}
        </View>
        <Field label="О себе" value={f.about} onChange={(v) => set({ about: v })} max={300} multiline placeholder="Пара слов: что любишь, куда зовёшь друзей" />

        <Text style={styles.cap}>ИНТЕРЕСЫ · {f.tags.length} ИЗ 8</Text>
        <View style={styles.chips}>
          {PROFILE_TAGS.map((t) => {
            const on = f.tags.includes(t);
            return (
              <Pressable key={t} onPress={() => set({ tags: on ? f.tags.filter((x) => x !== t) : f.tags.length < 8 ? [...f.tags, t] : f.tags })} style={[styles.chip, on && styles.chipOn]} accessibilityRole="checkbox" accessibilityState={{ checked: on }}>
                {on && <Check size={13} color={colors.paper} strokeWidth={2.6} />}
                <Text style={[styles.chipText, on && { color: colors.paper }]}>{t}</Text>
              </Pressable>
            );
          })}
        </View>
        <Field label="Instagram" value={f.instagram} onChange={(v) => set({ instagram: v })} max={40} prefix="@" lower />

        <Pressable onPress={() => router.push('/profile/level')} style={styles.link} accessibilityRole="button">
          <Text style={styles.linkText}>Рамка и метка на карте</Text><Text style={styles.linkSub}>выбрать</Text>
        </Pressable>

        {note && <Text style={[styles.note, { color: note.ok ? colors.ok : colors.accentText }]}>{note.text}</Text>}
        <Pressable onPress={() => void save()} disabled={!!busy} style={[styles.save, busy === 'save' && { opacity: 0.6 }]} accessibilityRole="button">
          <Text style={styles.saveText}>{busy === 'save' ? 'Сохраняю…' : 'Сохранить'}</Text>
        </Pressable>
        <Pressable onPress={preview} style={styles.preview} accessibilityRole="button">
          <Eye size={18} color={colors.ink} strokeWidth={2} /><Text style={styles.previewText}>Как видят другие</Text>
        </Pressable>
      </View>
    </SettingsPage>
  );
}

function Field({ label, value, onChange, max, multiline, placeholder, prefix, lower }: { label: string; value: string; onChange: (v: string) => void; max: number; multiline?: boolean; placeholder?: string; prefix?: string; lower?: boolean }) {
  return (
    <View style={{ gap: 6 }}>
      <View style={styles.labelRow}><Text style={styles.cap}>{label.toUpperCase()}</Text><Text style={styles.count}>{value.length}/{max}</Text></View>
      <View style={[styles.input, multiline && { minHeight: 96, alignItems: 'flex-start', paddingTop: 12 }]}>
        {prefix && <Text style={styles.prefix}>{prefix}</Text>}
        <TextInput value={prefix ? value.replace(/^@/, '') : value} onChangeText={(v) => onChange(lower ? v.toLowerCase() : v)} maxLength={max} multiline={multiline} placeholder={placeholder}
          placeholderTextColor={colors.muted3} autoCapitalize={lower ? 'none' : 'sentences'} style={[styles.inputText, multiline && { textAlignVertical: 'top' }]} accessibilityLabel={label} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  photo: { alignSelf: 'center', marginBottom: 4 },
  cam: { position: 'absolute', right: 0, bottom: 0, width: 34, height: 34, borderRadius: 17, backgroundColor: colors.ink, borderWidth: 3, borderColor: colors.paper, alignItems: 'center', justifyContent: 'center' },
  cap: { fontFamily: fonts.mono600, fontSize: 10.5, letterSpacing: 0.8, color: colors.muted },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between' },
  count: { fontFamily: fonts.mono500, fontSize: 10.5, color: colors.muted3 },
  input: { flexDirection: 'row', alignItems: 'center', minHeight: 50, paddingHorizontal: 14, borderRadius: 16, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  inputText: { flex: 1, fontFamily: fonts.body500, fontSize: 15.5, color: colors.ink, paddingVertical: 8 },
  prefix: { fontFamily: fonts.body600, fontSize: 15.5, color: colors.muted, marginRight: 2 },
  ideas: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: -6 },
  idea: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 32, paddingHorizontal: 10, borderRadius: 16, backgroundColor: 'rgba(240,82,31,0.08)' },
  ideaText: { fontFamily: fonts.body500, fontSize: 12.5, color: colors.accentText },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 38, paddingHorizontal: 14, borderRadius: 19, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line2 },
  chipOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { fontFamily: fonts.body600, fontSize: 13.5, color: colors.ink },
  link: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 52, paddingHorizontal: 16, borderRadius: 16, backgroundColor: colors.card },
  linkText: { fontFamily: fonts.body600, fontSize: 15, color: colors.ink },
  linkSub: { fontFamily: fonts.body500, fontSize: 14, color: colors.muted },
  note: { fontFamily: fonts.body600, fontSize: 14, textAlign: 'center' },
  save: { minHeight: 54, borderRadius: 18, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  saveText: { fontFamily: fonts.body700, fontSize: 16, color: colors.paper },
  preview: { flexDirection: 'row', gap: 8, minHeight: 50, borderRadius: 18, backgroundColor: colors.sand, alignItems: 'center', justifyContent: 'center' },
  previewText: { fontFamily: fonts.body700, fontSize: 15, color: colors.ink },
});
