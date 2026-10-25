// Новый пост (26 октября): фото (до 10, первое — обложка), подпись, событие (где был — сверху) и отмеченные друзья.
// Открывается из профиля («+»), из сетки и с прошедшего события (?event=id — событие уже выбрано).
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { Check, ImagePlus, X } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { data, eventsSnapshot } from '../../data';
import { photo as photoSrc } from '../../data/photos';
import { createPost, type PostEvent } from '../../live/posts';
import { getPastEvents } from '../../live/profileExtras';
import { useBackClose } from '../../state/app';
import { now as clockNow } from '../../lib/clock';
import { usePlans } from '../../state/plans';
import { colors, fonts } from '../../theme';
import { Avatar } from '../../ui/Avatar';
import { EventIcon } from '../../ui/EventIcon';

const MON = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

export default function NewPost() {
  const { event: event0 } = useLocalSearchParams<{ event?: string }>();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [uris, setUris] = useState<string[]>([]);
  const [caption, setCaption] = useState('');
  const [eventId, setEventId] = useState<string | null>(event0 ?? null);
  const [tags, setTags] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const going = usePlans((s) => s.going);
  const { data: people = [] } = useQuery({ queryKey: ['people'], queryFn: () => data.getPeople() });
  const { data: events = [] } = useQuery({ queryKey: ['events'], queryFn: () => data.getEvents(), placeholderData: eventsSnapshot });
  const past = useQuery({ queryKey: ['me', 'past'], queryFn: getPastEvents });
  const friends = people.filter((p) => p.isFriend);
  // События на выбор: где был (недавние сначала) и куда иду сегодня.
  const now = clockNow().getTime();
  const options: PostEvent[] = [
    ...(past.data ?? []).map((p) => ({ id: p.event_id, title: p.title, category: p.category, starts_at: p.starts_at, venue_name: p.venue_name })),
    ...events.filter((e) => going[e.id] && new Date(e.startsAt).getTime() < now + 12 * 3600e3).map((e) => ({ id: e.id, title: e.title, category: e.category, starts_at: e.startsAt, venue_name: e.venueName ?? null })),
  ].filter((x, i, all) => all.findIndex((y) => y.id === x.id) === i).slice(0, 12);
  const chosen = options.find((o) => o.id === eventId) ?? (eventId ? (() => { const e = events.find((x) => x.id === eventId); return e ? { id: e.id, title: e.title, category: e.category, starts_at: e.startsAt, venue_name: e.venueName ?? null } : null; })() : null);
  const close = () => (router.canGoBack() ? router.back() : router.replace('/me'));
  useBackClose(close);

  const pick = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) { setErr('Разреши доступ к фотографиям в настройках телефона'); return; }
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: 10 - uris.length, quality: 0.85 });
      if (res.canceled) return;
      setUris((u) => [...u, ...res.assets.map((a) => a.uri)].slice(0, 10));
      setErr(null);
    } catch { setErr('Не получилось открыть фото'); }
  };
  const publish = async () => {
    if (!uris.length || busy) return;
    setBusy(true); setErr(null);
    try {
      const id = await createPost({ uris, caption, event: chosen ?? null, tags });
      void qc.invalidateQueries({ queryKey: ['posts'] });
      router.replace({ pathname: '/post/[id]', params: { id } });
    } catch { setErr('Не получилось выложить. Проверь связь и попробуй ещё раз'); }
    finally { setBusy(false); }
  };

  return (
    <View style={styles.root}>
      <View style={[styles.bar, { paddingTop: insets.top + 6 }]}>
        <Pressable onPress={close} style={styles.round} accessibilityRole="button" accessibilityLabel="Закрыть"><X size={24} color={colors.ink} strokeWidth={2.2} /></Pressable>
        <Text style={styles.title}>Новый пост</Text>
        <Pressable onPress={() => void publish()} disabled={!uris.length || busy} style={[styles.pub, (!uris.length || busy) && { opacity: 0.35 }]} accessibilityRole="button" accessibilityLabel="Опубликовать">
          {busy ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.pubText}>Выложить</Text>}
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 18, paddingBottom: insets.bottom + 40 }} keyboardShouldPersistTaps="handled">
        {!uris.length ? (
          <Pressable onPress={() => void pick()} style={({ pressed }) => [styles.pickBig, pressed && { opacity: 0.8 }]} accessibilityRole="button" accessibilityLabel="Выбрать фото">
            <ImagePlus size={40} color={colors.ink} strokeWidth={1.6} />
            <Text style={styles.pickTitle}>Выбери фото</Text>
            <Text style={styles.sub}>До 10 штук — первое станет обложкой</Text>
          </Pressable>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} style={{ marginHorizontal: -16 }}>
            <View style={{ width: 8 }} />
            {uris.map((u, i) => (
              <View key={`${u}-${i}`} style={[styles.thumb, i === 0 && styles.thumbFirst]}>
                <Image source={photoSrc(u)} style={StyleSheet.absoluteFill} contentFit="cover" />
                <Pressable onPress={() => setUris((x) => x.filter((_, k) => k !== i))} style={styles.remove} accessibilityRole="button" accessibilityLabel={`Убрать фото ${i + 1}`} hitSlop={6}><X size={14} color="#FFFFFF" strokeWidth={2.6} /></Pressable>
                {i === 0 && <View style={styles.coverTag}><Text style={styles.coverText}>обложка</Text></View>}
              </View>
            ))}
            {uris.length < 10 && <Pressable onPress={() => void pick()} style={[styles.thumb, styles.addThumb]} accessibilityRole="button" accessibilityLabel="Добавить ещё фото"><ImagePlus size={26} color={colors.ink} strokeWidth={1.8} /></Pressable>}
            <View style={{ width: 8 }} />
          </ScrollView>
        )}

        <TextInput value={caption} onChangeText={setCaption} placeholder="Подпись: как прошло, что запомнилось…" placeholderTextColor={colors.muted3} multiline maxLength={1000}
          style={styles.caption} accessibilityLabel="Подпись" />

        <View style={{ gap: 10 }}>
          <Text style={styles.h}>Событие</Text>
          {chosen && (
            <View style={styles.chosen}>
              <EventIcon e={{ category: chosen.category as never, title: chosen.title, venueName: chosen.venue_name }} size={40} />
              <View style={{ flex: 1 }}><Text style={styles.chosenTitle} numberOfLines={2}>{chosen.title}</Text><Text style={styles.sub}>{new Date(chosen.starts_at).getDate()} {MON[new Date(chosen.starts_at).getMonth()]}{chosen.venue_name ? ` · ${chosen.venue_name}` : ''}</Text></View>
              <Pressable onPress={() => setEventId(null)} style={styles.round} accessibilityRole="button" accessibilityLabel="Открепить событие"><X size={18} color={colors.ink} strokeWidth={2.2} /></Pressable>
            </View>
          )}
          {!chosen && (options.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {options.map((o) => (
                <Pressable key={o.id} onPress={() => setEventId(o.id)} style={styles.opt} accessibilityRole="button" accessibilityLabel={`Прикрепить: ${o.title}`}>
                  <EventIcon e={{ category: o.category as never, title: o.title, venueName: o.venue_name }} size={30} />
                  <View style={{ maxWidth: 150 }}><Text style={styles.optTitle} numberOfLines={1}>{o.title}</Text><Text style={styles.optSub}>{new Date(o.starts_at).getDate()} {MON[new Date(o.starts_at).getMonth()]}</Text></View>
                </Pressable>
              ))}
            </ScrollView>
          ) : <Text style={styles.sub}>Тут появятся события, на которых ты был, — прикрепишь любое.</Text>)}
        </View>

        <View style={{ gap: 10 }}>
          <Text style={styles.h}>Отметить друзей{tags.length ? ` · ${tags.length}` : ''}</Text>
          {friends.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
              {friends.map((f) => {
                const on = tags.includes(f.id);
                return (
                  <Pressable key={f.id} onPress={() => setTags((t) => (on ? t.filter((x) => x !== f.id) : [...t, f.id]))} style={styles.friend} accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={f.name}>
                    <View><Avatar p={f} size={54} ring={on ? colors.accent : undefined} />{on && <View style={styles.check}><Check size={12} color="#FFFFFF" strokeWidth={3} /></View>}</View>
                    <Text style={styles.friendName} numberOfLines={1}>{f.name}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : <Text style={styles.sub}>Когда появятся друзья, их можно будет отметить на фото.</Text>}
        </View>

        {err && <Text style={styles.err}>{err}</Text>}
        <Text style={styles.sub}>Пост увидят друзья (или все — если так выбрано в «Приватности»).</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingBottom: 8 },
  round: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: fonts.display700, fontSize: 18, color: colors.ink },
  pub: { minWidth: 96, height: 40, paddingHorizontal: 16, borderRadius: 20, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  pubText: { fontFamily: fonts.body700, fontSize: 15, color: '#FFFFFF' },
  pickBig: { height: 280, borderRadius: 28, borderWidth: 2, borderStyle: 'dashed', borderColor: colors.line2, alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#FBFAF6' },
  pickTitle: { fontFamily: fonts.display700, fontSize: 19, color: colors.ink },
  sub: { fontFamily: fonts.body400, fontSize: 13.5, lineHeight: 18, color: colors.muted },
  thumb: { width: 150, height: 190, borderRadius: 20, overflow: 'hidden', backgroundColor: colors.sand },
  thumbFirst: { width: 190 },
  addThumb: { width: 110, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.line2, backgroundColor: 'transparent' },
  remove: { position: 'absolute', top: 8, right: 8, width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  coverTag: { position: 'absolute', left: 8, bottom: 8, paddingHorizontal: 8, height: 22, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center' },
  coverText: { fontFamily: fonts.body600, fontSize: 11.5, color: '#FFFFFF' },
  caption: { minHeight: 96, padding: 14, borderRadius: 20, backgroundColor: '#FBFAF6', fontFamily: fonts.body500, fontSize: 16, lineHeight: 22, color: colors.ink, textAlignVertical: 'top' },
  h: { fontFamily: fonts.display700, fontSize: 17, color: colors.ink },
  chosen: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 20, backgroundColor: '#FBFAF6' },
  chosenTitle: { fontFamily: fonts.body700, fontSize: 15, color: colors.ink },
  opt: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 56, paddingHorizontal: 12, borderRadius: 18, backgroundColor: '#FBFAF6' },
  optTitle: { fontFamily: fonts.body600, fontSize: 14, color: colors.ink },
  optSub: { fontFamily: fonts.body500, fontSize: 12, color: colors.muted },
  friend: { alignItems: 'center', gap: 6, width: 60 },
  friendName: { fontFamily: fonts.body600, fontSize: 12.5, color: colors.ink },
  check: { position: 'absolute', right: -2, bottom: -2, width: 22, height: 22, borderRadius: 11, backgroundColor: colors.accent, borderWidth: 2.5, borderColor: colors.paper, alignItems: 'center', justifyContent: 'center' },
  err: { fontFamily: fonts.body600, fontSize: 14, color: colors.accentText, textAlign: 'center' },
});
