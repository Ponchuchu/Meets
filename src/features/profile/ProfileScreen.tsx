// Мой профиль — design/png/V6Profile.png (V6.md §8.1): шапка с QR и «Настройки», «Панель разработчика» для staff,
// три цифры, «Где я был» и «Уровень», значки, список «Друзья · Мои места · Позвать друзей».
import { useQuery } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { router, useFocusEffect } from 'expo-router';
import { ChevronRight, Code2, Footprints, Home, Lock, Moon, Plus, QrCode, Settings, UserPlus, Users, Zap, type LucideIcon } from 'lucide-react-native';
import { useCallback } from 'react';
import { Image, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { useTabInset } from '../../components/TabBar';
import { APP_URL } from '../../lib/config';
import { getMeStats, getProfile, uploadAvatar } from '../../live/api';
import { exploredPct, ALMATY_CELLS } from '../../live/geo';
import { colors, fonts } from '../../theme';
import { OrangeBg } from '../../ui/v6/OrangeBg';

const BADGE: Record<string, { Icon: LucideIcon; bg: string; fg: string }> = {
  walker: { Icon: Footprints, bg: '#2F8F5B', fg: '#FFFFFF' },
  'night-city': { Icon: Moon, bg: colors.ink, fg: '#F7A47E' },
  'call-friend': { Icon: UserPlus, bg: colors.accent, fg: colors.ink },
  'first-bump': { Icon: Zap, bg: '#C98A1B', fg: '#FFFFFF' },
};
const plural = (n: number, a: string, b: string, c: string) => { const m10 = n % 10, m100 = n % 100; return m10 === 1 && m100 !== 11 ? a : m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20) ? b : c; };

function Ring({ value, size, stroke, color, track }: { value: number; size: number; stroke: number; color: string; track: string }) {
  const r = (size - stroke) / 2;
  const len = 2 * Math.PI * r;
  return (
    <Svg width={size} height={size}>
      <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
      <Circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round"
        strokeDasharray={`${Math.max(1, len * Math.min(1, value))} ${len}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
    </Svg>
  );
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const pad = useTabInset();
  const prof = useQuery({ queryKey: ['me', 'profile'], queryFn: () => getProfile() });
  const stats = useQuery({ queryKey: ['me', 'stats'], queryFn: getMeStats, staleTime: 30e3 });
  useFocusEffect(useCallback(() => { void stats.refetch(); }, [])); // eslint-disable-line react-hooks/exhaustive-deps
  const p = prof.data;
  const s = stats.data;
  const name = p?.name ?? '';
  const pct = s ? s.cells.length / ALMATY_CELLS : 0;
  const nextAt = s ? (s.level < 10 ? s.level * 1000 : 10000 + (s.level - 9) * 1500) : 1000;
  const got = s?.badges.filter((b) => b.got).length ?? 0;

  const pickPhoto = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.7 });
    if (!res.canceled && res.assets[0]) { await uploadAvatar(res.assets[0].uri).catch(() => undefined); void prof.refetch(); }
  };
  const invite = () => Share.share({ message: `Я в «рядом.» — карта событий Алматы и друзья рядом. Добавь меня: ${APP_URL}/u/${p?.handle ?? ''}` }).catch(() => undefined);

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: pad + 16 }} showsVerticalScrollIndicator={false}>
      <View style={[styles.hero, { height: 150 + insets.top }]}>
        <OrangeBg />
        <View style={[styles.topBtns, { top: insets.top + 18 }]}>
          <Pressable onPress={() => router.push('/friends')} style={styles.topBtn} accessibilityRole="button" accessibilityLabel="Мой QR-код"><QrCode size={20} color={colors.ink} strokeWidth={1.9} /></Pressable>
          <Pressable onPress={() => router.push('/settings')} style={styles.topBtn} accessibilityRole="button" accessibilityLabel="Настройки"><Settings size={20} color={colors.ink} strokeWidth={1.9} /></Pressable>
        </View>
      </View>
      <View style={styles.sheet}>
        <View style={styles.head}>
          <Pressable onPress={() => void pickPhoto()} style={styles.avatarWrap} accessibilityRole="button" accessibilityLabel="Сменить фото">
            {p?.photo_url ? <Image source={{ uri: p.photo_url }} style={styles.avatar} /> : (
              <View style={[styles.avatar, styles.avatarEmpty]}><Text style={styles.letter}>{(name[0] ?? '·').toUpperCase()}</Text></View>
            )}
            <View style={styles.homeBadge}><Home size={15} color={colors.ink} strokeWidth={2} /></View>
          </Pressable>
          <View style={{ flex: 1, paddingBottom: 6 }}>
            <Text style={styles.name} numberOfLines={1}>{name}</Text>
            <Text style={styles.handle} numberOfLines={1}>{p?.handle ? `@${p.handle}` : ''}</Text>
          </View>
        </View>

        {s?.staff && (
          <Pressable onPress={() => router.push('/dev')} style={({ pressed }) => [styles.dev, pressed && styles.pressed]} accessibilityRole="button">
            <Code2 size={18} color={colors.accent} strokeWidth={2} />
            <Text style={styles.devText}>Панель разработчика</Text>
            {s.drafts > 0 && <Text style={styles.devNew}>{s.drafts} {plural(s.drafts, 'НОВОЕ', 'НОВЫХ', 'НОВЫХ')}</Text>}
          </Pressable>
        )}

        <View style={styles.nums}>
          {[
            { n: s?.friends ?? 0, l: plural(s?.friends ?? 0, 'друг', 'друга', 'друзей'), go: () => router.push('/friends') },
            { n: s?.events ?? 0, l: plural(s?.events ?? 0, 'событие', 'события', 'событий'), go: () => router.navigate('/plans') },
            { n: s?.meetings ?? 0, l: plural(s?.meetings ?? 0, 'встреча', 'встречи', 'встреч'), go: () => router.push('/friends') },
          ].map((x) => (
            <Pressable key={x.l} onPress={x.go} style={({ pressed }) => [styles.num, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel={`${x.n} ${x.l}`}>
              <Text style={styles.numN}>{x.n}</Text>
              <Text style={styles.numL}>{x.l}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.tiles}>
          <Pressable onPress={() => router.navigate('/')} style={({ pressed }) => [styles.tile, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel={`Где я был: ${exploredPct(s?.cells ?? [])} Алматы`}>
            <View style={styles.ringBox}>
              <Ring value={pct} size={46} stroke={5} color={colors.accent} track="#E6E0D4" />
              <Text style={styles.ringText}>{exploredPct(s?.cells ?? []).replace(' ', '').replace(',0', '')}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.tileTitle}>Где я был</Text>
              <Text style={styles.tileSub} numberOfLines={1}>Алматы</Text>
            </View>
          </Pressable>
          <View style={[styles.tile, styles.tileDark]} accessibilityLabel={`Уровень ${s?.level ?? 1}, ${s?.points ?? 0} из ${nextAt} очков`}>
            <View style={styles.ringBox}>
              <Ring value={s ? s.points / nextAt : 0} size={46} stroke={5} color="#F7A47E" track="#3A393F" />
              <Text style={[styles.ringText, { color: '#FBFAF6', fontSize: 16 }]}>{s?.level ?? 1}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.tileTitle, { color: '#FBFAF6' }]}>Уровень {s?.level ?? 1}</Text>
              <Text style={[styles.tileSub, { color: '#BDB8AD' }]} numberOfLines={1} adjustsFontSizeToFit>{s?.points ?? 0} / {nextAt} очков</Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHead}>
            <Text style={styles.cardTitle}>Значки</Text>
            <Text style={styles.cardSub}>{got} из {s?.badges.length ?? 0}</Text>
          </View>
          <View style={styles.badges}>
            {(s?.badges ?? []).slice(0, 4).map((b) => {
              const B = BADGE[b.id] ?? { Icon: Zap, bg: '#E7E2D6', fg: colors.ink };
              return (
                <View key={b.id} style={[styles.badge, { backgroundColor: b.got ? B.bg : '#ECE7DC' }]} accessibilityLabel={`${b.name}${b.got ? ', получен' : `, ${b.progress} из ${b.goal}`}`}>
                  <B.Icon size={24} color={b.got ? B.fg : '#A8A296'} strokeWidth={1.9} />
                </View>
              );
            })}
            <View style={[styles.badge, { backgroundColor: '#ECE7DC' }]}><Lock size={22} color="#BDB6A8" strokeWidth={1.9} /></View>
          </View>
        </View>

        <View style={styles.list}>
          <Row Icon={Users} title="Друзья" value={String(s?.friends ?? 0)} onPress={() => router.push('/friends')} />
          <Row Icon={Home} title="Мои места" value={s?.places.length ? s.places.join(', ') : 'добавить'} onPress={() => router.push('/settings')} />
          <Row Icon={Plus} title="Позвать друзей" value="ссылка" onPress={() => void invite()} last />
        </View>
      </View>
    </ScrollView>
  );
}

function Row({ Icon, title, value, onPress, last }: { Icon: LucideIcon; title: string; value: string; onPress: () => void; last?: boolean }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, !last && styles.rowSep, pressed && { backgroundColor: '#F1EDE4' }]} accessibilityRole="button" accessibilityLabel={`${title}: ${value}`}>
      <Icon size={20} color={colors.ink} strokeWidth={1.8} />
      <Text style={styles.rowTitle}>{title}</Text>
      <Text style={styles.rowValue} numberOfLines={1}>{value}</Text>
      <ChevronRight size={18} color={colors.muted} strokeWidth={2} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  hero: { overflow: 'hidden' },
  topBtns: { position: 'absolute', right: 16, flexDirection: 'row', gap: 8 },
  topBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(251,250,246,0.35)', alignItems: 'center', justifyContent: 'center' },
  sheet: { marginTop: -40, borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: colors.paper, paddingHorizontal: 16, gap: 10 },
  head: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, marginTop: -54, marginBottom: 4 },
  avatarWrap: { width: 108, height: 108, borderRadius: 54, borderWidth: 4, borderColor: colors.paper, backgroundColor: colors.paper },
  avatar: { flex: 1, borderRadius: 50 },
  avatarEmpty: { backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  letter: { fontFamily: fonts.display800, fontSize: 46, color: colors.accent },
  homeBadge: { position: 'absolute', right: -2, bottom: 6, width: 32, height: 32, borderRadius: 16, backgroundColor: '#FBFAF6', borderWidth: 2, borderColor: colors.paper, alignItems: 'center', justifyContent: 'center' },
  name: { fontFamily: fonts.display800, fontSize: 26, letterSpacing: -0.7, color: colors.ink },
  handle: { fontFamily: fonts.body500, fontSize: 14, color: colors.muted },
  dev: { flexDirection: 'row', alignItems: 'center', gap: 12, height: 56, paddingHorizontal: 16, borderRadius: 18, backgroundColor: colors.ink },
  devText: { flex: 1, fontFamily: fonts.body700, fontSize: 15.5, color: '#FBFAF6' },
  devNew: { fontFamily: fonts.mono600, fontSize: 11, letterSpacing: 0.6, color: '#F7A47E' },
  nums: { flexDirection: 'row', gap: 8 },
  num: { flex: 1, borderRadius: 18, backgroundColor: '#FBFAF6', padding: 12, gap: 2 },
  numN: { fontFamily: fonts.display800, fontSize: 24, color: colors.ink },
  numL: { fontFamily: fonts.body500, fontSize: 13, color: colors.muted2 },
  tiles: { flexDirection: 'row', gap: 8 },
  tile: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 18, backgroundColor: '#FBFAF6' },
  tileDark: { backgroundColor: colors.ink },
  ringBox: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center' },
  ringText: { position: 'absolute', fontFamily: fonts.body700, fontSize: 11, color: colors.ink },
  tileTitle: { fontFamily: fonts.display700, fontSize: 15, color: colors.ink },
  tileSub: { fontFamily: fonts.body400, fontSize: 12.5, color: colors.muted2 },
  card: { borderRadius: 20, backgroundColor: '#FBFAF6', padding: 14, gap: 12 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontFamily: fonts.display700, fontSize: 17, color: colors.ink },
  cardSub: { fontFamily: fonts.body500, fontSize: 13, color: colors.muted },
  badges: { flexDirection: 'row', gap: 10 },
  badge: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  list: { borderRadius: 20, backgroundColor: '#FBFAF6', overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 56, paddingHorizontal: 16 },
  rowSep: { borderBottomWidth: 1, borderBottomColor: '#ECE7DC' },
  rowTitle: { flex: 1, fontFamily: fonts.body700, fontSize: 15.5, color: colors.ink },
  rowValue: { fontFamily: fonts.body400, fontSize: 14, color: colors.muted2, maxWidth: 160 },
  pressed: { transform: [{ scale: 0.98 }] },
});
