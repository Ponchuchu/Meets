import { useSocialActions } from '../../live/socialActions';
// Профиль человека: не в друзьях (Person) и друг (PersonFriend). Что видно — по правилам «Кто что видит».
import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StateView } from '../../ui/StateView';
import { Image, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { APP_URL } from '../../lib/config';
import { ART } from '../../ui/art';
import { birthdayText } from '../../lib/format';
import { FriendsPill, PlansStrip } from '../profile/PlansStrip';
import { GlassBtn, HeroChip, kit, PhotoHero, Ring, Tile, TileCap, TileNum, TileSub } from '../profile/ProfileKit';
import { useSession } from '../../state/session';
import { useProfile, type MyCard } from '../../state/profile';
import type { PersonDetails } from '../../data/types';
import { DEFAULT_PRIVACY } from '../../people/visibility';
import { Cake, CalendarPlus, Check, ChevronLeft, ChevronRight, EyeOff, Flag, Link2, MoreHorizontal, PenLine, Share2, Footprints, Images, LocateFixed, MessageCircle, UserMinus, UserPlus, Users } from 'lucide-react-native';
import { frameById } from '../../profile/frames';
import { plate } from '../../ui/glass';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { data, eventsSnapshot } from '../../data';
import { now as clockNow } from '../../lib/clock';
import { CAT_ICON } from '../../map/icons';
import { canSee } from '../../people/visibility';
import { BADGES } from '../../profile/badges';
import { getShownBadges } from '../../live/profileExtras';
import { BadgeMedal } from '../../ui/BadgeMedal';
import { planWhen } from '../../lib/planWhen';
import { useMapState } from '../../state/map';
import { isFriendNow } from '../../state/social';
import { colors, fonts } from '../../theme';
import { Avatar } from '../../ui/Avatar';
import { Ic, IC } from '../../ui/Ic';
import { Backdrop, BottomSheet } from '../../ui/sheet';
import { Toast, type ToastData } from '../../ui/Toast';

const plural = (n: number, a: string, b: string, c: string) => { const m10 = n % 10, m100 = n % 100; return m10 === 1 && m100 !== 11 ? a : m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20) ? b : c; };


/** Свой профиль в демо для «Как видят другие»: то, что заполнено в «Редактировать профиль». */
function selfDetails(card: MyCard, frame: string): PersonDetails {
  return { id: 'me', about: card.about, interests: [], badges: ['opener', 'night'], gallery: [], online: true,
    commonFriends: [], friendsCount: 4, commonCount: 0, friendIds: [], plans: [], privacy: DEFAULT_PRIVACY, stepsToday: 6240, frame, interestKeys: [] } as unknown as PersonDetails;
}

const REASONS = ['Спам или реклама', 'Оскорбления', 'Фейковый профиль', 'Неприемлемые фото', 'Младше 18', 'Другое'];

export default function PersonScreen() {
  const insets = useSafeAreaInsets();
  const { id, preview: previewParam } = useLocalSearchParams<{ id: string; preview?: string }>();
  // «Как видят другие» (26 окт.): свой профиль глазами друга — без кнопок, с плашкой сверху.
  const preview = previewParam === '1';
  const draft = useSession((s) => s.draft);
  const myCard = useProfile((s) => s.card);
  const myFrame = useProfile((s) => s.mapFrame);
  const now = clockNow();
  const [sheet, setSheet] = useState<null | 'report' | 'remove' | 'menu' | 'rename'>(null);
  const [nick, setNick] = useState('');
  const [toast, setToast] = useState<ToastData | null>(null);
  const peopleQ = useQuery({ queryKey: ['people'], queryFn: () => data.getPeople() });
  const people = peopleQ.data ?? [];
  const detailsQ = useQuery({ queryKey: ['person', id], queryFn: () => data.getPersonDetails(id) });
  const selfDemo = preview && id === 'me';
  const d = selfDemo ? selfDetails(myCard, myFrame) : detailsQ.data;
  // Награды, которые человек поставил у имени (FIX3 Ф8).
  const { data: shownBadges = [] } = useQuery({ queryKey: ['person', id, 'badges'], queryFn: () => getShownBadges(id) });
  const { data: events = [] } = useQuery({ queryKey: ['events'], queryFn: () => data.getEvents(), placeholderData: eventsSnapshot });
  const { data: theirFriends } = useQuery({ queryKey: ['person', id, 'friends'], queryFn: () => data.getPersonFriends(id), enabled: !(preview && id === 'me') });
  const { data: spots = [] } = useQuery({ queryKey: ['friendSpots'], queryFn: () => data.getFriendSpots() });
  const social = useSocialActions(text => setToast({ text }));
  const focusFriend = useMapState((s) => s.focusFriend);
  const p = selfDemo ? { id: 'me', name: draft.name || 'Ты', photo: draft.photo, initial: (draft.name?.[0] ?? 'Я').toUpperCase(), tint: '#DDE8D9', isFriend: true } as typeof people[number] : people.find((x) => x.id === id) ?? (preview && d ? { id, name: draft.name || 'Ты', photo: d.photo ?? draft.photo, initial: (draft.name?.[0] ?? 'Я').toUpperCase(), tint: '#DDE8D9', isFriend: true } as typeof people[number] : undefined);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/me'));
  const show = (t: ToastData) => { setToast(t); setTimeout(() => setToast((c) => (c === t ? null : c)), 3500); };
  // Пока профиль грузится или человек не найден — понятное состояние и кнопка «Назад», а не пустой экран.
  if (!p || !d) return (
    <View style={[styles.root, { justifyContent: 'center' }]}>
      <Pressable onPress={back} style={[styles.back, { top: Math.max(50, insets.top + 6) }]} accessibilityRole="button" accessibilityLabel="Назад"><Ic d={IC.back} size={20} color={colors.ink} w={2} /></Pressable>
      <StateView kind={peopleQ.isPending || detailsQ.isPending ? 'loading' : 'empty'} title={peopleQ.isPending || detailsQ.isPending ? 'Открываю профиль…' : 'Профиль недоступен'}
        text={peopleQ.isPending || detailsQ.isPending ? undefined : 'Человек мог скрыть профиль или удалить аккаунт.'} action={peopleQ.isPending || detailsQ.isPending ? undefined : 'Назад'} onAction={back} />
    </View>
  );

  const friend = preview || isFriendNow(p, social);
  const rel = friend ? 'friend' : 'stranger';
  const gallery = d.gallery.length ? d.gallery : p.photo ? [p.photo] : [];
  const spot = spots.find((s) => s.personId === id);
  const look = d.lookingFor && canSee(rel, 'lookingForCompany', d.privacy) ? { ...d.lookingFor, e: events.find((e) => e.id === d.lookingFor!.eventId) } : null;
  const badges = d.badges.map((b) => BADGES.find((x) => x.id === b)).filter(Boolean);
  const common = d.commonFriends.map((cid) => people.find((x) => x.id === cid)).filter(Boolean);
  // Числа — из того же списка, что откроется по нажатию, чтобы «34 друга» не расходилось с экраном друзей.
  const fCount = theirFriends ? theirFriends.length : d.friendsCount;
  const cCount = theirFriends ? theirFriends.filter((x) => x.common).length : d.commonCount;
  const showOnMap = () => { focusFriend(id); router.dismissTo('/'); };
  const write = () => router.push({ pathname: '/chat/[id]', params: { id: `dm-${id}` } });
  const profileLink = `${APP_URL}/person/${id}`;
  const genitive = p.name.endsWith('ь') ? `${p.name.slice(0, -1)}я` : p.name.endsWith('а') ? `${p.name.slice(0, -1)}ы` : `${p.name}а`;

  const frame = frameById(d.frame);
  const seen = d.online ? 'в сети' : d.lastSeen ?? (friend ? 'в друзьях' : 'не в друзьях');
  // Где друг — без названия места (26 окт.): только кнопка геолокации на фото, по нажатию карта находит его.
  const canLocate = friend && !preview && !!spot && canSee('friend', 'location', d.privacy);
  const medals = canSee(rel, 'achievements', d.privacy) ? [...shownBadges, ...badges.map((b) => b!.id).filter((x) => !shownBadges.includes(x))].slice(0, 4) : [];
  const showFriends = friend ? fCount > 0 : common.length > 0;
  const showSteps = d.stepsToday != null;

  // Плитки (bento) парами: друзья, шаги, воспоминания, планы — что есть у человека. Нечётная последняя — во всю ширину.
  const tiles = [
    showSteps ? (<Tile key="steps" accent="#DDEBD7" label={`Шаги сегодня: ${d.stepsToday}`}>
        <View style={styles.ringBox}><Ring value={(d.stepsToday ?? 0) / 10000} size={44} stroke={5} color={colors.ok} track="rgba(23,22,26,0.1)" /><Footprints size={18} color={colors.ok} strokeWidth={2} style={{ position: 'absolute' }} /></View>
        <View>
          <TileNum>{(d.stepsToday ?? 0).toLocaleString('ru-RU')}</TileNum>
          <TileSub>шагов сегодня</TileSub>
        </View>
      </Tile>
    ) : null,
    (d.memoriesCount ?? 0) > 0 ? (<Tile key="mem" accent="#F3D9C9" label="Воспоминания">
        <Images size={24} color={colors.accentText} strokeWidth={1.9} />
        <View><TileNum>{String(d.memoriesCount)}</TileNum><TileSub>{plural(d.memoriesCount ?? 0, 'воспоминание', 'воспоминания', 'воспоминаний')}</TileSub></View>
      </Tile>
    ) : null,
  ].filter(Boolean);
  const pairs = tiles.reduce<React.ReactNode[][]>((acc, t, i) => (i % 2 ? acc[acc.length - 1].push(t) : acc.push([t]), acc), []);

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 + insets.bottom }} showsVerticalScrollIndicator={false}>
        <PhotoHero photos={gallery.length ? gallery : d.photo ? [d.photo] : []} initial={p.initial} tint={p.tint} accent={frame.color} name={p.name}
          photoLabel={`Фото: ${p.name}`}
          nameExtra={shownBadges.slice(0, 1).map((b) => <BadgeMedal key={b} id={b} got size={34} />)}
          top={<>
            <GlassBtn onPress={back} label="Назад"><ChevronLeft size={24} color="#FFFFFF" strokeWidth={2.2} /></GlassBtn>
            {!preview && <GlassBtn onPress={() => setSheet('menu')} label="Ещё: поделиться, скопировать ссылку"><MoreHorizontal size={22} color="#FFFFFF" strokeWidth={2.2} /></GlassBtn>}
          </>}
          meta={<>
            <HeroChip dot={d.online ? '#3DDC84' : undefined}>{seen}</HeroChip>
            {friend && !!birthdayText(d.birthday) && <HeroChip icon={<Cake size={14} color="#FFFFFF" strokeWidth={2.1} />}>{birthdayText(d.birthday)!}</HeroChip>}
            {!friend && <HeroChip>не в друзьях</HeroChip>}
          </>}
          corner={canLocate ? (
            <Pressable onPress={showOnMap} style={({ pressed }) => [styles.geo, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel={`Показать ${p.name === 'Айнура' ? 'Айнуру' : genitive.replace(/а$/, 'а')} на карте`}>
              <LocateFixed size={24} color="#FFFFFF" strokeWidth={2.1} />
            </Pressable>
          ) : undefined} />

        {preview ? (
          <View style={[kit.actions]}>
            <View style={styles.previewBar}>
              <Text style={styles.previewText}>Так твой профиль видят друзья</Text>
              <Pressable onPress={() => router.push('/profile/edit')} style={styles.previewBtn} accessibilityRole="button"><Text style={styles.previewBtnText}>Изменить</Text></Pressable>
            </View>
          </View>
        ) : (
          <View style={kit.actions}>
            <Pressable onPress={write} style={({ pressed }) => [kit.primary, pressed && styles.pressed]} accessibilityRole="button">
              <MessageCircle size={19} color="#FFFFFF" strokeWidth={2} /><Text style={kit.primaryText}>Написать</Text>
            </Pressable>
            {friend
              ? <Pressable onPress={() => { focusFriend(id, true); router.dismissTo('/'); }} style={({ pressed }) => [kit.secondary, pressed && styles.pressed]} accessibilityRole="button">
                  <CalendarPlus size={19} color={colors.ink} strokeWidth={2} /><Text style={kit.secondaryText}>Позвать</Text>
                </Pressable>
              : <Pressable onPress={() => social.toggleRequest(id)} style={({ pressed }) => [kit.secondary, pressed && styles.pressed]} accessibilityRole="button">
                  {social.sent[id] ? <Check size={19} color={colors.ink} strokeWidth={2.2} /> : <UserPlus size={19} color={colors.ink} strokeWidth={2} />}
                  <Text style={kit.secondaryText}>{social.sent[id] ? 'Заявка ушла' : 'В друзья'}</Text>
                </Pressable>}
          </View>
        )}

        <View style={styles.body}>
          {showFriends && (
            <FriendsPill faces={common.map((x) => x!)} onPress={() => router.push({ pathname: '/friends-of/[id]', params: { id, ...(friend ? {} : { tab: 'common' }) } })}
              title={friend ? `${fCount} ${plural(fCount, 'друг', 'друга', 'друзей')}` : `${common.length} ${plural(common.length, 'общий друг', 'общих друга', 'общих друзей')}`}
              sub={friend && cCount ? `${cCount} ${plural(cCount, 'общий', 'общих', 'общих')} с тобой` : friend ? 'посмотреть всех' : undefined} />
          )}

          {friend && canSee('friend', 'plans', d.privacy) && (
            <PlansStrip title={`Планы ${genitive}`} items={d.plans.map((pl, i) => {
              const ev = events.find((x) => x.id === pl.eventId);
              return { key: `${pl.title}-${i}`, title: pl.title, when: pl.when === 'СЕГОДНЯ' ? 'сегодня' : pl.when.toLowerCase(), today: pl.when === 'СЕГОДНЯ', note: pl.note, e: ev, eventId: pl.eventId };
            })} />
          )}

          {pairs.map((pr, i) => <View key={i} style={kit.row}>{pr}</View>)}

          {medals.length > 0 && (
            <Tile dark style={{ minHeight: 0, gap: 14 }} label="Награды">
              <View style={styles.rowBetween}><TileCap light>Награды</TileCap><Text style={styles.awardsN}>{badges.length}</Text></View>
              <View style={styles.medals}>
                {medals.map((bid) => (
                  <View key={bid} style={styles.medal}>
                    <BadgeMedal id={bid} got size={62} />
                    <Text style={styles.medalName} numberOfLines={2}>{BADGES.find((x) => x.id === bid)?.name ?? 'Награда'}</Text>
                  </View>
                ))}
              </View>
            </Tile>
          )}

          {look?.e && (
            <View style={styles.look}>
              <View style={styles.lookHead}><Text style={styles.lookCap}>ХОЧЕТ ПОЙТИ · ИЩЕТ КОМПАНИЮ</Text><Text style={styles.lookCap}>{planWhen(look.e, now).text.split(' · ')[0].replace(/(\d+)\.(\d+)/, (_m, a, b) => `${a.padStart(2, '0')}.${b.padStart(2, '0')}`)}</Text></View>
              <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                <View style={styles.lookIcon}><Ic d={CAT_ICON[look.e.category]} size={22} color={colors.paper} w={2} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.lookTitle}>{look.e.title}</Text>
                  <Text style={styles.lookMeta}>{planWhen(look.e, now).text.split(' · ')[1]} · {look.e.venueName ?? look.e.address.split(',')[0]}{look.e.priceMin ? ` · ${look.e.priceMin.toLocaleString('ru-RU')} ₸` : ''}</Text>
                </View>
              </View>
              <Pressable onPress={write} style={styles.lookBtn} accessibilityRole="button"><Text style={styles.lookBtnText}>Позвать пойти вместе</Text></Pressable>
            </View>
          )}

          {!!d.about.trim() && (
            <View style={styles.quote}>
              <Text style={styles.quoteMark}>“</Text>
              <Text style={styles.quoteText}>{d.about}</Text>
            </View>
          )}
          {!d.about.trim() && preview && (
            <Pressable onPress={() => router.push('/profile/edit')} style={[styles.quote, { flexDirection: 'row', alignItems: 'center', gap: 12 }]} accessibilityRole="button">
              <Image source={ART.wave} style={{ width: 56, height: 56 }} />
              <Text style={[styles.sub, { flex: 1, fontSize: 14 }]}>Расскажи пару слов о себе — так друзьям проще позвать тебя куда-то.</Text>
            </Pressable>
          )}

        </View>
      </ScrollView>

      {toast && <Toast t={toast} style={{ position: 'absolute', left: 16, right: 16, bottom: 20 + insets.bottom }} />}
      {sheet && (
        <>
          <Backdrop onPress={() => setSheet(null)} label="Закрыть" />
          <BottomSheet onClose={() => setSheet(null)} label={sheet === 'menu' ? 'Ещё' : sheet === 'rename' ? 'Переименовать' : sheet === 'report' ? 'Пожаловаться' : 'Убрать из друзей'} style={{ paddingBottom: 30 + insets.bottom }}>
            {sheet === 'menu' ? (
              <View style={styles.list}>
                {[
                  { Icon: Link2, label: 'Скопировать ссылку', on: () => { void Clipboard.setStringAsync(profileLink).then(() => { setSheet(null); show({ text: 'Ссылка на профиль скопирована' }); }); } },
                  { Icon: Share2, label: 'Поделиться профилем', on: () => { setSheet(null); Share.share({ message: `${p.name} в Meets: ${profileLink}` }).catch(() => undefined); } },
                  ...(friend ? [{ Icon: PenLine, label: 'Переименовать для себя', on: () => { setNick(social.nicknames[id] ?? ''); setSheet('rename'); } }] : []),
                  ...(friend ? [{ Icon: UserMinus, label: 'Убрать из друзей', on: () => setSheet('remove'), danger: true }] : [{ Icon: EyeOff, label: social.hidden[id] ? 'Профиль скрыт' : 'Скрыть из подборок', on: () => { social.hide(id); setSheet(null); show({ text: `${p.name} больше не будет в подборках людей` }); } }]),
                  { Icon: Flag, label: social.reported[id] ? 'Жалоба отправлена' : 'Пожаловаться', on: () => setSheet('report'), danger: true },
                ].map((m, i, all) => (
                  <Pressable key={m.label} onPress={m.on} style={[styles.menuRow, i < all.length - 1 && styles.line]} accessibilityRole="button">
                    <m.Icon size={19} color={'danger' in m && m.danger ? colors.accentText : colors.ink} strokeWidth={2} />
                    <Text style={[styles.planTitle, { flex: 1 }, 'danger' in m && m.danger && { color: colors.accentText }]}>{m.label}</Text>
                  </Pressable>
                ))}
              </View>
            ) : sheet === 'rename' ? (
              <>
                <Text style={styles.h2}>Как ты зовёшь {p.name === 'Айнура' ? 'Айнуру' : genitive}?</Text>
                <Text style={styles.sub}>Это имя видишь только ты — в друзьях, чатах и на карте.</Text>
                <TextInput value={nick} onChangeText={setNick} autoFocus maxLength={30} placeholder={p.name} placeholderTextColor={colors.muted3} style={styles.input} accessibilityLabel="Имя для себя" />
                <Pressable onPress={() => { social.setNickname(id, nick.trim()); setSheet(null); show({ text: nick.trim() ? 'Готово — так он будет подписан у тебя' : 'Вернули настоящее имя' }); }} style={[styles.btn, { backgroundColor: colors.ink }]} accessibilityRole="button"><Text style={[styles.btnText, { color: colors.paper }]}>Сохранить</Text></Pressable>
              </>
            ) : sheet === 'report' ? (
              <>
                <Text style={styles.h2}>Пожаловаться на {p.name === 'Айнура' ? 'Айнуру' : p.name}</Text>
                <Text style={styles.sub}>Команда проверит в течение суток. {p.name} не узнает, кто пожаловался.</Text>
                <View style={styles.list}>
                  {REASONS.map((r, i) => (
                    <Pressable key={r} onPress={() => { social.report(id); setSheet(null); show({ text: 'Жалоба отправлена. Спасибо, что сказал' }); }} style={[styles.planRow, i < REASONS.length - 1 && styles.line]} accessibilityRole="button">
                      <Text style={[styles.planTitle, { flex: 1 }]}>{r}</Text><Ic d={IC.chevron} size={16} color={colors.muted} w={2} />
                    </Pressable>
                  ))}
                </View>
              </>
            ) : (
              <>
                <Text style={styles.h2}>Убрать {p.name === 'Айнура' ? 'Айнуру' : `${genitive}`} из друзей?</Text>
                <Text style={styles.sub}>Вы перестанете видеть планы и геолокацию друг друга. Чат останется.</Text>
                <Pressable onPress={() => { void social.removeFriend(id).then(ok => { if (ok) setSheet(null); }); }} style={[styles.btn, { backgroundColor: colors.accentText, flex: 0, height: 52 }]} accessibilityRole="button"><Text style={[styles.btnText, { color: colors.paper }]}>Убрать</Text></Pressable>
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
  menuBtn: { position: 'absolute', right: 16, width: 44, height: 44, borderRadius: 22, ...plate, alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  back: { position: 'absolute', left: 16, width: 44, height: 44, borderRadius: 22, ...plate, alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  head: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 8, gap: 4 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 24, marginTop: 6 },
  name: { fontFamily: fonts.display800, fontSize: 28, letterSpacing: -0.8, color: colors.ink, flexShrink: 1 },
  seenRow: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.ok, marginRight: 6 },
  seen: { fontFamily: fonts.body500, fontSize: 14, color: colors.muted },
  body: { paddingHorizontal: 16, paddingTop: 12, gap: 10 },
  actions: { flexDirection: 'row', gap: 8 },
  action: { flex: 1, height: 66, borderRadius: 18, ...plate, alignItems: 'center', justifyContent: 'center', gap: 5 },
  actionDark: { backgroundColor: colors.ink, borderTopColor: 'rgba(255,255,255,0.18)', borderLeftColor: 'rgba(255,255,255,0.06)', borderRightColor: 'rgba(255,255,255,0.06)', borderBottomColor: 'rgba(0,0,0,0.4)' },
  actionText: { fontFamily: fonts.body600, fontSize: 12.5, color: colors.ink },
  geo: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.friend, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.5)', boxShadow: '0 10px 24px -8px rgba(37,72,201,0.8)' },
  tileIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(23,22,26,0.07)', alignItems: 'center', justifyContent: 'center' },
  ringBox: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  awardsN: { fontFamily: fonts.body600, fontSize: 13, color: 'rgba(255,255,255,0.72)' },
  medals: { flexDirection: 'row', justifyContent: 'space-between' },
  medal: { flex: 1, alignItems: 'center', gap: 6 },
  medalName: { fontFamily: fonts.body600, fontSize: 12, lineHeight: 15, color: '#E7E2D8', textAlign: 'center' },
  quote: { borderRadius: 28, backgroundColor: '#F4F0E7', padding: 18, paddingTop: 10 },
  quoteMark: { fontFamily: fonts.display800, fontSize: 54, lineHeight: 54, color: colors.accent, marginBottom: -18 },
  quoteText: { fontFamily: fonts.body500, fontSize: 18, lineHeight: 25, color: colors.ink },
  when: { minWidth: 74, height: 30, paddingHorizontal: 10, borderRadius: 15, backgroundColor: colors.sand, alignItems: 'center', justifyContent: 'center' },
  pressed: { transform: [{ scale: 0.97 }], opacity: 0.9 },
  now: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 20, ...plate },
  nowIcon: { width: 40, height: 40, borderRadius: 13, backgroundColor: colors.friend, alignItems: 'center', justifyContent: 'center' },
  nowTitle: { fontFamily: fonts.body700, fontSize: 15, color: colors.ink },
  sub: { fontFamily: fonts.body400, fontSize: 13, color: colors.muted },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { width: '48.4%', flexGrow: 1, minHeight: 116, borderRadius: 22, ...plate, padding: 14, justifyContent: 'flex-end' },
  tileArt: { width: 46, height: 46, marginBottom: 'auto' },
  friendsRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingHorizontal: 16, borderRadius: 22, backgroundColor: colors.card },
  stack: { flexDirection: 'row', alignItems: 'center', minWidth: 34 },
  stackItem: { borderRadius: 19, borderWidth: 2, borderColor: colors.card },
  friendsTitle: { fontFamily: fonts.body600, fontSize: 16, color: colors.ink },
  previewBar: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, paddingLeft: 16, borderRadius: 18, backgroundColor: colors.ink },
  previewText: { flex: 1, fontFamily: fonts.body600, fontSize: 14, color: colors.paper },
  previewBtn: { minHeight: 36, paddingHorizontal: 14, borderRadius: 18, backgroundColor: colors.paper, justifyContent: 'center' },
  previewBtnText: { fontFamily: fonts.body700, fontSize: 13.5, color: colors.ink },
  tileN: { fontFamily: fonts.display800, fontSize: 24, letterSpacing: -0.6, color: colors.ink, marginTop: 10 },
  tileL: { fontFamily: fonts.body500, fontSize: 13, color: colors.muted2 },
  card: { borderRadius: 28, backgroundColor: '#F4F0E7', padding: 16, gap: 6 },
  cardTitle: { fontFamily: fonts.display700, fontSize: 18, color: colors.ink },
  look: { padding: 16, borderRadius: 22, backgroundColor: colors.accent, gap: 14 },
  lookHead: { flexDirection: 'row', justifyContent: 'space-between' },
  lookCap: { fontFamily: fonts.mono600, fontSize: 10.5, letterSpacing: 0.6, color: colors.ink },
  lookIcon: { width: 52, height: 52, borderRadius: 16, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  lookTitle: { fontFamily: fonts.display700, fontSize: 20, lineHeight: 22, color: colors.ink },
  lookMeta: { fontFamily: fonts.body400, fontSize: 13, color: colors.ink, marginTop: 2 },
  lookBtn: { height: 48, borderRadius: 14, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  lookBtnText: { fontFamily: fonts.body600, fontSize: 14, color: colors.paper },
  h2: { fontFamily: fonts.display700, fontSize: 20, color: colors.ink, marginTop: 4 },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 54, paddingHorizontal: 16 },
  input: { height: 52, paddingHorizontal: 14, borderRadius: 16, borderWidth: 1, borderColor: colors.line2, backgroundColor: colors.card, fontFamily: fonts.body500, fontSize: 16, color: colors.ink },
  list: { borderRadius: 18, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card },
  planRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  line: { borderBottomWidth: 1, borderBottomColor: colors.sand },
  planWhen: { fontFamily: fonts.body600, fontSize: 12.5, color: colors.ink },
  planTitle: { fontFamily: fonts.body600, fontSize: 15, color: colors.ink },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  about: { fontFamily: fonts.body400, fontSize: 15, lineHeight: 22.5, color: colors.muted2 },
  badgeLine: { fontFamily: fonts.mono600, fontSize: 10.5, letterSpacing: 0.5, color: colors.ink },
  badge: { flex: 1, alignItems: 'center', gap: 6 },
  badgeName: { textAlign: 'center', fontFamily: fonts.body600, fontSize: 12, color: colors.ink },
  btn: { height: 52, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  btnText: { fontFamily: fonts.body600, fontSize: 15, color: colors.ink },
  footer: { flexDirection: 'row', justifyContent: 'center', gap: 10, paddingTop: 8 },
  footBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, paddingHorizontal: 14, borderRadius: 22, backgroundColor: colors.sand },
  footText: { fontFamily: fonts.body500, fontSize: 14, color: colors.muted2 },
});
