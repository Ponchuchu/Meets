// Шаги с друзьями (FIX3, просьба владельца): рейтинг «сегодня / неделя» и соревнования «кто больше» или «кто первым до цели».
// Друзья видят твои шаги, пока включено «Показывать мои шаги друзьям» (profiles.steps_visible).
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Crown, Swords, Trophy, X } from 'lucide-react-native';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { data } from '../../data';
import { answerChallenge, createChallenge, getChallenges, getFriendsSteps, type Challenge } from '../../live/profileExtras';
import { AvatarFrame } from '../../profile/frames';
import { challengeState, rankTone } from '../../profile/stepsSocial';
import { colors, fonts, radii } from '../../theme';
import { Avatar } from '../../ui/Avatar';
import { plate } from '../../ui/glass';

const fmt = (n: number) => n.toLocaleString('ru-RU');
const todayKey = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Almaty' });
const initialOf = (name: string) => (name[0] ?? '·').toUpperCase();

export function StepsLeaderboard() {
  const [period, setPeriod] = useState<'today' | 'week'>('week');
  const q = useQuery({ queryKey: ['steps', 'friends'], queryFn: getFriendsSteps, staleTime: 60e3, refetchInterval: 120e3 });
  const rows = [...(q.data ?? [])].sort((a, b) => b[period] - a[period]);
  const top = Math.max(1, rows[0]?.[period] ?? 1);
  const myPlace = rows.findIndex(r => r.me) + 1;
  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Trophy size={20} color="#E2A21B" strokeWidth={2} />
        <Text style={styles.title}>Друзья</Text>
        <View style={styles.seg}>
          {(['today', 'week'] as const).map(p => (
            <Pressable key={p} onPress={() => setPeriod(p)} style={[styles.segBtn, period === p && styles.segOn]} accessibilityRole="tab" accessibilityState={{ selected: period === p }}>
              <Text style={[styles.segText, period === p && { color: colors.paper }]}>{p === 'today' ? 'Сегодня' : 'Неделя'}</Text>
            </Pressable>
          ))}
        </View>
      </View>
      {myPlace > 0 && rows.length > 1 && <Text style={styles.sub}>{myPlace === 1 ? 'Ты впереди всех — держи темп' : `Ты ${myPlace}-й. До ${rows[myPlace - 2].name} — ${fmt(rows[myPlace - 2][period] - rows[myPlace - 1][period])} шагов`}</Text>}
      {rows.length <= 1 && !q.isPending && <Text style={styles.sub}>Добавь друзей — и здесь появится ваш рейтинг.</Text>}
      {q.isError && <Text style={[styles.sub, { color: colors.accentText }]}>Рейтинг не загрузился. Проверь связь.</Text>}
      {rows.map((r, i) => (
        <View key={r.user_id} style={[styles.rank, r.me && styles.rankMe]}>
          <View style={[styles.place, rankTone(i) ? { backgroundColor: rankTone(i)! } : null]}>
            {i === 0 ? <Crown size={14} color="#FFFFFF" strokeWidth={2.4} /> : <Text style={[styles.placeText, rankTone(i) ? { color: '#FFFFFF' } : null]}>{i + 1}</Text>}
          </View>
          <AvatarFrame frameId={r.map_frame} shape={r.map_shape} photo={r.photo_url} initial={initialOf(r.name)} size={40} animate={false} />
          <View style={{ flex: 1, gap: 5 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
              <Text style={styles.name} numberOfLines={1}>{r.me ? 'Ты' : r.name}</Text>
              <Text style={styles.steps}>{fmt(r[period])}</Text>
            </View>
            <View style={styles.track}><View style={[styles.fill, { width: `${(r[period] / top) * 100}%`, backgroundColor: r.me ? colors.accent : i === 0 ? '#E2A21B' : colors.ok }]} /></View>
          </View>
        </View>
      ))}
    </View>
  );
}

export function StepsChallenges() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['steps', 'challenges'], queryFn: getChallenges, staleTime: 60e3 });
  const [making, setMaking] = useState(false);
  const [error, setError] = useState('');
  const list = q.data ?? [];
  const refresh = () => qc.invalidateQueries({ queryKey: ['steps', 'challenges'] });
  const answer = (c: Challenge, ok: boolean) => { setError(''); void answerChallenge(c.id, ok).then(refresh).catch(() => setError('Не получилось ответить. Проверь связь')); };

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Swords size={20} color={colors.accent} strokeWidth={2} />
        <Text style={styles.title}>Соревнования</Text>
      </View>
      {!list.length && !q.isPending && <Text style={styles.sub}>Позови друзей: кто больше пройдёт за неделю или кто первым наберёт 100 000.</Text>}
      {list.map(c => {
        const st = challengeState(c, todayKey());
        return (
          <View key={c.id} style={[styles.challenge, st.finished && { opacity: 0.85 }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
              <Text style={styles.chTitle} numberOfLines={1}>{c.title}</Text>
              <Text style={[styles.chLabel, st.finished && { color: '#B8860B' }]}>{st.label}</Text>
            </View>
            {st.joined.map((m, i) => (
              <View key={m.user_id} style={styles.member}>
                <Avatar p={{ photo: m.photo_url, initial: initialOf(m.name), tint: '#D5CFC1' }} size={28} />
                <Text style={styles.mName} numberOfLines={1}>{m.name}</Text>
                <View style={[styles.track, { flex: 1 }]}><View style={[styles.fill, { width: `${st.share(m.steps) * 100}%`, backgroundColor: i === 0 ? '#E2A21B' : colors.ok }]} /></View>
                <Text style={styles.mSteps}>{fmt(m.steps)}</Text>
              </View>
            ))}
            {c.members.some(m => m.status === 'invited') && <Text style={styles.wait}>Ждём ответа: {c.members.filter(m => m.status === 'invited').map(m => m.name).join(', ')}</Text>}
            {c.my_status === 'invited' && (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Pressable onPress={() => answer(c, false)} style={[styles.btn, styles.btnGhost]} accessibilityRole="button"><Text style={[styles.btnText, { color: colors.ink }]}>Не сейчас</Text></Pressable>
                <Pressable onPress={() => answer(c, true)} style={styles.btn} accessibilityRole="button"><Text style={styles.btnText}>Принять вызов</Text></Pressable>
              </View>
            )}
          </View>
        );
      })}
      {!!error && <Text style={{ color: colors.accentText }}>{error}</Text>}
      <Pressable onPress={() => setMaking(true)} style={styles.btn} accessibilityRole="button"><Text style={styles.btnText}>Устроить соревнование</Text></Pressable>
      {making && <CreateChallenge onClose={() => setMaking(false)} onDone={() => { setMaking(false); void refresh(); }} />}
    </View>
  );
}

const MODES = [
  { id: 'd1', label: 'Кто больше сегодня', kind: 'most' as const, days: 1 },
  { id: 'd3', label: 'Кто больше за 3 дня', kind: 'most' as const, days: 3 },
  { id: 'd7', label: 'Кто больше за неделю', kind: 'most' as const, days: 7 },
  { id: 'g50', label: 'Первым до 50 000', kind: 'goal' as const, days: 7, goal: 50000 },
  { id: 'g100', label: 'Первым до 100 000', kind: 'goal' as const, days: 14, goal: 100000 },
];

function CreateChallenge({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { data: people = [] } = useQuery({ queryKey: ['people'], queryFn: () => data.getPeople() });
  const friends = people.filter(p => p.isFriend);
  const [picked, setPicked] = useState<string[]>([]);
  const [mode, setMode] = useState('d7');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const m = MODES.find(x => x.id === mode)!;
  const go = async () => {
    if (busy || !picked.length) return;
    setBusy(true); setError('');
    try { await createChallenge({ friends: picked, days: m.days, kind: m.kind, goal: 'goal' in m ? m.goal : undefined }); onDone(); }
    catch { setError('Не получилось создать. Проверь связь'); }
    finally { setBusy(false); }
  };
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.back}>
        <View style={styles.sheet}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={[styles.title, { flex: 1, fontSize: 21 }]}>Новое соревнование</Text>
            <Pressable onPress={onClose} style={styles.close} accessibilityRole="button" accessibilityLabel="Закрыть"><X size={22} color={colors.ink} /></Pressable>
          </View>
          <Text style={styles.cap}>ЧТО ДЕЛАЕМ</Text>
          <View style={styles.chips}>
            {MODES.map(x => <Pressable key={x.id} onPress={() => setMode(x.id)} style={[styles.chip, mode === x.id && styles.chipOn]} accessibilityRole="radio" accessibilityState={{ selected: mode === x.id }}>
              <Text style={[styles.chipText, mode === x.id && { color: colors.paper }]}>{x.label}</Text>
            </Pressable>)}
          </View>
          <Text style={styles.cap}>С КЕМ · ДО 10 ДРУЗЕЙ</Text>
          {!friends.length && <Text style={styles.sub}>Сначала добавь друзей.</Text>}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
            {friends.map(f => {
              const on = picked.includes(f.id);
              return <Pressable key={f.id} onPress={() => setPicked(on ? picked.filter(x => x !== f.id) : [...picked, f.id].slice(0, 10))} style={[styles.friend, on && styles.friendOn]} accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={f.name}>
                <Avatar p={f} size={48} />
                <Text style={styles.friendName} numberOfLines={1}>{f.name}</Text>
              </Pressable>;
            })}
          </ScrollView>
          {!!error && <Text style={{ color: colors.accentText }}>{error}</Text>}
          <Pressable disabled={!picked.length || busy} onPress={() => void go()} style={[styles.btn, (!picked.length || busy) && { opacity: 0.4 }]} accessibilityRole="button">
            <Text style={styles.btnText}>{busy ? 'Зову…' : picked.length ? `Бросить вызов · ${picked.length}` : 'Выбери друзей'}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radii.xl - 4, ...plate, padding: 16, gap: 12 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1, fontFamily: fonts.display700, fontSize: 18, color: colors.ink },
  sub: { fontFamily: fonts.body400, fontSize: 13.5, lineHeight: 19, color: colors.muted },
  seg: { flexDirection: 'row', padding: 3, borderRadius: 12, backgroundColor: colors.sand },
  segBtn: { minHeight: 34, paddingHorizontal: 10, borderRadius: 9, justifyContent: 'center' },
  segOn: { backgroundColor: colors.ink },
  segText: { fontFamily: fonts.body700, fontSize: 12.5, color: colors.ink },
  rank: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 8, borderRadius: 16 },
  rankMe: { backgroundColor: 'rgba(240,82,31,0.08)' },
  place: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.sand },
  placeText: { fontFamily: fonts.mono600, fontSize: 11.5, color: colors.muted2 },
  name: { flex: 1, fontFamily: fonts.body700, fontSize: 14.5, color: colors.ink },
  steps: { fontFamily: fonts.mono600, fontSize: 12.5, color: colors.ink },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.sand, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
  challenge: { gap: 9, padding: 12, borderRadius: 18, backgroundColor: '#F7F3EB', borderWidth: 1, borderColor: colors.line },
  chTitle: { flex: 1, fontFamily: fonts.display700, fontSize: 15.5, color: colors.ink },
  chLabel: { fontFamily: fonts.mono600, fontSize: 11, color: colors.accentText },
  member: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  mName: { width: 70, fontFamily: fonts.body600, fontSize: 13, color: colors.ink },
  mSteps: { minWidth: 54, textAlign: 'right', fontFamily: fonts.mono600, fontSize: 11.5, color: colors.muted2 },
  wait: { fontFamily: fonts.body400, fontSize: 12.5, color: colors.muted },
  btn: { flex: 1, minHeight: 50, borderRadius: 16, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  btnGhost: { backgroundColor: colors.sand },
  btnText: { fontFamily: fonts.body700, fontSize: 15, color: colors.paper },
  back: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(23,22,26,0.4)' },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: colors.paper, padding: 18, paddingBottom: 34, gap: 12 },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  cap: { fontFamily: fonts.mono600, fontSize: 10.5, letterSpacing: 0.8, color: colors.muted },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 42, paddingHorizontal: 14, borderRadius: 21, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line2, justifyContent: 'center' },
  chipOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { fontFamily: fonts.body600, fontSize: 13.5, color: colors.ink },
  friend: { width: 76, alignItems: 'center', gap: 6, paddingVertical: 8, borderRadius: 18, borderWidth: 1.5, borderColor: 'transparent' },
  friendOn: { borderColor: colors.accent, backgroundColor: 'rgba(240,82,31,0.08)' },
  friendName: { fontFamily: fonts.body600, fontSize: 12, color: colors.ink },
});
