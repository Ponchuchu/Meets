// Мой профиль (FIX3 Ф7, решение владельца 20 октября). Без оранжевой шапки: мягкое свечение цвета рамки за аватаркой.
// Сверху справа: панель разработчика (только команда) · QR · настройки. Под именем — до трёх наград, выбранных в «Наградах».
// Сетка: Друзья · Уровень / Где я был · Шаги (10 000 в день, считаются всегда). Ниже — «Награды», «Воспоминания»,
// «Мои места» и «Ночёвки». «События и встречи» и «Хроника» убраны: прошедшие события живут в «Воспоминаниях».
import { useQuery } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { router, useFocusEffect } from 'expo-router';
import { BedDouble, ChevronRight, Code2, Footprints, Home, ImagePlus, QrCode, Settings, type LucideIcon } from 'lucide-react-native';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { create } from 'zustand';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { useTabInset } from '../../components/TabBar';
import { data } from '../../data';
import { config } from '../../lib/config';
import { getMeStats, getProfile, uploadAvatar } from '../../live/api';
import { exploredPct, ALMATY_CELLS } from '../../live/geo';
import { getMemories, getProfileExtras, getSleepovers, learnMyPlaces } from '../../live/profileExtras';
import { STEP_GOAL, stepHistory, stepsToday, useSteps } from '../../live/steps';
import { stepAwards } from '../../profile/stepAwards';
import { useSession } from '../../state/session';
import { useMapState } from '../../state/map';
import { colors, fonts, radii } from '../../theme';
import { badgeIcon } from '../../profile/badges';
import { BadgeMedal } from '../../ui/BadgeMedal';
import { Avatar } from '../../ui/Avatar';
import { AvatarFrame, frameById } from '../../profile/frames';
import { useProfile } from '../../state/profile';
import { plate } from '../../ui/glass';
import { CAT_COLOR, CAT_ICON, catFg } from '../../map/icons';
import { Ic } from '../../ui/Ic';

const plural = (n: number, a: string, b: string, c: string) => { const m10 = n % 10, m100 = n % 100; return m10 === 1 && m100 !== 11 ? a : m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20) ? b : c; };
const LIVE = config.dataMode !== 'demo';
const DEMO_STATS = { friends: 4, level: 3, points: 2140, cells: Array.from({ length: 23 }, (_, i) => `d${i}`), badges: [
  { id: 'opener', name: 'Открыватель', goal: 1, progress: 1, got: true }, { id: 'night', name: 'Ночная смена', goal: 3, progress: 3, got: true },
  { id: 'jazz', name: 'Джазмен', goal: 3, progress: 2, got: false }, { id: 'laugh', name: 'Смешинка', goal: 3, progress: 1, got: false },
  { id: 'above', name: 'Выше города', goal: 1, progress: 0, got: false }], places: ['дом', 'работа'], staff: true, drafts: 4 };

const useStill = create<{ still: boolean }>(() => ({ still: false }));
function HeroFrame(props: { frameId?: string | null; shape?: string | null; photo?: string | null; initial: string }) {
  const still = useStill((s) => s.still);
  return <AvatarFrame {...props} size={128} animate={!still} />;
}

const Ring = memo(function Ring({ value, size, stroke, color, track }: { value: number; size: number; stroke: number; color: string; track: string }) {
  const r = (size - stroke) / 2;
  const len = 2 * Math.PI * r;
  return (
    <Svg width={size} height={size}>
      <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
      <Circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round"
        strokeDasharray={`${Math.max(1, len * Math.min(1, value))} ${len}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
    </Svg>
  );
});

/** Свечение за аватаркой — цвет выбранной рамки, мягко растворяется в бумаге. */
const Aura = memo(function Aura({ color, height }: { color: string; height: number }) {
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
  const insets = useSafeAreaInsets();
  const pad = useTabInset();
  const draft = useSession((s) => s.draft);
  const demoFrame = useProfile(s => s.mapFrame);
  const demoShape = useProfile(s => s.mapShape);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const prof = useQuery({ queryKey: ['me', 'profile'], queryFn: () => getProfile(), enabled: LIVE });
  const stats = useQuery({ queryKey: ['me', 'stats'], queryFn: getMeStats, enabled: LIVE, staleTime: 30e3 });
  const extras = useQuery({ queryKey: ['me', 'extras'], queryFn: getProfileExtras });
  const memories = useQuery({ queryKey: ['me', 'memories'], queryFn: () => getMemories() });
  const sleeps = useQuery({ queryKey: ['me', 'sleepovers'], queryFn: () => getSleepovers() });
  const { data: people = [] } = useQuery({ queryKey: ['people'], queryFn: () => data.getPeople() });
  const steps = useSteps(st => (LIVE ? stepsToday(st) : 6240));
  const stepDays = useQuery({ queryKey: ['me', 'steps'], queryFn: stepHistory, enabled: LIVE, staleTime: 60e3 });
  useFocusEffect(useCallback(() => { if (LIVE) { void stats.refetch(); void prof.refetch(); } }, [])); // eslint-disable-line react-hooks/exhaustive-deps
  // «Мои места» сами: раз за запуск спрашиваем сервер — он сам найдёт дом, работу или учёбу и ночёвки.
  useEffect(() => { void learnMyPlaces().then(r => { if (r && (r.places || r.sleepovers)) { void stats.refetch(); void sleeps.refetch(); } }).catch(() => undefined); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const p = prof.data;
  const s = LIVE ? stats.data : DEMO_STATS;
  const name = p?.name?.trim() || draft.name?.trim() || 'Твой профиль';
  const frameId = LIVE ? p?.map_frame : demoFrame;
  const frame = frameById(frameId);
  const level = s?.level ?? 1;
  const points = s?.points ?? 0;
  const nextAt = level <= 10 ? level * 1000 : 10000 + (level - 10) * 1500;
  const pct = s ? s.cells.length / ALMATY_CELLS : 0;
  const walk = stepAwards(stepDays.data ?? [], { day: new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Almaty' }), steps });
  const allBadges = [...walk, ...(s?.badges ?? [])];
  const got = allBadges.filter((b) => b.got);
  const shown = (extras.data?.shown ?? []).slice(0, 3);
  const friends = people.filter(x => x.isFriend);
  const friendCount = LIVE ? s?.friends ?? friends.length : friends.length;
  const albums = memories.data ?? [];
  const nights = sleeps.data ?? [];
  const heroH = insets.top + 270;
  // Пока листаешь — живая рамка замирает (на слабых телефонах анимация и прокрутка вместе давали ~3 кадра в секунду).
  // Флаг живёт в маленьком хранилище: меняется только рамка, а не весь экран.
  const settle = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const scrollStart = () => { clearTimeout(settle.current); if (!useStill.getState().still) useStill.setState({ still: true }); };
  const scrollEnd = () => { clearTimeout(settle.current); settle.current = setTimeout(() => useStill.setState({ still: false }), 400); };
  useEffect(() => () => clearTimeout(settle.current), []);

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
    <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: pad + 16 }} showsVerticalScrollIndicator={false}
      onScrollBeginDrag={scrollStart} onScrollEndDrag={scrollEnd} onMomentumScrollBegin={scrollStart} onMomentumScrollEnd={scrollEnd}>
      <View style={{ height: heroH, paddingTop: insets.top }}>
        <Aura color={frame.color} height={heroH} />
        <View style={[styles.topBtns, { top: insets.top + 10 }]}>
          {s?.staff && (
            <Pressable onPress={() => router.push('/dev')} style={styles.topBtn} accessibilityRole="button" accessibilityLabel={`Панель разработчика${s.drafts ? `, новых: ${s.drafts}` : ''}`}>
              <Code2 size={20} color={colors.ink} strokeWidth={1.9} />
              {s.drafts > 0 && <View style={styles.topDot}><Text style={styles.topDotText}>{s.drafts > 99 ? '99+' : s.drafts}</Text></View>}
            </Pressable>
          )}
          <Pressable onPress={() => router.push('/profile/qr')} style={styles.topBtn} accessibilityRole="button" accessibilityLabel="Мой QR-код"><QrCode size={20} color={colors.ink} strokeWidth={1.9} /></Pressable>
          <Pressable onPress={() => router.push('/settings')} style={styles.topBtn} accessibilityRole="button" accessibilityLabel="Настройки"><Settings size={20} color={colors.ink} strokeWidth={1.9} /></Pressable>
        </View>
        <View style={styles.head}>
          <Pressable onPress={() => void pickPhoto()} onLongPress={() => router.push('/profile/level')} style={({ pressed }) => [pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel={`Сменить фото. Рамка «${frame.name}»`}>
            <HeroFrame frameId={frameId} shape={LIVE ? p?.map_shape : demoShape} photo={p?.photo_url ?? draft.photo} initial={(name[0] ?? '·').toUpperCase()} />
          </Pressable>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>{name}</Text>
            {shown.map(id => <BadgeMedal key={id} id={id} icon={badgeIcon(id)} got size={24} />)}
          </View>
          <Pressable onPress={() => router.push('/profile/awards')} hitSlop={8} accessibilityRole="button">
            <Text style={styles.handle} numberOfLines={1}>{p?.handle ? `@${p.handle}` : ''}{p?.handle && !shown.length ? ' · ' : ''}{!shown.length ? 'добавь награду к имени' : ''}</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.body}>
        {photoError && <Text style={{ color: colors.accentText }}>{photoError}</Text>}
        {uploading && <Text style={{ color: colors.muted }}>Сохраняю фото…</Text>}

        <View style={styles.grid}>
          <Pressable onPress={() => router.push('/friends')} style={({ pressed }) => [styles.tile, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel={`Друзья: ${friendCount}`}>
            <View style={styles.faces}>
              {friends.slice(0, 3).map((f, i) => <Avatar key={f.id} p={f} size={34} style={{ marginLeft: i ? -12 : 0, borderWidth: 2, borderColor: '#F1ECE2' }} />)}
              {!friends.length && <View style={styles.facesEmpty}><Text style={styles.plus}>+</Text></View>}
            </View>
            <Text style={styles.tileN}>{friendCount}</Text>
            <Text style={styles.tileL}>{plural(friendCount, 'друг', 'друга', 'друзей')}</Text>
          </Pressable>
          <Pressable onPress={() => router.push('/profile/level')} style={({ pressed }) => [styles.tile, styles.tileDark, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel={`Уровень ${level}, ${points} из ${nextAt} очков`}>
            <View style={styles.ringBox}>
              <Ring value={points / nextAt} size={52} stroke={5} color="#F7A47E" track="#3A393F" />
              <Text style={[styles.ringText, { color: '#EEE9DE', fontSize: 18 }]}>{level}</Text>
            </View>
            <Text style={[styles.tileN, { color: '#EEE9DE', fontSize: 20 }]}>Уровень {level}</Text>
            <Text style={[styles.tileL, { color: '#BDB8AD' }]} numberOfLines={1}>{points.toLocaleString('ru-RU')} / {nextAt.toLocaleString('ru-RU')}</Text>
          </Pressable>
          <Pressable onPress={() => { useMapState.getState().setLens('explore'); router.navigate('/'); }} style={({ pressed }) => [styles.tile, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel={`Где я был: ${exploredPct(s?.cells ?? [])} Алматы`}>
            <View style={styles.ringBox}>
              <Ring value={pct} size={52} stroke={5} color={colors.accent} track="#D6CFC0" />
              <Text style={styles.ringText}>{exploredPct(s?.cells ?? []).replace(' ', '').replace(',0', '')}</Text>
            </View>
            <Text style={[styles.tileN, { fontSize: 20 }]}>Где я был</Text>
            <Text style={styles.tileL}>Алматы</Text>
          </Pressable>
          <Pressable onPress={() => router.push('/profile/steps')} style={({ pressed }) => [styles.tile, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel={`Шаги сегодня: ${steps} из ${STEP_GOAL}`}>
            <View style={styles.ringBox}>
              <Ring value={steps / STEP_GOAL} size={52} stroke={5} color={colors.ok} track="#D6CFC0" />
              <View style={{ position: 'absolute' }}><Footprints size={18} color={colors.ok} strokeWidth={1.9} /></View>
            </View>
            <Text style={[styles.tileN, { fontSize: 20 }]}>{steps.toLocaleString('ru-RU')}</Text>
            <Text style={styles.tileL}>шагов из 10 000</Text>
          </Pressable>
        </View>

        <Pressable onPress={() => router.push('/profile/awards')} style={({ pressed }) => [styles.card, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel={`Награды: ${got.length} из ${allBadges.length}`}>
          <View style={styles.cardHead}>
            <Text style={styles.cardTitle}>Награды</Text>
            <Text style={styles.cardSub}>{got.length} из {allBadges.length}</Text>
            <ChevronRight size={18} color={colors.muted} strokeWidth={2} />
          </View>
          <View style={styles.medals}>
            {[...got, ...allBadges.filter(b => !b.got)].slice(0, 5).map((b) => (
              <BadgeMedal key={b.id} id={b.id} icon={badgeIcon(b.id)} got={b.got} progress={b.progress / Math.max(1, b.goal)} size={54} />
            ))}
          </View>
        </Pressable>

        <View style={styles.card}>
          <Pressable onPress={() => router.push('/profile/memories')} style={styles.cardHead} accessibilityRole="button">
            <Text style={styles.cardTitle}>Воспоминания</Text>
            <Text style={styles.cardSub}>{albums.length ? `${albums.length} ${plural(albums.length, 'альбом', 'альбома', 'альбомов')}` : 'фото с событий'}</Text>
            <ChevronRight size={18} color={colors.muted} strokeWidth={2} />
          </Pressable>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
            <Pressable onPress={() => router.push('/profile/memories')} style={[styles.album, styles.albumNew]} accessibilityRole="button" accessibilityLabel="Новый альбом">
              <ImagePlus size={26} color={colors.muted2} strokeWidth={1.8} />
              <Text style={styles.albumNewText}>Новый{'\n'}альбом</Text>
            </Pressable>
            {!albums.length && (
              <View style={styles.memEmpty}>
                <Text style={styles.memEmptyTitle}>Здесь будут твои вечера</Text>
                <Text style={styles.memEmptyText}>Сходи на событие и добавь пару фото — получится альбом. Кто его видит, решаешь ты.</Text>
              </View>
            )}
            {albums.slice(0, 8).map(m => (
              <Pressable key={m.id} onPress={() => router.push({ pathname: '/profile/[page]', params: { page: `memory-${m.id}` } })} style={styles.album} accessibilityRole="button" accessibilityLabel={`Альбом ${m.title}`}>
                {m.cover ? <Image source={{ uri: m.cover }} style={StyleSheet.absoluteFill} resizeMethod="resize" /> : <View style={[StyleSheet.absoluteFill, { backgroundColor: CAT_COLOR.music, alignItems: 'center', justifyContent: 'center' }]}><Ic d={CAT_ICON.music} size={34} color={catFg('music')} w={1.6} /></View>}
                <View style={styles.albumShade} />
                <Text style={styles.albumTitle} numberOfLines={2}>{m.title}</Text>
                <Text style={styles.albumMeta}>{m.photos.length} фото</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        <View style={styles.list}>
          <Row Icon={Home} title="Мои места" value={s?.places.length ? s.places.join(', ') : 'найдём сами'} onPress={() => router.push('/settings/places')} />
          <Row Icon={BedDouble} title="Ночёвки" value={nights.length ? `${nights.length} ${plural(nights.length, 'ночь', 'ночи', 'ночей')}` : 'пока нет'} onPress={() => router.push('/profile/sleepovers')} last />
        </View>
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
  memEmpty: { width: 210, justifyContent: 'center', gap: 4, paddingRight: 8 },
  memEmptyTitle: { fontFamily: fonts.body700, fontSize: 14.5, color: colors.ink },
  memEmptyText: { fontFamily: fonts.body400, fontSize: 13, lineHeight: 18, color: colors.muted },
  root: { flex: 1, backgroundColor: colors.paper },
  topBtns: { position: 'absolute', right: 16, top: 0, flexDirection: 'row', gap: 8, zIndex: 2 },
  topBtn: { width: 44, height: 44, borderRadius: 22, ...plate, alignItems: 'center', justifyContent: 'center' },
  topDot: { position: 'absolute', top: -3, right: -3, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  topDotText: { fontFamily: fonts.mono600, fontSize: 9.5, color: colors.ink },
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
  ringBox: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center', marginBottom: 'auto' },
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
