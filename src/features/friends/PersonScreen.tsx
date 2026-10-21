import { useSocialActions } from '../../live/socialActions';
// Профиль человека: не в друзьях (Person) и друг (PersonFriend). Что видно — по правилам «Кто что видит».
import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StateView } from '../../ui/StateView';
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { data, eventsSnapshot } from '../../data';
import { MY_SPOT } from '../../data/demo';
import { photo } from '../../data/photos';
import { now as clockNow } from '../../lib/clock';
import { CAT_ICON } from '../../map/icons';
import { canSee, distanceM } from '../../people/visibility';
import { BADGES, badgeIcon } from '../../profile/badges';
import { getShownBadges } from '../../live/profileExtras';
import { BadgeMedal } from '../../ui/BadgeMedal';
import { planWhen } from '../../lib/planWhen';
import { useMapState } from '../../state/map';
import { useSession } from '../../state/session';
import { isFriendNow } from '../../state/social';
import { colors, fonts } from '../../theme';
import { Avatar } from '../../ui/Avatar';
import { Ic, IC } from '../../ui/Ic';
import { Backdrop, BottomSheet } from '../../ui/sheet';
import { Toast, type ToastData } from '../../ui/Toast';

const INSTA = 'M7 3.5h10A3.5 3.5 0 0120.5 7v10a3.5 3.5 0 01-3.5 3.5H7A3.5 3.5 0 013.5 17V7A3.5 3.5 0 017 3.5zM12 8a4 4 0 100 8 4 4 0 000-8z';
const REASONS = ['Спам или реклама', 'Оскорбления', 'Фейковый профиль', 'Неприемлемые фото', 'Младше 18', 'Другое'];

export default function PersonScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const now = clockNow();
  const [pic, setPic] = useState(0);
  const [sheet, setSheet] = useState<null | 'report' | 'remove'>(null);
  const [toast, setToast] = useState<ToastData | null>(null);
  const peopleQ = useQuery({ queryKey: ['people'], queryFn: () => data.getPeople() });
  const people = peopleQ.data ?? [];
  const detailsQ = useQuery({ queryKey: ['person', id], queryFn: () => data.getPersonDetails(id) });
  const d = detailsQ.data;
  // Награды, которые человек поставил у имени (FIX3 Ф8).
  const { data: shownBadges = [] } = useQuery({ queryKey: ['person', id, 'badges'], queryFn: () => getShownBadges(id) });
  const { data: events = [] } = useQuery({ queryKey: ['events'], queryFn: () => data.getEvents(), placeholderData: eventsSnapshot });
  const { data: spots = [] } = useQuery({ queryKey: ['friendSpots'], queryFn: () => data.getFriendSpots() });
  const social = useSocialActions(text => setToast({ text }));
  const focusFriend = useMapState((s) => s.focusFriend);
  const myPhoto = useSession((s) => s.draft.photo);
  const p = people.find((x) => x.id === id);
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

  const friend = isFriendNow(p, social);
  const rel = friend ? 'friend' : 'stranger';
  const gallery = d.gallery.length ? d.gallery : p.photo ? [p.photo] : [];
  const spot = spots.find((s) => s.personId === id);
  const look = d.lookingFor && canSee(rel, 'lookingForCompany', d.privacy) ? { ...d.lookingFor, e: events.find((e) => e.id === d.lookingFor!.eventId) } : null;
  const badges = d.badges.map((b) => BADGES.find((x) => x.id === b)).filter(Boolean);
  const common = d.commonFriends.map((cid) => people.find((x) => x.id === cid)).filter(Boolean);
  const showOnMap = () => { focusFriend(id); router.dismissTo('/'); };
  const write = () => router.push({ pathname: '/chat/[id]', params: { id: `dm-${id}` } });
  const genitive = p.name.endsWith('ь') ? `${p.name.slice(0, -1)}я` : p.name.endsWith('а') ? `${p.name.slice(0, -1)}ы` : `${p.name}а`;

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 + insets.bottom }}>
        <View style={styles.hero}>
          {gallery.length ? (
            <Image source={photo(gallery[pic])} style={styles.heroImg} resizeMode="cover" accessibilityLabel={`Фото: ${p.name}`} />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: p.tint, alignItems: 'center', justifyContent: 'center' }]}><Text style={styles.heroLetter}>{p.initial}</Text></View>
          )}
          <Pressable onPress={back} style={[styles.back, { top: Math.max(50, insets.top + 6) }]} accessibilityRole="button" accessibilityLabel="Назад">
            <Ic d={IC.back} size={20} color={colors.ink} w={2} />
          </Pressable>
          {friend && gallery.length > 1 && (
            <View style={styles.thumbs}>
              {gallery.map((g, i) => (
                <Pressable key={g} onPress={() => setPic(i)} accessibilityRole="button" accessibilityLabel={`Фото ${i + 1}`}>
                  <Image source={photo(g)} style={[styles.thumb, i === pic && { borderColor: '#FFFFFF' }]} />
                </Pressable>
              ))}
            </View>
          )}
        </View>

        <View style={styles.body}>
          <View style={styles.nameRow}>
            <Text style={styles.name}>{p.name}{p.age ? `, ${p.age}` : ''}</Text>
            {shownBadges.map(b => <BadgeMedal key={b} id={b} icon={badgeIcon(b)} got size={22} />)}
            {d.online ? (<><View style={styles.dot} /><Text style={styles.seen}>онлайн</Text></>) : <Text style={styles.seen}>{d.lastSeen}</Text>}
          </View>
          {!friend && (
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              <View style={styles.tag}><Ic d={IC.lock} size={13} color={colors.ink} w={2} /><Text style={styles.tagText}>Не в друзьях</Text></View>
              {common.length > 0 && (
                <View style={styles.tag}>
                  <View style={{ flexDirection: 'row' }}>{common.slice(0, 2).map((c) => <Avatar key={c!.id} p={c!} size={18} style={{ marginRight: -6 }} />)}</View>
                  <Text style={[styles.tagText, { marginLeft: 6 }]}>{common.length} {common.length === 1 ? 'общий друг' : 'общих друга'}</Text>
                </View>
              )}
            </View>
          )}

          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable onPress={write} style={[styles.btn, { backgroundColor: colors.ink }]} accessibilityRole="button">
              <Ic d="M4 5h16v11H9l-5 4z" size={18} color={colors.paper} />
              <Text style={[styles.btnText, { color: colors.paper }]}>Написать</Text>
            </Pressable>
            {friend ? (
              <Pressable onPress={() => { focusFriend(id, true); router.dismissTo('/'); }} style={[styles.btn, styles.outline]} accessibilityRole="button">
                <Ic d={IC.plus} size={18} color={colors.ink} w={2} /><Text style={styles.btnText}>Позвать</Text>
              </Pressable>
            ) : (
              <Pressable onPress={() => social.toggleRequest(id)} style={[styles.btn, styles.outline, social.sent[id] && { backgroundColor: colors.sand, borderColor: colors.sand }]} accessibilityRole="button">
                <Ic d={social.sent[id] ? IC.check : IC.userPlus} c={social.sent[id] ? [] : [[9, 8, 3.5]]} size={18} color={colors.ink} />
                <Text style={styles.btnText}>{social.sent[id] ? 'Заявка ушла' : 'В друзья'}</Text>
              </Pressable>
            )}
            <Pressable onPress={() => d.instagram && Linking.openURL(`https://instagram.com/${d.instagram.slice(1)}`).catch(() => {})} style={styles.insta} accessibilityRole="link" accessibilityLabel="Instagram">
              <Ic d={INSTA} size={20} color={colors.ink} />
            </Pressable>
          </View>

          {friend && d.now && canSee('friend', 'location', d.privacy) && (
            <View style={styles.now}>
              <View style={styles.nowIcon}><Ic d={IC.pin} c={[[12, 9, 2.5]]} size={18} color="#FFFFFF" w={2} /></View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.nowTitle}>Сейчас: {d.now.place}</Text>
                <Text style={styles.sub}>{spot ? `${(distanceM(MY_SPOT, spot) / 1000).toFixed(1).replace('.', ',')} км от тебя · ` : ''}делится до {d.now.sharingUntil}</Text>
              </View>
              <Pressable onPress={showOnMap} style={styles.darkPill} accessibilityRole="button"><Text style={styles.darkPillText}>На карте</Text></Pressable>
            </View>
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
            <>
              <Text style={styles.h2}>Планы {genitive}</Text>
              <View style={styles.list}>
                {d.plans.map((pl, i) => (
                  <Pressable key={pl.title} onPress={() => pl.eventId && router.push({ pathname: '/event/[id]', params: { id: pl.eventId } })} style={[styles.planRow, i < d.plans.length - 1 && styles.line]} accessibilityRole="button">
                    <Text style={[styles.planWhen, pl.when === 'СЕГОДНЯ' && { color: colors.accentText }]}>{pl.when}</Text>
                    <View style={{ flex: 1 }}><Text style={styles.planTitle}>{pl.title}</Text><Text style={styles.sub}>{pl.note}</Text></View>
                    <Ic d={IC.chevron} size={18} color={colors.muted} w={2} />
                  </Pressable>
                ))}
              </View>
            </>
          )}

          {friend && (
            <>
              <View style={styles.rowBetween}><Text style={styles.h2}>Друзья {genitive} · {d.friendsCount}</Text><Text style={styles.sub}>{d.commonCount} общих</Text></View>
              <View style={styles.faces}>
                {d.friendIds.slice(0, 4).map((fid) => {
                  const fp = fid === 'me' ? { id: 'me', name: 'Ты', photo: myPhoto ?? 'danil', initial: 'Д', tint: colors.sand } : people.find((x) => x.id === fid);
                  if (!fp) return null;
                  return <View key={fid} style={styles.face}><Avatar p={fp} size={56} ring={colors.friend} /><Text style={styles.faceName}>{fp.name}</Text></View>;
                })}
                <View style={styles.face}><View style={styles.more}><Text style={styles.moreText}>+{Math.max(0, d.friendsCount - 4)}</Text></View><Text style={styles.faceName}>Все</Text></View>
              </View>
            </>
          )}

          <Text style={styles.h2}>Интересы</Text>
          <View style={styles.chips}>
            {d.interests.map((x) => (
              <View key={x.label} style={[styles.chip, x.common || friend ? { backgroundColor: colors.ink } : { borderWidth: 1, borderColor: colors.line2 }]}>
                <Text style={[styles.chipText, (x.common || friend) && { color: colors.paper }]}>{x.label}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.h2}>О себе</Text>
          <Text style={styles.about}>{d.about}</Text>

          {badges.length > 0 && canSee(rel, 'achievements', d.privacy) && (
            <>
              <View style={styles.rowBetween}><Text style={styles.h2}>Достижения</Text>{d.badgeLine && <Text style={styles.badgeLine}>{d.badgeLine}</Text>}</View>
              <View style={{ flexDirection: 'row' }}>
                {badges.slice(0, 4).map((b) => (
                  <View key={b!.id} style={styles.badge}><BadgeMedal id={b!.id} icon={b!.icon} got size={52} /><Text style={styles.badgeName}>{b!.name}</Text></View>
                ))}
              </View>
            </>
          )}

          <View style={styles.footer}>
            {friend ? (
              <Pressable onPress={() => setSheet('remove')} accessibilityRole="button"><Text style={styles.footText}>Убрать из друзей</Text></Pressable>
            ) : (
              <Pressable onPress={() => { social.hide(id); show({ text: `${p.name} больше не будет в подборках людей` }); }} accessibilityRole="button"><Text style={styles.footText}>{social.hidden[id] ? 'Профиль скрыт' : 'Скрыть профиль'}</Text></Pressable>
            )}
            <Pressable onPress={() => setSheet('report')} accessibilityRole="button"><Text style={styles.footText}>{social.reported[id] ? 'Жалоба отправлена' : 'Пожаловаться'}</Text></Pressable>
          </View>
        </View>
      </ScrollView>

      {toast && <Toast t={toast} style={{ position: 'absolute', left: 16, right: 16, bottom: 20 + insets.bottom }} />}
      {sheet && (
        <>
          <Backdrop onPress={() => setSheet(null)} label="Закрыть" />
          <BottomSheet onClose={() => setSheet(null)} label={sheet === 'report' ? 'Пожаловаться' : 'Убрать из друзей'} style={{ paddingBottom: 30 + insets.bottom }}>
            {sheet === 'report' ? (
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
  hero: { height: 500, borderBottomLeftRadius: 32, borderBottomRightRadius: 32, overflow: 'hidden', backgroundColor: colors.sand },
  heroImg: { position: 'absolute', left: 0, top: 0, width: '100%', height: '100%' },
  heroLetter: { fontFamily: fonts.display800, fontSize: 160, color: colors.ink },
  back: { position: 'absolute', left: 16, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(251,250,246,0.9)', alignItems: 'center', justifyContent: 'center' },
  thumbs: { position: 'absolute', right: 16, bottom: 16, flexDirection: 'row', gap: 8 },
  thumb: { width: 42, height: 52, borderRadius: 8, borderWidth: 2, borderColor: 'transparent' },
  body: { paddingHorizontal: 16, paddingTop: 18, gap: 14 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontFamily: fonts.display700, fontSize: 30, letterSpacing: -0.6, color: colors.ink },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.ok, marginLeft: 2 },
  seen: { fontFamily: fonts.body400, fontSize: 13, color: colors.muted2 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 30, paddingHorizontal: 10, borderRadius: 10, backgroundColor: colors.sand },
  tagText: { fontFamily: fonts.body500, fontSize: 13, color: colors.ink },
  btn: { flex: 1, height: 52, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  outline: { borderWidth: 1.5, borderColor: colors.ink },
  btnText: { fontFamily: fonts.body600, fontSize: 15, color: colors.ink },
  insta: { width: 52, height: 52, borderRadius: 16, borderWidth: 1, borderColor: colors.line2, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  now: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 18, borderWidth: 1.5, borderColor: colors.friend, backgroundColor: colors.card },
  nowIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.friend, alignItems: 'center', justifyContent: 'center' },
  nowTitle: { fontFamily: fonts.body700, fontSize: 15, color: colors.ink },
  sub: { fontFamily: fonts.body400, fontSize: 13, color: colors.muted },
  darkPill: { height: 36, paddingHorizontal: 12, borderRadius: 18, backgroundColor: colors.ink, justifyContent: 'center' },
  darkPillText: { fontFamily: fonts.body600, fontSize: 13, color: colors.paper },
  look: { padding: 16, borderRadius: 22, backgroundColor: colors.accent, gap: 14 },
  lookHead: { flexDirection: 'row', justifyContent: 'space-between' },
  lookCap: { fontFamily: fonts.mono600, fontSize: 10.5, letterSpacing: 0.6, color: colors.ink },
  lookIcon: { width: 52, height: 52, borderRadius: 16, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  lookTitle: { fontFamily: fonts.display700, fontSize: 20, lineHeight: 22, color: colors.ink },
  lookMeta: { fontFamily: fonts.body400, fontSize: 13, color: colors.ink, marginTop: 2 },
  lookBtn: { height: 48, borderRadius: 14, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  lookBtnText: { fontFamily: fonts.body600, fontSize: 14, color: colors.paper },
  h2: { fontFamily: fonts.display700, fontSize: 20, color: colors.ink, marginTop: 4 },
  list: { borderRadius: 18, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card },
  planRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14 },
  line: { borderBottomWidth: 1, borderBottomColor: colors.sand },
  planWhen: { width: 72, fontFamily: fonts.mono600, fontSize: 10.5, color: colors.ink },
  planTitle: { fontFamily: fonts.body600, fontSize: 15, color: colors.ink },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  faces: { flexDirection: 'row', justifyContent: 'space-between' },
  face: { alignItems: 'center', gap: 6 },
  faceName: { fontFamily: fonts.body600, fontSize: 12, color: colors.ink },
  more: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.sand, alignItems: 'center', justifyContent: 'center' },
  moreText: { fontFamily: fonts.body600, fontSize: 13, color: colors.ink },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { height: 38, paddingHorizontal: 14, borderRadius: 19, justifyContent: 'center' },
  chipText: { fontFamily: fonts.body500, fontSize: 14, color: colors.ink },
  about: { fontFamily: fonts.body400, fontSize: 15, lineHeight: 22.5, color: colors.muted2 },
  badgeLine: { fontFamily: fonts.mono600, fontSize: 10.5, letterSpacing: 0.5, color: colors.ink },
  badge: { flex: 1, alignItems: 'center', gap: 6 },
  badgeName: { textAlign: 'center', fontFamily: fonts.body600, fontSize: 12, color: colors.ink },
  footer: { flexDirection: 'row', justifyContent: 'center', gap: 28, paddingVertical: 12 },
  footText: { fontFamily: fonts.body400, fontSize: 14, color: colors.muted },
});
