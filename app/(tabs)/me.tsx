// Профиль — одна страница (design/png/Me.png, MeBadges.png). Ничего не проваливается в отдельные экраны.
import { useQuery } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Image, Linking, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTabInset } from '../../src/components/TabBar';
import { data, eventsSnapshot, type EventItem } from '../../src/data';
import { photo } from '../../src/data/photos';
import { now as clockNow } from '../../src/lib/clock';
import { badgeRow, badgeStates, sortBadges } from '../../src/profile/badges';
import { cityPercent, levelOf, levelProgress, nextLevelHint } from '../../src/profile/city';
import { CityMap } from '../../src/profile/ui/CityMap';
import { Plans, withFriends, type PlanRow } from '../../src/profile/ui/Plans';
import type { Interest } from '../../src/reco/startTaste';
import { useApp } from '../../src/state/app';
import { usePlans } from '../../src/state/plans';
import { RING_STYLES, statusSticker, useProfile } from '../../src/state/profile';
import { RingView, StatusTag } from '../../src/profile/ui/MarkerArt';
import { CAT_COLOR, CAT_ICON, catFg } from '../../src/map/icons';
import { matchesCats, type FilterCat } from '../../src/map/filters';
import { useMapState } from '../../src/state/map';
import { Avatar } from '../../src/ui/Avatar';
import type { Category, TimelineItem } from '../../src/data/types';
import { useSession } from '../../src/state/session';
import { colors, fonts } from '../../src/theme';
import { Ic, IC } from '../../src/ui/Ic';
import { Chip, Segments } from '../../src/ui/kit';
import { Backdrop, BottomSheet } from '../../src/ui/sheet';

/** Интерес → категория на карте, цвет и иконка плитки «Что вытаскивает из дома». */
const INTEREST_CAT: Record<Interest, { cat: FilterCat; icon: Category }> = {
  music: { cat: 'music', icon: 'music' }, standup: { cat: 'standup', icon: 'standup' }, hike: { cat: 'hike', icon: 'hike' },
  sport: { cat: 'sport', icon: 'sport' }, people: { cat: 'talks', icon: 'meetup' }, games: { cat: 'games', icon: 'games' },
  art: { cat: 'art', icon: 'art' }, food: { cat: 'food', icon: 'food' }, party: { cat: 'music', icon: 'party' }, talks: { cat: 'talks', icon: 'lecture' },
};
const INTEREST_LABEL: Record<Interest, string> = {
  music: 'Живая музыка', standup: 'Посмеяться', hike: 'Горы и природа', sport: 'Бег и вело', people: 'Новые люди',
  games: 'Настолки', art: 'Выставки', food: 'Еда и маркеты', party: 'Вечеринки', talks: 'Лекции и кино',
};
const PHOTO_OPTS: [string, string, string][] = [
  ['insta', 'Взять из Instagram', 'M7 3.5h10A3.5 3.5 0 0120.5 7v10a3.5 3.5 0 01-3.5 3.5H7A3.5 3.5 0 013.5 17V7A3.5 3.5 0 017 3.5zM12 8a4 4 0 100 8 4 4 0 000-8z'],
  ['upload', 'Загрузить из галереи', 'M4 5h16v14H4zM4 15l5-5 4 4 3-3 4 4'],
  ['camera', 'Сделать снимок', 'M4 8h3l2-3h6l2 3h3v11H4zM12 9.5a3.5 3.5 0 100 7 3.5 3.5 0 000-7z'],
];

/** «от Дениса», «от Игоря», «от Айнуры». */
function genitive(name: string): string {
  if (/ь$/.test(name)) return name.slice(0, -1) + 'я';
  if (/[ая]$/.test(name)) return name.slice(0, -1) + (/[гкхжшщч]а$/.test(name) ? 'и' : 'ы');
  if (/й$/.test(name)) return name.slice(0, -1) + 'я';
  return name + 'а';
}

type Sheet = null | 'badges' | 'interests' | 'edit' | { day: TimelineItem };
type MapTab = 'city' | 'cities' | 'countries';

export default function MeScreen() {
  const insets = useSafeAreaInsets();
  const tabPad = useTabInset() + 16;
  const seenPlans = useApp((s) => s.seenPlans);
  useFocusEffect(useCallback(() => { seenPlans(); }, [seenPlans]));
  const now = clockNow();
  const [sheet, setSheet] = useState<Sheet>(null);
  const [menu, setMenu] = useState(false);
  const [mapTab, setMapTab] = useState<MapTab>('city');

  const draft = useSession((s) => s.draft);
  const update = useSession((s) => s.update);
  const finish = useSession((s) => s.finish);
  const { data: events = [] } = useQuery({ queryKey: ['events'], queryFn: () => data.getEvents(), placeholderData: eventsSnapshot });
  const { data: people = [] } = useQuery({ queryKey: ['people'], queryFn: () => data.getPeople() });
  const { data: me } = useQuery({ queryKey: ['myProfile'], queryFn: () => data.getMyProfile() });
  const { going, saved, meetups, declined, go, decline } = usePlans();
  const arrivals = useProfile((s) => s.arrivals);
  const marker = useProfile((s) => s.marker);
  const addPlan = useApp((s) => s.addPlan);

  const all = useMemo(() => [...meetups, ...events], [meetups, events]);
  const byId = (id: string) => all.find((e) => e.id === id);
  const upcoming = (e: EventItem | undefined): e is EventItem => !!e && new Date(e.endsAt ?? e.startsAt).getTime() + 7200e3 > now.getTime();

  const goingRows: PlanRow[] = Object.entries(going)
    .map(([id, at]) => ({ e: byId(id), at }))
    .filter((x): x is { e: EventItem; at: string } => upcoming(x.e))
    .sort((a, b) => a.e.startsAt.localeCompare(b.e.startsAt))
    .map(({ e, at }) => ({
      e,
      sub: e.meetup ? `${e.meetup.invited.length} из ${e.meetup.invited.length} приняли` : withFriends(e, people),
      faces: e.friendsGoing.map((id) => people.find((p) => p.id === id)).filter((p): p is NonNullable<typeof p> => !!p),
      tag: e.meetup ? { text: 'ОРГАНИЗУЮ', bg: colors.accent, fg: colors.ink }
        : now.getTime() - new Date(at).getTime() < 3 * 3600e3 ? { text: 'НОВОЕ', bg: colors.ink, fg: colors.paper } : undefined,
    }));
  const inviteRows: PlanRow[] = (me?.invitesToMe ?? [])
    .filter((i) => !going[i.eventId] && !declined[i.eventId])
    .map((i) => ({ i, e: byId(i.eventId), from: people.find((p) => p.id === i.fromId) }))
    .filter((x) => upcoming(x.e))
    .map(({ i, e, from }) => ({
      e: e!,
      sub: `${from?.name ?? 'Друг'} зовёт`,
      faces: from ? [from] : [],
      tag: { text: `ОТ ${genitive(from?.name ?? '').toUpperCase()}`, bg: colors.friend, fg: '#FFFFFF' },
      invite: { fromName: from?.name ?? '', onYes: () => { go(i.eventId); addPlan(); }, onNo: () => decline(i.eventId) },
    }));
  const savedRows: PlanRow[] = Object.keys(saved).map(byId).filter(upcoming).map((e) => ({ e, sub: `${e.isFree ? 'бесплатно' : `от ${(e.priceMin ?? 0).toLocaleString('ru-RU')} ₸`} · решишь позже` }));

  const visited = useMemo(() => [...new Set([...(me?.visitedCells ?? []), ...arrivals.map((a) => a.cell)])], [me, arrivals]);
  const eventCells = me?.eventCells ?? [];
  const pct = cityPercent(visited, eventCells);
  const level = levelOf(pct);
  const hint = nextLevelHint(visited.filter((c) => eventCells.includes(c)).length, eventCells.length || 1);
  const badges = sortBadges(badgeStates({ ...(me?.badgeProgress ?? {}), first: arrivals.length ? 1 : 0 }));
  const gotCount = badges.filter((b) => b.got).length;
  const row = badgeRow(badges);
  const setFilters = useMapState((s) => s.setFilters);
  const weekAhead = (e: EventItem) => { const t = new Date(e.startsAt).getTime() - now.getTime(); return t > -3 * 3600e3 && t < 7 * 86400e3; };
  const interestCount = (k: Interest) => events.filter((e) => weekAhead(e) && matchesCats(e, [INTEREST_CAT[k].cat])).length;
  const openInterest = (k: Interest) => { setFilters({ cats: [INTEREST_CAT[k].cat], from: 0, to: 6 }); router.push('/'); };
  const ring = RING_STYLES[marker.ring] ?? RING_STYLES.blue;
  const face = <Image source={photo(draft.photo ?? 'danil')} style={{ width: '100%', height: '100%' }} />;
  const hot = ['jazz', 'anime', 'games', 'food'].map(byId).filter(Boolean).map((e) => ({ lat: e!.lat, lon: e!.lon }));

  const pickPhoto = async (src: string) => {
    setMenu(false);
    if (src === 'insta') { update({ photo: 'danil' }); return; }
    try {
      const res = src === 'camera'
        ? await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.8 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8 });
      if (!res.canceled && res.assets[0]) update({ photo: res.assets[0].uri });
    } catch { /* нет камеры — ничего не меняем */ }
  };
  const share = () => Share.share({ message: `Я в «рядом.» — @${me?.handle ?? 'danil'}. Пойдём куда-нибудь вместе?` }).catch(() => {});

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={{ paddingTop: Math.max(50, insets.top + 6), paddingHorizontal: 12, paddingBottom: tabPad, gap: 16 }}>
        <View style={styles.titleRow}>
          <Text style={styles.h1} accessibilityRole="header">Профиль</Text>
          <Pressable onPress={() => router.push('/settings')} style={styles.round} accessibilityRole="button" accessibilityLabel="Настройки">
            <Ic d="M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" size={20} color={colors.ink} />
          </Pressable>
        </View>

        <View style={styles.header}>
          <Pressable onPress={() => setMenu(!menu)} accessibilityRole="button" accessibilityLabel="Поменять фото">
            <RingView r={ring} size={84}>{face}</RingView>
            <View style={styles.cam}><Ic d={PHOTO_OPTS[2][2]} size={13} color={colors.paper} w={2} /></View>
          </Pressable>
          <View style={{ flex: 1, gap: 4, paddingTop: 6 }}>
            <Text style={styles.name}>{draft.name || 'Данил'}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={styles.handleText}>@{me?.handle ?? 'danil'}</Text>
              {me?.instagram !== null && (
                <Pressable onPress={() => Linking.openURL(`https://instagram.com/${me?.instagram ?? me?.handle ?? 'danil'}`).catch(() => {})} hitSlop={12} style={styles.insta} accessibilityRole="link" accessibilityLabel="Instagram">
                  <Ic d={PHOTO_OPTS[0][2]} size={15} color={colors.ink} w={2} />
                </Pressable>
              )}
            </View>
            {!!me?.about && <Text style={styles.about}>{me.about}</Text>}
          </View>
        </View>
        {menu && (
          <Animated.View entering={FadeIn.duration(150)} exiting={FadeOut.duration(120)} style={styles.menu}>
            {PHOTO_OPTS.map(([k, label, d]) => (
              <Pressable key={k} onPress={() => pickPhoto(k)} style={styles.menuRow} accessibilityRole="button">
                <Ic d={d} size={18} color={colors.paper} />
                <Text style={styles.menuText}>{label}</Text>
              </Pressable>
            ))}
          </Animated.View>
        )}

        <Plans going={goingRows} invites={inviteRows} saved={savedRows} now={now} />

        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable onPress={() => setSheet('edit')} style={styles.halfBtn} accessibilityRole="button"><Text style={styles.halfText}>Изменить профиль</Text></Pressable>
          <Pressable onPress={share} style={styles.halfBtn} accessibilityRole="button"><Text style={styles.halfText}>Поделиться</Text></Pressable>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {[[String((me?.stats.events ?? 0) + arrivals.length), 'событий'], [String(visited.length), 'мест'], [String(me?.stats.friends ?? 0), 'друзей']].map(([n, l]) => (
            <View key={l} style={styles.stat}><Text style={styles.statN}>{n}</Text><Text style={styles.statL}>{l}</Text></View>
          ))}
        </View>

        <Text style={styles.h2}>Моя карта</Text>
        <Segments<MapTab> label="Моя карта" value={mapTab} onChange={setMapTab}
          options={[['city', `Алматы · ${pct}%`], ['cities', `Города · ${me?.cities.length ?? 0}`], ['countries', `Страны · ${me?.countries.filter((c) => c.got).length ?? 0}`]]} />
        {mapTab === 'city' && (
          <>
            <View style={styles.cityCard}>
              <Text style={styles.cityCap}>АЛМАТЫ ОТКРЫТ</Text>
              <View style={styles.cityTop}>
                <Text style={styles.pct}>{pct}%</Text>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.cityMeta}>{visited.length} мест</Text>
                  <Text style={styles.cityMeta}>{me?.districts.length ? `${Math.min(me.districtsTotal, me.districts.length + 2)} районов из ${me.districtsTotal}` : ''}</Text>
                </View>
              </View>
              <View style={styles.bar}>
                <View style={[styles.barFill, { width: `${levelProgress(pct) * 100}%` }]} />
                <View style={[styles.barMark, { left: `${levelProgress(pct) * 100}%` }]} />
              </View>
              <View style={styles.levelRow}>
                <Text style={styles.levelText}>Уровень {level.n} · {level.name}</Text>
                {hint && <Text style={styles.levelText}>{hint}</Text>}
              </View>
              <CityMap visited={visited} hot={hot} />
            </View>
            <View style={{ gap: 12, paddingHorizontal: 2 }}>
              {me?.districts.map((d) => (
                <View key={d.name} style={styles.district}>
                  <Text style={styles.districtName}>{d.name}</Text>
                  <View style={styles.dBar}><View style={[styles.dFill, { width: `${d.pct}%` }]} /></View>
                  <Text style={styles.dPct}>{d.pct}%</Text>
                </View>
              ))}
            </View>
          </>
        )}
        {mapTab === 'cities' && (
          <View style={styles.list}>
            {me?.cities.map((c, i) => (
              <View key={c.name} style={[styles.listRow, i < me.cities.length - 1 && styles.line]}>
                <View style={{ flex: 1 }}><Text style={styles.rowTitle}>{c.name}</Text><Text style={styles.rowSub}>{c.note}</Text></View>
                <View style={[styles.cBar, { width: Math.max(c.pct * 4, 4) }]} />
                <Text style={styles.dPct}>{c.pct}%</Text>
              </View>
            ))}
            <Text style={[styles.rowSub, { padding: 14 }]}>Новый город появится, когда отметишься на событии в поездке.</Text>
          </View>
        )}
        {mapTab === 'countries' && (
          <View style={styles.grid}>
            {me?.countries.map((c) => (
              <View key={c.iso} style={[styles.country, { borderStyle: c.got ? 'solid' : 'dashed', borderColor: c.got ? colors.line : '#B9B2A3', backgroundColor: c.got ? colors.card : 'transparent' }]}>
                <View style={[styles.iso, { backgroundColor: c.got ? colors.ink : 'transparent' }]}><Text style={[styles.isoText, { color: c.got ? colors.paper : '#8C8577' }]}>{c.iso}</Text></View>
                <Text style={[styles.rowTitle, { color: c.got ? colors.ink : colors.muted }]}>{c.name}</Text>
                <Text style={styles.rowSub}>{c.note}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.titleRow}>
          <Text style={styles.h2}>Значки</Text>
          <Pressable onPress={() => setSheet('badges')} style={styles.pill} accessibilityRole="button"><Text style={styles.pillText}>Все · {gotCount} из {badges.length}</Text><Ic d="M6 15l6-6 6 6" size={12} color={colors.ink} w={2.4} /></Pressable>
        </View>
        <View style={styles.badgeRow}>
          {row.map((b) => (
            <View key={b.id} style={styles.badge}>
              <View style={[styles.disc, !b.got && { backgroundColor: colors.sand, borderWidth: 1.5, borderColor: colors.line2, borderStyle: 'dashed' }]}>
                <Ic d={b.icon} size={22} color={b.got ? colors.accent : colors.muted3} />
              </View>
              <Text style={styles.badgeName} numberOfLines={2}>{b.name}{b.got ? '' : ` · ${b.progress}/${b.goal}`}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.h2}>Хроника</Text>
        <View style={{ paddingHorizontal: 4 }}>
          {[...arrivals.slice().reverse().map((a): TimelineItem => {
            const e = byId(a.eventId);
            return { date: 'СЕЙЧАС', title: e?.title ?? 'Событие', eventId: a.eventId, category: e?.category, place: e?.venueName ?? e?.address.split(',')[0], with: e?.friendsGoing };
          }), ...(me?.timeline ?? [])].map((t, i, arr) => {
            const [wd, day] = t.date.split(' ');
            const faces = (t.with ?? []).map((id) => people.find((p) => p.id === id)).filter((p): p is NonNullable<typeof p> => !!p);
            const cat = t.category;
            return (
              <Pressable key={`${t.date}-${t.title}`} onPress={() => (t.eventId && byId(t.eventId) ? router.push({ pathname: '/event/[id]', params: { id: t.eventId } }) : setSheet({ day: t }))}
                style={({ pressed }) => [styles.tl, pressed && { opacity: 0.7 }]} accessibilityRole="button" accessibilityLabel={`${t.date}: ${t.title}`}>
                <View style={styles.tlDateBox}>
                  <Text style={styles.tlDay}>{day ?? ''}</Text>
                  <Text style={styles.tlWd}>{wd}</Text>
                </View>
                <View style={styles.tlRail}>
                  <View style={[styles.tlDot, { backgroundColor: cat ? CAT_COLOR[cat] : colors.ink }]}>{cat && <Ic d={CAT_ICON[cat]} size={13} color={catFg(cat)} w={2.2} />}</View>
                  {i < arr.length - 1 && <View style={styles.tlLine} />}
                </View>
                <View style={{ flex: 1, gap: 4, paddingBottom: 18 }}>
                  <Text style={styles.rowTitle} numberOfLines={1}>{t.title}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    {faces.length > 0 && <View style={{ flexDirection: 'row' }}>{faces.slice(0, 4).map((p, j) => <Avatar key={p.id} p={p} size={24} ring={colors.friend} style={{ marginLeft: j ? -8 : 0 }} />)}</View>}
                    {!!t.place && <Text style={styles.rowSub} numberOfLines={1}>{t.place}</Text>}
                  </View>
                  {!!t.meta && <View style={styles.tlBadge}><Text style={styles.tlBadgeText}>{t.meta}</Text></View>}
                </View>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.titleRow}>
          <Text style={styles.h2}>Что вытаскивает из дома</Text>
          <Pressable onPress={() => setSheet('interests')} style={styles.round} accessibilityRole="button" accessibilityLabel="Изменить интересы">
            <Ic d="M4 20h4L18.5 9.5a2.1 2.1 0 00-3-3L5 17zM13.5 6.5l3 3" size={17} color={colors.ink} w={1.9} />
          </Pressable>
        </View>
        {/* Плитка = интерес. Число — сколько такого на неделе; тап — карта с этим фильтром. */}
        <View style={styles.tiles}>
          {draft.interests.map((k) => {
            const ic = INTEREST_CAT[k].icon;
            const n = interestCount(k);
            return (
              <Pressable key={k} onPress={() => openInterest(k)} style={({ pressed }) => [styles.tile, { backgroundColor: CAT_COLOR[ic], transform: [{ scale: pressed ? 0.97 : 1 }] }]}
                accessibilityRole="button" accessibilityLabel={`${INTEREST_LABEL[k]}: ${n} на неделе. Показать на карте`}>
                <Ic d={CAT_ICON[ic]} size={22} color={catFg(ic)} w={2} />
                <Text style={[styles.tileName, { color: catFg(ic) }]} numberOfLines={1}>{INTEREST_LABEL[k]}</Text>
                <Text style={[styles.tileN, { color: catFg(ic) }]}>{n ? `${n} на неделе` : 'скоро будет'}</Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable onPress={() => router.push('/marker')} style={styles.markerCard} accessibilityRole="button">
          <View style={{ paddingTop: 16 }}>
            <RingView r={ring} size={52}>{face}</RingView>
            <View style={{ position: 'absolute', top: 0, left: 26 }}><StatusTag label={statusSticker(marker.status).label} small /></View>
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.rowTitle}>Мой значок на карте</Text>
            <Text style={styles.rowSub}>{marker.invisible ? 'невидимка включена' : `кольцо «${ring.name}» · статус`}</Text>
          </View>
          <Ic d={IC.chevron} size={18} color={colors.muted} w={2} />
        </Pressable>

        <View style={styles.suggest}>
          <Text style={styles.suggestTitle}>Знаешь событие, которого нет на карте?</Text>
          <Text style={styles.rowSub}>Скинь ссылку или скрин афиши — остальное заполним сами.</Text>
          <Pressable onPress={() => router.push('/suggest')} style={styles.suggestBtn} accessibilityRole="button">
            <Ic d={IC.plus} size={16} color={colors.paper} w={2.2} />
            <Text style={styles.suggestBtnText}>Предложить событие</Text>
          </Pressable>
        </View>

        <View style={styles.list}>
          {[['Настройки и приватность', '/settings'], ['Помощь', '/settings']].map(([label, to], i) => (
            <Pressable key={label} onPress={() => router.push(to as '/settings')} style={[styles.listRow, i === 0 && styles.line]} accessibilityRole="button">
              <Text style={[styles.rowTitle, { flex: 1, fontFamily: fonts.body500 }]}>{label}</Text>
              <Ic d={IC.chevron} size={18} color={colors.muted} w={2} />
            </Pressable>
          ))}
        </View>
      </ScrollView>

      {sheet && (
        <>
          <Backdrop onPress={() => setSheet(null)} opacity={0.35} label="Закрыть" />
          <BottomSheet onClose={() => setSheet(null)} label={sheet === 'badges' ? 'Значки' : typeof sheet === 'object' ? 'День в хронике' : 'Изменить'} style={{ paddingBottom: 24 }}>
            {sheet === 'badges' && (
              <>
                <View style={styles.titleRow}>
                  <View style={{ gap: 2 }}>
                    <Text style={styles.h2}>Значки</Text>
                    <Text style={styles.rowSub}>{gotCount} из {badges.length} · за разнообразие, а не за количество</Text>
                  </View>
                  <Pressable onPress={() => setSheet(null)} style={styles.round} accessibilityRole="button" accessibilityLabel="Закрыть"><Ic d={IC.close} size={16} color={colors.ink} w={2.2} /></Pressable>
                </View>
                <ScrollView style={{ maxHeight: 500 }} contentContainerStyle={styles.bGrid}>
                  {badges.map((b) => (
                    <View key={b.id} style={[styles.bCard, !b.got && { backgroundColor: 'transparent', borderColor: colors.line2 }]} accessibilityLabel={`${b.name}. ${b.how}. ${b.got ? 'Получен' : `${b.progress} из ${b.goal}`}`}>
                      <View style={[styles.disc, { width: 48, height: 48 }, !b.got && { backgroundColor: colors.sand }]}><Ic d={b.icon} size={20} color={b.got ? colors.accent : colors.muted3} /></View>
                      <Text style={styles.bName} numberOfLines={2}>{b.name}</Text>
                      <Text style={styles.bFoot}>{b.got ? 'ПОЛУЧЕН' : `${b.progress} / ${b.goal}`}</Text>
                    </View>
                  ))}
                </ScrollView>
              </>
            )}
            {sheet === 'interests' && (
              <>
                <Text style={styles.h2}>Что вытаскивает из дома</Text>
                <View style={styles.chips}>
                  {(Object.keys(INTEREST_LABEL) as Interest[]).map((k) => (
                    <Chip key={k} label={INTEREST_LABEL[k]} on={draft.interests.includes(k)}
                      onPress={() => update({ interests: draft.interests.includes(k) ? draft.interests.filter((x) => x !== k) : [...draft.interests, k] })} />
                  ))}
                </View>
                <Pressable disabled={draft.interests.length < 3} onPress={() => { finish(); setSheet(null); }} style={[styles.suggestBtn, draft.interests.length < 3 && { backgroundColor: colors.sand }]} accessibilityRole="button">
                  <Text style={[styles.suggestBtnText, draft.interests.length < 3 && { color: colors.muted3 }]}>{draft.interests.length < 3 ? 'Выбери хотя бы 3' : 'Сохранить'}</Text>
                </Pressable>
              </>
            )}
            {typeof sheet === 'object' && sheet && 'day' in sheet && (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  {sheet.day.category && <View style={[styles.tlDot, { width: 48, height: 48, borderRadius: 15, backgroundColor: CAT_COLOR[sheet.day.category] }]}><Ic d={CAT_ICON[sheet.day.category]} size={22} color={catFg(sheet.day.category)} w={2} /></View>}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.tlWd}>{sheet.day.date}</Text>
                    <Text style={styles.h2} numberOfLines={2}>{sheet.day.title}</Text>
                  </View>
                </View>
                {!!sheet.day.place && <Text style={styles.about}>{sheet.day.place}</Text>}
                {(sheet.day.with ?? []).length > 0 && (
                  <View style={{ gap: 8 }}>
                    <Text style={styles.cityCap}>БЫЛИ ВМЕСТЕ</Text>
                    {(sheet.day.with ?? []).map((id) => people.find((p) => p.id === id)).filter(Boolean).map((p) => (
                      <Pressable key={p!.id} onPress={() => { setSheet(null); router.push({ pathname: '/person/[id]', params: { id: p!.id } }); }} style={styles.dayRow} accessibilityRole="link">
                        <Avatar p={p!} size={36} ring={colors.friend} /><Text style={[styles.rowTitle, { flex: 1 }]}>{p!.name}</Text><Ic d={IC.chevron} size={16} color={colors.muted} w={2} />
                      </Pressable>
                    ))}
                  </View>
                )}
                {!!sheet.day.meta && <View style={[styles.tlBadge, { alignSelf: 'flex-start' }]}><Text style={styles.tlBadgeText}>{sheet.day.meta}</Text></View>}
              </>
            )}
            {sheet === 'edit' && (
              <>
                <Text style={styles.h2}>Изменить профиль</Text>
                <TextInput value={draft.name} onChangeText={(name) => update({ name })} style={styles.input} placeholder="Имя" placeholderTextColor={colors.muted3} accessibilityLabel="Имя" />
                <Pressable onPress={() => setSheet(null)} style={styles.suggestBtn} accessibilityRole="button"><Text style={styles.suggestBtnText}>Готово</Text></Pressable>
              </>
            )}
          </BottomSheet>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 },
  h1: { fontFamily: fonts.display700, fontSize: 30, letterSpacing: -0.75, color: colors.ink },
  h2: { fontFamily: fonts.display700, fontSize: 21, color: colors.ink, paddingHorizontal: 4 },
  round: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', gap: 14, alignItems: 'flex-start', paddingHorizontal: 4 },
  cam: { position: 'absolute', right: -2, bottom: -2, width: 26, height: 26, borderRadius: 9, backgroundColor: colors.ink, borderWidth: 2, borderColor: colors.paper, alignItems: 'center', justifyContent: 'center' },
  name: { fontFamily: fonts.display700, fontSize: 24, color: colors.ink },
  handleText: { fontFamily: fonts.body500, fontSize: 14, color: colors.muted2 },
  insta: { width: 28, height: 28, borderRadius: 9, backgroundColor: colors.sand2, alignItems: 'center', justifyContent: 'center' },
  about: { fontFamily: fonts.body400, fontSize: 13, color: colors.muted },
  menu: { marginTop: -8, marginHorizontal: 4, alignSelf: 'flex-start', backgroundColor: colors.ink, borderRadius: 16, padding: 6 },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 44, paddingHorizontal: 12, borderRadius: 12 },
  menuText: { fontFamily: fonts.body500, fontSize: 14, color: colors.paper },
  halfBtn: { flex: 1, height: 46, borderRadius: 16, borderWidth: 1, borderColor: colors.line2, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  halfText: { fontFamily: fonts.body600, fontSize: 14, color: colors.ink },
  stat: { flex: 1, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, gap: 2 },
  statN: { fontFamily: fonts.display700, fontSize: 26, color: colors.ink },
  statL: { fontFamily: fonts.body400, fontSize: 12.5, color: colors.muted },
  cityCard: { borderRadius: 24, backgroundColor: colors.ink, padding: 16, gap: 10 },
  cityCap: { fontFamily: fonts.mono600, fontSize: 10.5, letterSpacing: 0.8, color: '#BDB8AD' },
  cityTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: -6 },
  pct: { fontFamily: fonts.display800, fontSize: 64, lineHeight: 66, letterSpacing: -2.5, color: colors.paper },
  cityMeta: { fontFamily: fonts.body400, fontSize: 13, color: '#E4E0D6' },
  bar: { height: 6, borderRadius: 3, backgroundColor: colors.darkCard, marginTop: 4 },
  barFill: { height: 6, borderRadius: 3, backgroundColor: colors.accent },
  barMark: { position: 'absolute', top: -4, width: 2, height: 14, marginLeft: -1, backgroundColor: colors.paper },
  levelRow: { flexDirection: 'row', justifyContent: 'space-between' },
  levelText: { fontFamily: fonts.body400, fontSize: 12.5, color: '#E4E0D6' },
  district: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  districtName: { width: 110, fontFamily: fonts.body400, fontSize: 14, color: colors.ink },
  dBar: { flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.sand },
  dFill: { height: 6, borderRadius: 3, backgroundColor: colors.ink },
  dPct: { width: 40, textAlign: 'right', fontFamily: fonts.mono600, fontSize: 11.5, color: colors.ink },
  list: { borderRadius: 18, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14 },
  line: { borderBottomWidth: 1, borderBottomColor: colors.sand },
  rowTitle: { fontFamily: fonts.body600, fontSize: 15, color: colors.ink },
  rowSub: { fontFamily: fonts.body400, fontSize: 12.5, color: colors.muted },
  cBar: { height: 6, borderRadius: 3, backgroundColor: colors.ink },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  country: { width: '31.9%', flexGrow: 1, padding: 12, borderRadius: 16, borderWidth: 1, gap: 4 },
  iso: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#B9B2A3' },
  isoText: { fontFamily: fonts.mono600, fontSize: 11 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 14, borderRadius: 18, borderWidth: 1, borderColor: colors.line2, backgroundColor: colors.card },
  pillText: { fontFamily: fonts.body600, fontSize: 13, color: colors.ink },
  badgeRow: { flexDirection: 'row' },
  badge: { flex: 1, alignItems: 'center', gap: 6 },
  disc: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  badgeName: { textAlign: 'center', fontFamily: fonts.body600, fontSize: 12, color: colors.ink, paddingHorizontal: 2 },
  tl: { flexDirection: 'row', gap: 10 },
  tlDateBox: { width: 40, alignItems: 'center' },
  tlDay: { fontFamily: fonts.display700, fontSize: 20, lineHeight: 22, color: colors.ink },
  tlWd: { fontFamily: fonts.mono600, fontSize: 9.5, letterSpacing: 0.6, color: colors.muted },
  tlRail: { alignItems: 'center', width: 26 },
  tlDot: { width: 26, height: 26, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  tlLine: { flex: 1, width: 2, marginVertical: 3, borderRadius: 1, backgroundColor: colors.line2 },
  tlBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 7, backgroundColor: colors.softYellow },
  tlBadgeText: { fontFamily: fonts.body600, fontSize: 11.5, color: colors.ink },
  dayRow: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 48 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: { width: '48.8%', flexGrow: 1, minHeight: 96, borderRadius: 20, padding: 14, justifyContent: 'space-between', gap: 6 },
  tileName: { fontFamily: fonts.display700, fontSize: 15.5 },
  tileN: { fontFamily: fonts.mono600, fontSize: 10.5, letterSpacing: 0.4, opacity: 0.85 },
  link: { fontFamily: fonts.body600, fontSize: 13, color: colors.ink, textDecorationLine: 'underline' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  darkChip: { height: 38, paddingHorizontal: 14, borderRadius: 19, backgroundColor: colors.ink, justifyContent: 'center' },
  darkChipText: { fontFamily: fonts.body500, fontSize: 14, color: colors.paper },
  markerCard: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: 18, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card },
  suggest: { padding: 16, borderRadius: 20, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.line2, gap: 8 },
  suggestTitle: { fontFamily: fonts.display700, fontSize: 17, color: colors.ink },
  suggestBtn: { height: 52, marginTop: 6, borderRadius: 16, backgroundColor: colors.ink, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' },
  suggestBtnText: { fontFamily: fonts.body600, fontSize: 15, color: colors.paper },
  bGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  bCard: { width: '31.8%', height: 124, borderRadius: 18, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 6 },
  bName: { textAlign: 'center', fontFamily: fonts.body600, fontSize: 13, color: colors.ink },
  bFoot: { fontFamily: fonts.mono600, fontSize: 9.5, letterSpacing: 0.5, color: colors.muted },
  input: { height: 52, paddingHorizontal: 16, borderWidth: 1, borderColor: colors.line2, borderRadius: 16, backgroundColor: colors.card, fontFamily: fonts.body400, fontSize: 16, color: colors.ink },
});
