// Мой профиль (FIX3 Ф7, решение владельца 20 октября). Без оранжевой шапки: мягкое свечение цвета рамки за аватаркой.
// Сверху справа: панель разработчика (только команда) · QR · настройки. Под именем — до трёх наград, выбранных в «Наградах».
// Сетка: Друзья · Уровень / Где я был · Шаги (10 000 в день, считаются всегда). Ниже — «Награды», «Воспоминания»,
// «Мои места» и «Ночёвки». «События и встречи» и «Хроника» убраны: прошедшие события живут в «Воспоминаниях».
import { useQuery } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { router, useFocusEffect } from 'expo-router';
import { ActivityBell } from '../activity/ActivityBell';
import { BedDouble, Cake, CalendarDays, Camera, ChevronRight, Code2, Eye, Footprints, Home, Map as MapIcon, PenLine, QrCode, Route, Settings, UserPlus, type LucideIcon } from 'lucide-react-native';
import { goAwards, goLevel, Showcase } from './Showcase';
import { GlassBtn, HeroChip, kit, PhotoHero, StatsCard } from './ProfileKit';
import { EmptyRow, FriendsPill, PlansStrip } from './PlansStrip';
import { PostsGrid } from '../posts/PostsGrid';
import { getPosts } from '../../live/posts';
import { birthdayText } from '../../lib/format';
import { planWhen } from '../../lib/planWhen';
import { now as clockNow } from '../../lib/clock';
import { usePlans } from '../../state/plans';
import { eventsSnapshot , data } from '../../data';
import { memo, useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { useTabInset } from '../../components/TabBar';
import { config } from '../../lib/config';
import { getMeStats, getMyPhotos, getProfile, uploadAvatar } from '../../live/api';
import { exploredPct, ALMATY_CELLS } from '../../live/geo';
import { getProfileExtras, getSleepovers, learnMyPlaces } from '../../live/profileExtras';
import { STEP_GOAL, stepHistory, stepsToday, useSteps } from '../../live/steps';
import { stepAwards } from '../../profile/stepAwards';
import { useSession } from '../../state/session';
import { useMapState } from '../../state/map';
import { colors, fonts, radii } from '../../theme';
import { BadgeMedal } from '../../ui/BadgeMedal';
import { frameById } from '../../profile/frames';
import { useProfile } from '../../state/profile';
import { plate } from '../../ui/glass';

const plural = (n: number, a: string, b: string, c: string) => { const m10 = n % 10, m100 = n % 100; return m10 === 1 && m100 !== 11 ? a : m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20) ? b : c; };
const LIVE = config.dataMode !== 'demo';
const DEMO_STATS = { friends: 4, level: 3, points: 2140, cells: Array.from({ length: 23 }, (_, i) => `d${i}`), badges: [
  { id: 'opener', name: 'Открыватель', goal: 1, progress: 1, got: true }, { id: 'night', name: 'Ночная смена', goal: 3, progress: 3, got: true },
  { id: 'jazz', name: 'Джазмен', goal: 3, progress: 2, got: false }, { id: 'laugh', name: 'Смешинка', goal: 3, progress: 1, got: false },
  { id: 'above', name: 'Выше города', goal: 1, progress: 0, got: false }], places: ['дом', 'работа'], staff: true, drafts: 4 };

/** Свечение за аватаркой — цвет выбранной рамки, мягко растворяется в бумаге. */
export const Aura = memo(function Aura({ color, height }: { color: string; height: number }) {
  return (
    <Svg style={StyleSheet.absoluteFill} width="100%" height={height} pointerEvents="none">
      <Defs>
        <RadialGradient id="aura" cx="50%" cy="58%" rx="62%" ry="60%">
          <Stop offset="0" stopColor={color} stopOpacity={0.34} />
          <Stop offset="0.55" stopColor={color} stopOpacity={0.1} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height={height} fill="url(#aura)" />
    </Svg>
  );
});

export default function ProfileScreen() {
  const pad = useTabInset();
  const draft = useSession((s) => s.draft);
  const demoFrame = useProfile(s => s.mapFrame);
  const demoShape = useProfile(s => s.mapShape);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const prof = useQuery({ queryKey: ['me', 'profile'], queryFn: () => getProfile(), enabled: LIVE });
  // Статус под именем (миграция 46); база ещё без колонки — просто без статуса.
  const stats = useQuery({ queryKey: ['me', 'stats'], queryFn: getMeStats, enabled: LIVE, staleTime: 30e3 });
  const extras = useQuery({ queryKey: ['me', 'extras'], queryFn: getProfileExtras });
  const postsQ = useQuery({ queryKey: ['posts', 'me'], queryFn: () => getPosts() });
  const myPosts = postsQ.data ?? [];
  const sleeps = useQuery({ queryKey: ['me', 'sleepovers'], queryFn: () => getSleepovers() });
  const { data: people = [] } = useQuery({ queryKey: ['people'], queryFn: () => data.getPeople() });
  const steps = useSteps(st => (LIVE ? stepsToday(st) : 6240));
  const stepDays = useQuery({ queryKey: ['me', 'steps'], queryFn: stepHistory, enabled: LIVE, staleTime: 60e3 });
  useFocusEffect(useCallback(() => { if (LIVE) { void stats.refetch(); void prof.refetch(); } }, [])); // eslint-disable-line react-hooks/exhaustive-deps
  // «Мои места» сами: раз за запуск спрашиваем сервер — он сам найдёт дом, работу или учёбу и ночёвки.
  useEffect(() => { void learnMyPlaces().then(r => { if (r && (r.places || r.sleepovers)) { void stats.refetch(); void sleeps.refetch(); } }).catch(() => undefined); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const p = prof.data;
  const now = clockNow();
  const going = usePlans((x) => x.going);
  const { data: events = [] } = useQuery({ queryKey: ['events'], queryFn: () => data.getEvents(), placeholderData: eventsSnapshot });
  const { data: spots = [] } = useQuery({ queryKey: ['friendSpots'], queryFn: () => data.getFriendSpots() });
  // Мои планы: на что я иду, ближайшие сначала; прошедшие не показываем.
  const myPlansAll = events.filter((e) => going[e.id] && new Date(e.endsAt ?? e.startsAt).getTime() > now.getTime() - 3 * 3600e3)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const myPlansTotal = myPlansAll.length;
  const myPlans = myPlansAll.slice(0, 8)
    .map((e) => { const w = planWhen(e, now); return { key: e.id, title: e.title, when: (w.today ? w.text.split(' · ')[1] : w.text.split(' · ')[0]).toLowerCase(), today: w.today, e, eventId: e.id }; });
  const myPhotosQ = useQuery({ queryKey: ['me', 'photos'], queryFn: getMyPhotos, enabled: LIVE });
  const demoPhotos = useProfile((x) => x.photos);
  const photos = LIVE ? myPhotosQ.data?.photos ?? (p?.photo_url ? [p.photo_url] : []) : demoPhotos.length ? demoPhotos : draft.photo ? [draft.photo] : [];
  const birthday = birthdayText(LIVE ? myPhotosQ.data?.birth : draft.birthDate);
  const s = LIVE ? stats.data : DEMO_STATS;
  const name = p?.name?.trim() || draft.name?.trim() || 'Твой профиль';
  const frameId = LIVE ? p?.map_frame : demoFrame;
  const frame = frameById(frameId);
  const level = s?.level ?? 1;
  const points = s?.points ?? 0;
  const nextAt = level <= 10 ? level * 1000 : 10000 + (level - 10) * 1500;
  const pct = s ? s.cells.length / ALMATY_CELLS : 0;
  const km = String(Math.round(((stepDays.data ?? []).reduce((a, d) => a + d.steps, 0) + steps) * 0.00075 * 10) / 10 || (LIVE ? 0 : 42.7));
  const walk = stepAwards(stepDays.data ?? [], { day: new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Almaty' }), steps });
  const allBadges = [...walk, ...(s?.badges ?? [])];
  const got = allBadges.filter((b) => b.got);
  const shown = (extras.data?.shown ?? []).slice(0, 1);
  const friends = people.filter(x => x.isFriend);
  const onMap = friends.filter((f) => spots.some((x) => x.personId === f.id)).length;
  const friendCount = LIVE ? s?.friends ?? friends.length : friends.length;
  const nights = sleeps.data ?? [];

  const pickPhoto = async () => {
    if (uploading) return;
    setPhotoError(null);
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) { setPhotoError('Разреши доступ к фотографиям в настройках телефона'); return; }
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.85 });
      if (res.canceled || !res.assets[0]) return;
      setUploading(true);
      const url = LIVE ? await uploadAvatar(res.assets[0].uri) : res.assets[0].uri;
      useSession.getState().update({ photo: url });
      if (LIVE) await prof.refetch();
    } catch (e) { setPhotoError(`Не удалось сохранить фото: ${e instanceof Error ? e.message : 'проверь связь'}`); }
    finally { setUploading(false); }
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: pad + 16 }} showsVerticalScrollIndicator={false}>
      <PhotoHero photos={photos} initial={(name[0] ?? '·').toUpperCase()} tint="#D5CFC1" accent={frame.color} name={name}
        photoLabel="Добавить фото" onPhoto={() => void pickPhoto()} viewerAction={{ label: 'Изменить фото', onPress: () => router.push('/profile/edit') }}
        nameExtra={shown.map((id) => <BadgeMedal key={id} id={id} got size={34} />)}
        top={<>
          <View style={styles.topRow}>
            {s?.staff && (
              <GlassBtn onPress={() => router.push('/dev')} label={`Панель разработчика${s.drafts ? `, новых: ${s.drafts}` : ''}`}
                badge={s.drafts > 0 ? <View style={styles.topDot}><Text style={styles.topDotText}>{s.drafts > 99 ? '99+' : s.drafts}</Text></View> : undefined}>
                <Code2 size={20} color="#FFFFFF" strokeWidth={1.9} />
              </GlassBtn>
            )}
          </View>
          <View style={styles.topRow}>
            <ActivityBell style={styles.topBtn} dot={styles.topDot} dotText={styles.topDotText} color="#FFFFFF" />
            <GlassBtn onPress={() => router.push('/profile/qr')} label="Мой QR-код"><QrCode size={20} color="#FFFFFF" strokeWidth={1.9} /></GlassBtn>
            <GlassBtn onPress={() => router.push('/settings')} label="Настройки"><Settings size={20} color="#FFFFFF" strokeWidth={1.9} /></GlassBtn>
          </View>
        </>}
        meta={<>
          {!!p?.handle && <HeroChip>{`@${p.handle}`}</HeroChip>}
          {!photos.length && <Pressable onPress={() => void pickPhoto()} accessibilityRole="button"><HeroChip icon={<Camera size={14} color="#FFFFFF" strokeWidth={2.1} />}>добавь фото</HeroChip></Pressable>}
          {!!birthday && <HeroChip icon={<Cake size={14} color="#FFFFFF" strokeWidth={2.1} />}>{birthday}</HeroChip>}
          <Pressable onPress={goLevel} accessibilityRole="button"><HeroChip>{`уровень ${level}`}</HeroChip></Pressable>
          {!shown.length && <Pressable onPress={() => router.push('/profile/awards')} accessibilityRole="button"><HeroChip>+ награда к имени</HeroChip></Pressable>}
        </>} />

      <View style={kit.actions}>
        <Pressable onPress={() => router.push('/profile/edit')} style={({ pressed }) => [kit.primary, pressed && styles.pressed]} accessibilityRole="button">
          <PenLine size={18} color="#FFFFFF" strokeWidth={2} /><Text style={kit.primaryText}>Редактировать профиль</Text>
        </Pressable>
        <Pressable onPress={() => router.push({ pathname: '/person/[id]', params: { id: LIVE ? p?.id ?? 'me' : 'me', preview: '1' } })} style={({ pressed }) => [kit.square, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel="Как видят другие">
          <Eye size={20} color={colors.ink} strokeWidth={2} />
        </Pressable>
      </View>

      <View style={[styles.body, { paddingTop: 12 }]}>
        {photoError && <Text style={{ color: colors.accentText }}>{photoError}</Text>}
        {uploading && <Text style={{ color: colors.muted }}>Сохраняю фото…</Text>}

        {/* Друзья — одной строкой, планы — лентой вбок, ниже плитки (bento): шаги и город, витрина наград. */}
        {/* Друзья: нет никого — зовём найти; много — лица и «+N». */}
        {friendCount ? (
          <FriendsPill faces={friends} total={friendCount} onPress={() => router.push('/friends')} title={`${friendCount} ${plural(friendCount, 'друг', 'друга', 'друзей')}`}
            sub={onMap ? `${onMap} сейчас на карте` : 'посмотреть всех'} />
        ) : (
          <EmptyRow icon={<UserPlus size={20} color={colors.ink} strokeWidth={1.9} />} text="Друзей пока нет. Добавь по номеру, QR-коду или рядом" action="Найти" onAction={() => router.push('/friends')} />
        )}

        <PlansStrip title="Мои планы" items={myPlans} total={myPlansTotal} onAll={() => router.navigate('/plans')}
          empty={<EmptyRow icon={<CalendarDays size={20} color={colors.ink} strokeWidth={1.9} />} text="Планов пока нет. Свайпни пару событий в «Для тебя»" action="Смотреть" onAction={() => router.navigate('/foryou')} />} />

        <StatsCard items={[
          { key: 'steps', icon: <Footprints size={19} color={colors.ok} strokeWidth={2} />, value: steps.toLocaleString('ru-RU'), label: 'шагов сегодня', progress: steps / STEP_GOAL, color: colors.ok, onPress: () => router.push('/profile/steps') },
          { key: 'km', icon: <Route size={19} color={colors.friend} strokeWidth={2} />, value: km.replace('.', ','), label: 'км пешком', color: colors.friend, onPress: () => router.push('/profile/steps') },
          { key: 'city', icon: <MapIcon size={19} color={colors.accentText} strokeWidth={2} />, value: exploredPct(s?.cells ?? []).replace(' ', ''), label: 'Алматы открыто', progress: pct, color: colors.accent, onPress: () => { useMapState.getState().setLens('explore'); router.navigate('/'); } },
        ]} />

        <Showcase level={level} points={points} nextAt={nextAt} badges={allBadges} total={allBadges.length} stats={[]} onLevel={goLevel} onAwards={goAwards} />

        <View style={styles.list}>
          <Row Icon={Home} title="Мои места" value={s?.places.length ? s.places.join(', ') : 'найдём сами'} onPress={() => router.push('/settings/places')} />
          <Row Icon={BedDouble} title="Ночёвки" value={nights.length ? `${nights.length} ${plural(nights.length, 'ночь', 'ночи', 'ночей')}` : 'пока нет'} onPress={() => router.push('/profile/sleepovers')} last />
        </View>

        {/* Воспоминания — посты, как в Instagram (26 окт.): сетка фото, «+» — новый пост. */}
        <PostsGrid posts={myPosts} mine />
      </View>
    </ScrollView>
  );
}

function Row({ Icon, title, value, onPress, last }: { Icon: LucideIcon; title: string; value: string; onPress: () => void; last?: boolean }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, !last && styles.rowSep, pressed && { backgroundColor: '#E0DACD' }]} accessibilityRole="button" accessibilityLabel={`${title}: ${value}`}>
      <Icon size={20} color={colors.ink} strokeWidth={1.8} />
      <Text style={styles.rowTitle}>{title}</Text>
      <Text style={styles.rowValue} numberOfLines={1}>{value}</Text>
      <ChevronRight size={18} color={colors.muted} strokeWidth={2} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  editRow: { flexDirection: 'row', gap: 8 },
  editBtn: { flex: 1, flexDirection: 'row', gap: 8, minHeight: 48, borderRadius: 16, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  editText: { fontFamily: fonts.body700, fontSize: 15, color: colors.paper },
  viewBtn: { width: 48, minHeight: 48, borderRadius: 16, backgroundColor: colors.sand, alignItems: 'center', justifyContent: 'center' },
  slim: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingHorizontal: 14 },
  slimFaces: { flexDirection: 'row', alignItems: 'center' },
  slimLine: { borderTopWidth: 1, borderTopColor: 'rgba(23,22,26,0.06)' },
  slimTitle: { flex: 1, fontFamily: fonts.body700, fontSize: 15, color: colors.ink },
  ringBox30: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  memEmpty: { width: 210, justifyContent: 'center', gap: 4, paddingRight: 8 },
  memEmptyTitle: { fontFamily: fonts.body700, fontSize: 14.5, color: colors.ink },
  memEmptyText: { fontFamily: fonts.body400, fontSize: 13, lineHeight: 18, color: colors.muted },
  root: { flex: 1, backgroundColor: colors.paper },
  topRow: { flexDirection: 'row', gap: 8 },
  topBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(20,19,24,0.38)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' },
  tileIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.55)', alignItems: 'center', justifyContent: 'center' },
  topDot: { position: 'absolute', top: -3, right: -3, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  topDotText: { fontFamily: fonts.mono600, fontSize: 9.5, color: '#FFFFFF' },
  head: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 6, gap: 4 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 24, marginTop: 4 },
  name: { fontFamily: fonts.display800, fontSize: 28, letterSpacing: -0.8, color: colors.ink, flexShrink: 1 },
  handle: { fontFamily: fonts.body500, fontSize: 14, color: colors.muted, minHeight: 20 },
  body: { paddingHorizontal: 16, gap: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { width: '48.4%', flexGrow: 1, minHeight: 132, borderRadius: radii.xl - 4, ...plate, padding: 14, gap: 2, justifyContent: 'flex-end' },
  tileDark: { backgroundColor: colors.ink, borderTopColor: 'rgba(255,255,255,0.18)', borderLeftColor: 'rgba(255,255,255,0.06)', borderRightColor: 'rgba(255,255,255,0.06)', borderBottomColor: 'rgba(0,0,0,0.4)' },
  faces: { flexDirection: 'row', marginBottom: 'auto' },
  facesEmpty: { width: 34, height: 34, borderRadius: 17, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.line2, alignItems: 'center', justifyContent: 'center' },
  plus: { fontFamily: fonts.display700, fontSize: 18, color: colors.muted },
  ringBox: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  ringText: { position: 'absolute', fontFamily: fonts.body700, fontSize: 11.5, color: colors.ink },
  tileN: { fontFamily: fonts.display800, fontSize: 26, letterSpacing: -0.6, color: colors.ink, marginTop: 10 },
  tileL: { fontFamily: fonts.body500, fontSize: 13, color: colors.muted2 },
  card: { borderRadius: radii.xl - 4, ...plate, padding: 14, gap: 12 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 28 },
  cardTitle: { flex: 1, fontFamily: fonts.display700, fontSize: 18, color: colors.ink },
  cardSub: { fontFamily: fonts.body500, fontSize: 13, color: colors.muted },
  medals: { flexDirection: 'row', justifyContent: 'space-between' },
  album: { width: 112, height: 140, borderRadius: 18, overflow: 'hidden', justifyContent: 'flex-end', padding: 10 },
  albumNew: { backgroundColor: colors.sand, alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.line2 },
  albumNewText: { fontFamily: fonts.body600, fontSize: 12.5, color: colors.muted2, textAlign: 'center' },
  albumShade: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(23,22,26,0.28)' },
  albumTitle: { fontFamily: fonts.display700, fontSize: 14, lineHeight: 17, color: '#FFFFFF' },
  albumMeta: { fontFamily: fonts.mono600, fontSize: 10, color: '#EEE9DE', marginTop: 2 },
  list: { borderRadius: radii.xl - 4, ...plate, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 56, paddingHorizontal: 16 },
  rowSep: { borderBottomWidth: 1, borderBottomColor: '#D9D3C5' },
  rowTitle: { flex: 1, fontFamily: fonts.body700, fontSize: 15.5, color: colors.ink },
  rowValue: { fontFamily: fonts.body400, fontSize: 14, color: colors.muted2, maxWidth: 170 },
  pressed: { transform: [{ scale: 0.98 }] },
});
