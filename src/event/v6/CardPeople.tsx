// «Кто идёт» — design/png/V6CardPeople.png (V6.md §4.3): друзья идут · Позвать; ищут компанию · «Пойдём?» → «Ждём»;
// «Я тоже ищу компанию» с мягким пульсом — тебя увидят только те, кто идёт сюда.
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Hand, Plus } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import type { EventItem } from '../../data/types';
import { askCompany, getWhoGoes, setLooking } from '../../live/api';
import { colors, fonts } from '../../theme';

function Face({ url, name, size }: { url: string | null; name: string; size: number }) {
  return url ? <Image source={{ uri: url }} style={{ width: size, height: size, borderRadius: size / 2 }} /> : (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: '#B9A8E8', alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontFamily: fonts.display700, fontSize: size * 0.4, color: colors.ink }}>{name[0]?.toUpperCase()}</Text>
    </View>
  );
}

export function CardPeople({ e, going, onGo, onInvite, onError }: {
  e: EventItem; going: boolean; onGo: () => void; onInvite: () => void; onError: (t: string) => void;
}) {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['who', e.id], queryFn: () => getWhoGoes(e.id) });
  const [asked, setAsked] = useState<Record<string, boolean>>({});
  const [confirm, setConfirm] = useState(false);
  const pulse = useSharedValue(1);
  useEffect(() => { pulse.set(withRepeat(withSequence(withTiming(1.03, { duration: 900 }), withTiming(1, { duration: 900 })), -1)); }, [pulse]);
  const pulseSt = useAnimatedStyle(() => ({ transform: [{ scale: pulse.get() }] }));
  const iLook = !!data?.iLook;

  const toggleLook = async () => {
    if (!iLook && !going && !confirm) { setConfirm(true); return; }
    if (!iLook && !going) onGo();
    setConfirm(false);
    qc.setQueryData(['who', e.id], (old: typeof data) => (old ? { ...old, iLook: !iLook } : old));
    await setLooking(e.id, !iLook).catch(() => { onError('Не получилось. Проверь связь'); void qc.invalidateQueries({ queryKey: ['who', e.id] }); });
  };
  const ask = async (id: string) => {
    setAsked((a) => ({ ...a, [id]: true }));
    await askCompany(id, e.title).catch(() => { setAsked((a) => ({ ...a, [id]: false })); onError('Пока нельзя написать: лимит новых разговоров или человек закрыл сообщения'); });
  };

  const friends = data?.friends ?? [];
  const lookers = data?.lookers ?? [];
  return (
    <View style={{ gap: 14 }}>
      <Text style={styles.title} accessibilityRole="header" numberOfLines={2}>{e.title} · кто идёт</Text>
      <Text style={styles.cap}>ДРУЗЬЯ ИДУТ · {friends.length}</Text>
      <View style={styles.friends}>
        {friends.slice(0, 6).map((p) => (
          <View key={p.id} style={styles.friend}>
            <View>
              <Face url={p.photo_url} name={p.name} size={58} />
              <View style={styles.ok}><Check size={11} color="#FFFFFF" strokeWidth={3.2} /></View>
            </View>
            <Text style={styles.friendName} numberOfLines={1}>{p.name}</Text>
          </View>
        ))}
        <Pressable onPress={onInvite} style={styles.friend} accessibilityRole="button" accessibilityLabel="Позвать друзей">
          <View style={styles.plus}><Plus size={24} color={colors.ink} strokeWidth={2} /></View>
          <Text style={styles.friendName}>Позвать</Text>
        </Pressable>
      </View>

      {lookers.length > 0 && (
        <>
          <View style={styles.capRow}><Hand size={14} color={colors.accent} strokeWidth={2} /><Text style={styles.cap}>ИЩУТ КОМПАНИЮ · {lookers.length}</Text></View>
          {lookers.map((l) => (
            <View key={l.id} style={styles.row}>
              <Face url={l.photo_url} name={l.name} size={48} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.name}>{l.name}</Text>
                <Text style={styles.sub} numberOfLines={2}>{asked[l.id] ? 'запрос отправлен' : l.note || (l.friend ? 'твой друг' : 'тоже идёт сюда')}</Text>
              </View>
              {asked[l.id] ? (
                <View style={[styles.btn, { backgroundColor: '#E7E2D6' }]}><Text style={[styles.btnText, { color: colors.muted2 }]}>Ждём</Text></View>
              ) : (
                <Pressable onPress={() => void ask(l.id)} style={({ pressed }) => [styles.btn, pressed && { transform: [{ scale: 0.96 }] }]} accessibilityRole="button" accessibilityLabel={`Пойдём? ${l.name}`}>
                  <Text style={styles.btnText}>Пойдём?</Text>
                </Pressable>
              )}
            </View>
          ))}
        </>
      )}

      <Animated.View style={iLook ? null : pulseSt}>
        <Pressable onPress={() => void toggleLook()} style={({ pressed }) => [styles.look, iLook && styles.lookOn, pressed && { transform: [{ scale: 0.98 }] }]} accessibilityRole="button" accessibilityState={{ selected: iLook }}>
          <Hand size={22} color={iLook ? colors.ink : colors.accent} strokeWidth={2} />
          <Text style={[styles.lookText, iLook && { color: colors.ink }]}>{iLook ? 'Ты ищешь компанию · Убрать' : confirm ? 'Сначала отметим «Пойду» — нажми ещё раз' : 'Я тоже ищу компанию'}</Text>
        </Pressable>
      </Animated.View>
      <Text style={styles.note}>Тебя увидят только те, кто идёт сюда</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: fonts.display800, fontSize: 23, letterSpacing: -0.6, color: colors.ink },
  cap: { fontFamily: fonts.mono600, fontSize: 11, letterSpacing: 0.9, color: colors.muted },
  capRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  friends: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  friend: { alignItems: 'center', gap: 6, width: 66 },
  friendName: { fontFamily: fonts.body700, fontSize: 14, color: colors.ink },
  ok: { position: 'absolute', right: -2, bottom: -2, width: 22, height: 22, borderRadius: 11, backgroundColor: colors.ok, borderWidth: 2.5, borderColor: '#FBFAF6', alignItems: 'center', justifyContent: 'center' },
  plus: { width: 58, height: 58, borderRadius: 29, backgroundColor: '#E7E2D6', alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 18, backgroundColor: '#EFEBE1' },
  name: { fontFamily: fonts.display700, fontSize: 15.5, color: colors.ink },
  sub: { fontFamily: fonts.body400, fontSize: 13, color: colors.muted2 },
  btn: { height: 38, paddingHorizontal: 14, borderRadius: 12, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', minWidth: 86 },
  btnText: { fontFamily: fonts.body700, fontSize: 14, color: colors.ink },
  look: { height: 58, borderRadius: 18, backgroundColor: colors.ink, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 14 },
  lookOn: { backgroundColor: '#FBDCCB' },
  lookText: { fontFamily: fonts.body700, fontSize: 16, color: colors.paper, flexShrink: 1 },
  note: { fontFamily: fonts.body400, fontSize: 13, color: colors.muted, textAlign: 'center', marginTop: -6 },
});
