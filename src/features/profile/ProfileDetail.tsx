import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { Platform,Pressable, Share, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { data, type EventItem } from '../../data';
import { APP_URL, config } from '../../lib/config';
import { getEventsByIds, getMeStats, getMyAttendance, getProfile } from '../../live/api';
import { useSession } from '../../state/session';
import { useProfile } from '../../state/profile';
import { colors, fonts } from '../../theme';
import { SettingsPage, Group, Row, Note } from '../../ui/v6/Settings';
import { StickerPicker } from '../../stickers/StickerPicker';
import { StickerView } from '../../stickers/StickerView';
import type {Sticker} from '../../stickers/catalog';
import {useState} from 'react';
import { BADGES } from '../../profile/badges';

export default function ProfileDetail() {
  const { page } = useLocalSearchParams<{ page: string }>();
  const [badge,setBadge]=useState<string|null>(null);
  const [sticker,setSticker]=useState<Sticker|null>(null);
  const live = config.dataMode !== 'demo';
  const draft = useSession((s) => s.draft);
  const profile = useQuery({ queryKey: ['me', 'profile'], queryFn: () => getProfile(), enabled: live });
  const stats = useQuery({ queryKey: ['me', 'stats'], queryFn: getMeStats, enabled: live });
  const local = useProfile((s) => s.arrivals);
  const attendance = useQuery({ queryKey: ['me', 'attendance'], queryFn: getMyAttendance, enabled: live && page === 'chronicle' });
  const ids = live ? (attendance.data ?? []).filter((a) => a.status === 'arrived').map((a) => a.event_id) : local.map((a) => a.eventId);
  const events = useQuery<EventItem[]>({ queryKey: ['chronicle', ids.join(',')], queryFn: () => live ? getEventsByIds(ids) : data.getEvents().then((all) => all.filter((e) => ids.includes(e.id))), enabled: page === 'chronicle' });
  const link = profile.data?.handle ? `${APP_URL}/u/${profile.data.handle}` : profile.data?.id ? `${APP_URL}/person/${profile.data.id}` : null;
  if (page === 'qr') return <SettingsPage title="Твой QR-код" sub="Друг отсканирует код камерой и откроет твой профиль.">
    <View style={{ alignItems: 'center', padding: 28, borderRadius: 28, backgroundColor: colors.card, gap: 20 }}>
      {link ? <QRCode value={Platform.OS==='web'?link:`ryadom://person/${profile.data!.id}`} size={230} color={colors.ink} backgroundColor={colors.card} /> : <Text style={{ color: colors.muted }}>Войди в аккаунт, чтобы получить ссылку на профиль</Text>}
      <Text style={{ fontFamily: fonts.display700, fontSize: 24, color: colors.ink }}>{profile.data?.name ?? draft.name}</Text>
    </View>
    {link && <Pressable onPress={() => void Share.share({ message: `Добавь меня в «рядом.»: ${link}` })} style={{ padding: 18, borderRadius: 18, backgroundColor: colors.ink }}><Text style={{ color: colors.paper, textAlign: 'center', fontFamily: fonts.body700 }}>Поделиться ссылкой</Text></Pressable>}
    <Pressable onPress={()=>router.push('/scan')} style={{padding:18}}><Text style={{fontFamily:fonts.body700,color:colors.ink,textAlign:'center'}}>Сканировать QR друга</Text></Pressable>
  </SettingsPage>;
  if (page === 'chronicle') return <SettingsPage title="Хроника" sub="События, на которых ты отметился."><Group>
    {[...(events.data ?? [])].sort((a,b) => Date.parse(b.startsAt)-Date.parse(a.startsAt)).map((e) => <Row key={e.id} title={e.title} sub={`${new Date(e.startsAt).toLocaleDateString('ru-RU')} · ${e.venueName ?? e.address}`} onPress={() => router.push({ pathname: '/event/[id]', params: { id: e.id } })} />)}
    {!events.data?.length && <Row title={events.isPending ? 'Загружаю…' : 'Пока пусто'} sub="Нажми «Я на месте» в карточке события — оно появится здесь" />}
  </Group>{events.isError && <Note>Не удалось загрузить хронику. Проверь связь.</Note>}</SettingsPage>;
  const points = stats.data?.points ?? 0;
  const level = stats.data?.level ?? 1;
  const badges = stats.data?.badges ?? [];
  return <SettingsPage title="Уровень и награды" sub={`Уровень ${level} · ${points} очков`}>
    <Group><Row title="Новые места" sub="Открывай клетки города — 5 очков за каждую" /><Row title="Я на месте" sub="Отметься на событии — 30 очков" /><Row title="Друзья рядом" sub="Встречайтесь и знакомьтесь — очки начисляются за новые знакомства" /></Group>
    <Note>Значки открываются за выполненные задания. Нажми на значок в списке, чтобы увидеть условие.</Note>
    <Group>{(badges.length ? badges : BADGES.map((b) => ({ ...b, progress: 0, got: false }))).map((b) => <Row onPress={()=>setBadge(b.id)} key={b.id} title={b.name} sub={('how' in b ? b.how : undefined) ?? BADGES.find((x) => x.id === b.id)?.how ?? `${b.progress} из ${b.goal}`} value={b.got ? 'Открыт' : `${Math.min(b.progress,b.goal)} / ${b.goal}`} />)}</Group>
    {badge&&<Note>{`${badges.find(b=>b.id===badge)?.name??''} · ${badges.find(b=>b.id===badge)?.how??BADGES.find(b=>b.id===badge)?.how??''}`}</Note>}
    {sticker&&<View style={{alignItems:'center',padding:12,backgroundColor:colors.card,borderRadius:24}}><StickerView st={sticker} size="lg"/><Text style={{fontFamily:fonts.body400,color:colors.muted}}>Отправь этот стикер другу в чате</Text></View>}
    <StickerPicker level={level} onSelect={setSticker}/>
    <Group><Row title="Стикеры «Рядом»" sub="Базовая коллекция открыта сразу" value="17" /><Row title="Стикеры «Город»" sub="Открываются на 3 уровне" value={level >= 3 ? 'Открыты' : 'Уровень 3'} /><Row title="Стикеры «После заката»" sub="Открываются на 7 уровне" value={level >= 7 ? 'Открыты' : 'Уровень 7'} /></Group>
  </SettingsPage>;
}
