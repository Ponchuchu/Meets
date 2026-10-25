import { useSocialActions } from '../../live/socialActions';
// Профиль человека: не в друзьях (Person) и друг (PersonFriend). Что видно — по правилам «Кто что видит».
import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StateView } from '../../ui/StateView';
import { Image, Linking, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { APP_URL } from '../../lib/config';
import Svg, { Circle, Path } from 'react-native-svg';
import { ART } from '../../ui/art';
import { Showcase } from '../profile/Showcase';
import { useSession } from '../../state/session';
import { useProfile, type MyCard } from '../../state/profile';
import type { PersonDetails } from '../../data/types';
import { DEFAULT_PRIVACY } from '../../people/visibility';
import { CalendarPlus, Check, ChevronLeft, ChevronRight, EyeOff, Flag, Link2, MoreHorizontal, PenLine, Share2, Footprints, Images, Lock, MapPin, MessageCircle, UserMinus, UserPlus, Users, type LucideIcon } from 'lucide-react-native';
import { AvatarFrame, frameById } from '../../profile/frames';
import { Aura } from '../profile/ProfileScreen';
import { plate } from '../../ui/glass';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { data, eventsSnapshot } from '../../data';
import { MY_SPOT } from '../../data/demo';
import { now as clockNow } from '../../lib/clock';
import { CAT_ICON } from '../../map/icons';
import { canSee, distanceM } from '../../people/visibility';
import { BADGES, badgeIcon } from '../../profile/badges';
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

type IconLike = (p: { size: number; color: string; strokeWidth: number }) => React.ReactNode;
const INSTA = 'M7 3.5h10A3.5 3.5 0 0120.5 7v10a3.5 3.5 0 01-3.5 3.5H7A3.5 3.5 0 013.5 17V7A3.5 3.5 0 017 3.5zM12 8a4 4 0 100 8 4 4 0 000-8zM17.2 6.8h.01';
const Instagram: IconLike = ({ size, color }) => <Ic d={INSTA} size={size} color={color} w={1.9} />;

function Action({ Icon, label, onPress, dark }: { Icon: LucideIcon | IconLike; label: string; onPress: () => void; dark?: boolean }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.action, dark && styles.actionDark, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel={label}>
      <Icon size={22} color={dark ? colors.paper : colors.ink} strokeWidth={1.9} />
      <Text style={[styles.actionText, dark && { color: colors.paper }]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}
/** Значок устройства: яблоко (iPhone) или голова Android-робота. */
function DeviceMark({ os }: { os: 'ios' | 'android' }) {
  return os === 'ios'
    ? <Svg width={13} height={13} viewBox="0 0 24 24"><Path d="M16.4 12.6c0-2.4 2-3.6 2.1-3.6-1.1-1.7-2.9-1.9-3.5-1.9-1.5-.2-2.9.9-3.7.9-.8 0-1.9-.9-3.2-.8-1.6 0-3.1 1-4 2.4-1.7 3-.4 7.4 1.2 9.8.8 1.2 1.8 2.5 3 2.4 1.2 0 1.7-.8 3.1-.8 1.5 0 1.9.8 3.2.8 1.3 0 2.2-1.2 3-2.4.9-1.4 1.3-2.7 1.3-2.8 0 0-2.5-1-2.5-4zM14 5.6c.7-.8 1.1-1.9 1-3-1 0-2.1.7-2.8 1.5-.6.7-1.2 1.8-1 2.9 1.1.1 2.1-.6 2.8-1.4z" fill={colors.muted2} /></Svg>
    : <Svg width={14} height={14} viewBox="0 0 24 24"><Path d="M5 15a7 7 0 0114 0z" fill="#3DDC84" /><Path d="M7.5 7.5L6 5M16.5 7.5L18 5" stroke="#3DDC84" strokeWidth={1.6} strokeLinecap="round" /><Circle cx={9.5} cy={12} r={0.9} fill="#FFFFFF" /><Circle cx={14.5} cy={12} r={0.9} fill="#FFFFFF" /></Svg>;
}

/** Свой профиль в демо для «Как видят другие»: то, что заполнено в «Редактировать профиль». */
function selfDetails(card: MyCard, frame: string): PersonDetails {
  return { id: 'me', about: card.about, interests: card.tags.map((label) => ({ label, common: true })), badges: ['opener', 'night'], gallery: [], online: true, instagram: card.instagram || undefined,
    commonFriends: [], friendsCount: 4, commonCount: 0, friendIds: [], plans: [], privacy: DEFAULT_PRIVACY, status: card.status || undefined, device: 'ios', stepsToday: 6240, frame, interestKeys: [] } as unknown as PersonDetails;
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
  const [pic, setPic] = useState(0);
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
  const showOnMap = () => { focusFriend(id); router.dismissTo('/'); };
  const write = () => router.push({ pathname: '/chat/[id]', params: { id: `dm-${id}` } });
  const profileLink = `${APP_URL}/person/${id}`;
  const genitive = p.name.endsWith('ь') ? `${p.name.slice(0, -1)}я` : p.name.endsWith('а') ? `${p.name.slice(0, -1)}ы` : `${p.name}а`;

  const frame = frameById(d.frame);
  const heroH = insets.top + 300;
  const seen = d.online ? 'в сети' : d.lastSeen ?? (friend ? 'в друзьях' : 'не в друзьях');
  const where = friend && d.now && canSee('friend', 'location', d.privacy) ? d.now : null;
  // Плитки с картинками (26 окт.): у друга всегда есть что показать — друзья, шаги, планы, альбомы.
  const stats: { key: string; n: string; label: string; art: number }[] = [];
  if (friend) stats.push({ key: 'friends', n: String(d.friendsCount), label: d.commonCount ? `друзей · ${d.commonCount} общих` : plural(d.friendsCount, 'друг', 'друга', 'друзей'), art: ART.highfive });
  if (d.stepsToday != null) stats.push({ key: 'steps', n: d.stepsToday.toLocaleString('ru-RU'), label: 'шагов сегодня', art: ART.sneaker });
  if (friend && d.plans.length) stats.push({ key: 'plans', n: String(d.plans.length), label: plural(d.plans.length, 'план', 'плана', 'планов'), art: ART.route });
  if (d.memoriesCount) stats.push({ key: 'mem', n: String(d.memoriesCount), label: plural(d.memoriesCount, 'воспоминание', 'воспоминания', 'воспоминаний'), art: ART.heart });
  if (!friend && common.length) stats.push({ key: 'common', n: String(common.length), label: plural(common.length, 'общий друг', 'общих друга', 'общих друзей'), art: ART.highfive });

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 + insets.bottom }} showsVerticalScrollIndicator={false}>
        <View style={{ height: heroH, paddingTop: insets.top }}>
          <Aura color={frame.color} height={heroH} />
          <Pressable onPress={back} style={[styles.back, { top: insets.top + 10 }]} accessibilityRole="button" accessibilityLabel="Назад">
            <ChevronLeft size={24} color={colors.ink} strokeWidth={2.2} />
          </Pressable>
          {!preview && (
            <Pressable onPress={() => setSheet('menu')} style={[styles.menuBtn, { top: insets.top + 10 }]} accessibilityRole="button" accessibilityLabel="Ещё: поделиться, скопировать ссылку">
              <MoreHorizontal size={22} color={colors.ink} strokeWidth={2.2} />
            </Pressable>
          )}
          <View style={styles.head}>
            <Pressable onPress={() => gallery.length > 1 && setPic((pic + 1) % gallery.length)} accessibilityRole="image" accessibilityLabel={`Фото: ${p.name}`}>
              <AvatarFrame frameId={d.frame} shape={d.shape} photo={gallery[pic] ?? d.photo ?? p.photo} initial={p.initial} size={132} animate />
            </Pressable>
            <View style={styles.nameRow}>
              <Text style={styles.name} numberOfLines={1}>{p.name}{p.age ? `, ${p.age}` : ''}</Text>
              {shownBadges.slice(0, 1).map(b => <BadgeMedal key={b} id={b} got size={28} />)}
            </View>
            <View style={styles.seenRow}>
              {d.online && <View style={styles.dot} />}
              <Text style={[styles.seen, d.online && { color: colors.ok }]}>{seen}</Text>
              {friend && d.device && <><Text style={styles.seen}> · </Text><DeviceMark os={d.device} /><Text style={styles.seen}>{d.device === 'ios' ? ' iPhone' : ' Android'}</Text></>}
              {!friend && <><Text style={styles.seen}> · </Text><Lock size={12} color={colors.muted} strokeWidth={2.2} /><Text style={styles.seen}> не в друзьях</Text></>}
            </View>
            {!!d.status && <View style={styles.status}><Text style={styles.statusText} numberOfLines={2}>{d.status}</Text></View>}
          </View>
        </View>

        <View style={styles.body}>
          {preview && (
            <View style={styles.previewBar}>
              <Text style={styles.previewText}>Так твой профиль видят друзья</Text>
              <Pressable onPress={() => router.push('/profile/edit')} style={styles.previewBtn} accessibilityRole="button"><Text style={styles.previewBtnText}>Изменить</Text></Pressable>
            </View>
          )}
          {/* Действия — квадратные кнопки, как в карточке контакта iPhone. */}
          {!preview && <View style={styles.actions}>
            <Action Icon={MessageCircle} label="Написать" dark onPress={write} />
            {friend
              ? <Action Icon={CalendarPlus} label="Позвать" onPress={() => { focusFriend(id, true); router.dismissTo('/'); }} />
              : <Action Icon={social.sent[id] ? Check : UserPlus} label={social.sent[id] ? 'Заявка ушла' : 'В друзья'} onPress={() => social.toggleRequest(id)} />}
            {friend && spot && <Action Icon={MapPin} label="На карте" onPress={showOnMap} />}
            {!!d.instagram && <Action Icon={Instagram} label="Instagram" onPress={() => { Linking.openURL(`https://instagram.com/${d.instagram!.replace(/^@/, '')}`).catch(() => undefined); }} />}
          </View>}

          {where && (
            <Pressable onPress={showOnMap} style={({ pressed }) => [styles.now, pressed && styles.pressed]} accessibilityRole="button">
              <View style={styles.nowIcon}><MapPin size={20} color="#FFFFFF" strokeWidth={2} /></View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.nowTitle}>Сейчас: {where.place}</Text>
                <Text style={styles.sub}>{spot ? `${(distanceM(MY_SPOT, spot) / 1000).toFixed(1).replace('.', ',')} км от тебя` : 'показать на карте'}</Text>
              </View>
              <ChevronRight size={18} color={colors.muted} strokeWidth={2} />
            </Pressable>
          )}

          {/* Витрина, как в Steam (26 окт.): награды на полке и счётчики одной строкой — без отдельной плитки «друзья». */}
          {(stats.length > 0 || badges.length > 0) && (
            <Showcase badges={(canSee(rel, 'achievements', d.privacy) ? [...shownBadges, ...badges.map((b) => b!.id).filter((x) => !shownBadges.includes(x))] : []).slice(0, 3)
              .map((bid) => ({ id: bid, name: BADGES.find((x) => x.id === bid)?.name ?? 'Награда', got: true, progress: 1, goal: 1 }))}
              total={badges.length} stats={stats.slice(0, 3).map((t) => ({ text: t.n, label: t.label }))} />
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

          {friend && canSee('friend', 'plans', d.privacy) && d.plans.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Планы {genitive}</Text>
              {d.plans.map((pl, i) => (
                <Pressable key={pl.title} onPress={() => pl.eventId && router.push({ pathname: '/event/[id]', params: { id: pl.eventId } })} style={[styles.planRow, i < d.plans.length - 1 && styles.line]} accessibilityRole="button">
                  <Text style={[styles.planWhen, pl.when === 'СЕГОДНЯ' && { color: colors.accentText }]}>{pl.when}</Text>
                  <View style={{ flex: 1 }}><Text style={styles.planTitle}>{pl.title}</Text><Text style={styles.sub}>{pl.note}</Text></View>
                  <ChevronRight size={18} color={colors.muted} strokeWidth={2} />
                </Pressable>
              ))}
            </View>
          )}

          {friend && common.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Общие друзья</Text>
              <View style={styles.faces}>
                {common.slice(0, 5).map((fp) => (
                  <Pressable key={fp!.id} onPress={() => router.push({ pathname: '/person/[id]', params: { id: fp!.id } })} style={styles.face} accessibilityRole="button" accessibilityLabel={fp!.name}>
                    <Avatar p={fp!} size={52} /><Text style={styles.faceName} numberOfLines={1}>{fp!.name}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {(d.about.trim() || d.interests.length > 0) && (
            <View style={styles.card}>
              {!!d.about.trim() && <><Text style={styles.cardTitle}>О себе</Text><Text style={styles.about}>{d.about}</Text></>}
              {d.interests.length > 0 && (
                <View style={styles.chips}>
                  {d.interests.map((x) => (
                    <View key={x.label} style={[styles.chip, x.common || friend ? { backgroundColor: colors.ink } : { borderWidth: 1, borderColor: colors.line2 }]}>
                      <Text style={[styles.chipText, (x.common || friend) && { color: colors.paper }]}>{x.label}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {!d.about.trim() && !d.interests.length && (
            <View style={[styles.card, { flexDirection: 'row', alignItems: 'center', gap: 12 }]}>
              <Image source={ART.wave} style={{ width: 64, height: 64 }} />
              <Text style={[styles.sub, { flex: 1, fontSize: 14 }]}>{preview ? 'Расскажи о себе и добавь интересы — так друзьям проще позвать тебя куда-то.' : `${p.name} пока ничего не рассказал${p.name.endsWith('а') ? 'а' : ''} о себе. Позови куда-нибудь — узнаешь лично.`}</Text>
            </View>
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
  body: { paddingHorizontal: 16, paddingTop: 14, gap: 12 },
  actions: { flexDirection: 'row', gap: 8 },
  action: { flex: 1, height: 66, borderRadius: 18, ...plate, alignItems: 'center', justifyContent: 'center', gap: 5 },
  actionDark: { backgroundColor: colors.ink, borderTopColor: 'rgba(255,255,255,0.18)', borderLeftColor: 'rgba(255,255,255,0.06)', borderRightColor: 'rgba(255,255,255,0.06)', borderBottomColor: 'rgba(0,0,0,0.4)' },
  actionText: { fontFamily: fonts.body600, fontSize: 12.5, color: colors.ink },
  pressed: { transform: [{ scale: 0.97 }], opacity: 0.9 },
  now: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 20, ...plate },
  nowIcon: { width: 40, height: 40, borderRadius: 13, backgroundColor: colors.friend, alignItems: 'center', justifyContent: 'center' },
  nowTitle: { fontFamily: fonts.body700, fontSize: 15, color: colors.ink },
  sub: { fontFamily: fonts.body400, fontSize: 13, color: colors.muted },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { width: '48.4%', flexGrow: 1, minHeight: 116, borderRadius: 22, ...plate, padding: 14, justifyContent: 'flex-end' },
  tileArt: { width: 46, height: 46, marginBottom: 'auto' },
  status: { marginTop: 6, maxWidth: 300, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, backgroundColor: '#FBFAF6', boxShadow: '0 4px 12px -6px rgba(23,22,26,0.3)' },
  statusText: { fontFamily: fonts.body600, fontSize: 14, color: colors.ink, textAlign: 'center' },
  previewBar: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, paddingLeft: 16, borderRadius: 18, backgroundColor: colors.ink },
  previewText: { flex: 1, fontFamily: fonts.body600, fontSize: 14, color: colors.paper },
  previewBtn: { minHeight: 36, paddingHorizontal: 14, borderRadius: 18, backgroundColor: colors.paper, justifyContent: 'center' },
  previewBtnText: { fontFamily: fonts.body700, fontSize: 13.5, color: colors.ink },
  tileN: { fontFamily: fonts.display800, fontSize: 24, letterSpacing: -0.6, color: colors.ink, marginTop: 10 },
  tileL: { fontFamily: fonts.body500, fontSize: 13, color: colors.muted2 },
  card: { borderRadius: 22, ...plate, padding: 16, gap: 10 },
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
  planWhen: { width: 72, fontFamily: fonts.mono600, fontSize: 10.5, color: colors.ink },
  planTitle: { fontFamily: fonts.body600, fontSize: 15, color: colors.ink },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  faces: { flexDirection: 'row', gap: 14 },
  face: { alignItems: 'center', gap: 6, width: 56 },
  faceName: { fontFamily: fonts.body600, fontSize: 12, color: colors.ink },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { height: 36, paddingHorizontal: 14, borderRadius: 18, justifyContent: 'center' },
  chipText: { fontFamily: fonts.body500, fontSize: 14, color: colors.ink },
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
