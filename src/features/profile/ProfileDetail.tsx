import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { Platform,Pressable, Share, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { data, type EventItem } from '../../data';
import { APP_URL, config } from '../../lib/config';
import { getEventsByIds, getMeStats, getMyAttendance, getProfile, saveProfile } from '../../live/api';
import { useSession } from '../../state/session';
import { useProfile } from '../../state/profile';
import { colors, fonts } from '../../theme';
import { SettingsPage, Group, Row } from '../../ui/v6/Settings';
import { StickerPicker } from '../../stickers/StickerPicker';
import { StickerView } from '../../stickers/StickerView';
import type {Sticker} from '../../stickers/catalog';
import {useState} from 'react';
import { FramePicker } from './FramePicker';
import { StepsCard } from './StepsCard';
import AwardsPage from './AwardsPage';
import MemoriesPage, { MemoryAlbum } from './MemoriesPage';
import SleepoversPage from './SleepoversPage';

export default function ProfileDetail() {
  const { page } = useLocalSearchParams<{ page: string }>();
  const qc = useQueryClient();
  const [frameBusy, setFrameBusy] = useState(false);
  const [frameError, setFrameError] = useState('');
  const [previewTrail, setPreviewTrail] = useState<'none'|'dots'|'comet'>('dots');
  const previewFrame = useProfile(s => s.mapFrame);
  const previewShape = useProfile(s => s.mapShape);
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
      {link ? <QRCode value={Platform.OS==='web'?link:`meets://person/${profile.data!.id}`} size={230} color={colors.ink} backgroundColor={colors.card} /> : <Text style={{ color: colors.muted }}>Войди в аккаунт, чтобы получить ссылку на профиль</Text>}
      <Text style={{ fontFamily: fonts.display700, fontSize: 24, color: colors.ink }}>{profile.data?.name ?? draft.name}</Text>
    </View>
    {link && <Pressable onPress={() => void Share.share({ message: `Добавь меня в Meets: ${link}` })} style={{ padding: 18, borderRadius: 18, backgroundColor: colors.ink }}><Text style={{ color: colors.paper, textAlign: 'center', fontFamily: fonts.body700 }}>Поделиться ссылкой</Text></Pressable>}
    <Pressable onPress={()=>router.push('/scan')} style={{padding:18}}><Text style={{fontFamily:fonts.body700,color:colors.ink,textAlign:'center'}}>Сканировать QR друга</Text></Pressable>
  </SettingsPage>;
  if (page === 'steps') return <SettingsPage title="Шаги" sub="Цель — 10 000 в день. Считаются сами."><StepsCard /></SettingsPage>;
  if (page === 'awards') return <AwardsPage />;
  if (page === 'memories' || page === 'chronicle') return <MemoriesPage />;
  if (page?.startsWith('memory-')) return <MemoryAlbum id={page.slice(7)} />;
  if (page === 'sleepovers') return <SleepoversPage />;
  const points = stats.data?.points ?? 0;
  const level = stats.data?.level ?? 1;
  const badges = stats.data?.badges ?? [];
  const nextAt = level <= 10 ? level * 1000 : 10000 + (level - 10) * 1500;
  return <SettingsPage title={`Уровень ${level}`} sub={`${points.toLocaleString('ru-RU')} из ${nextAt.toLocaleString('ru-RU')} очков до ${level + 1}-го. Уровень открывает рамки, след и стикеры.`}>
    <View style={{ height: 10, borderRadius: 5, backgroundColor: colors.sand, overflow: 'hidden' }}><View style={{ height: 10, width: `${Math.min(100, (points / nextAt) * 100)}%`, backgroundColor: colors.accent }} /></View>
    <View style={{ padding: 20, borderRadius: 24, backgroundColor: colors.card, gap: 16 }}>
      <FramePicker shape={(live ? profile.data?.map_shape : previewShape) ?? 'auto'} onShape={async id => {
          if (frameBusy) return;
          setFrameBusy(true); setFrameError('');
          try {
            if (live) { await saveProfile({ map_shape: id }); await Promise.all([qc.invalidateQueries({ queryKey: ['me', 'profile'] }), qc.invalidateQueries({ queryKey: ['people'] })]); }
            else useProfile.getState().setMapShape(id);
          } catch { setFrameError('Не удалось сохранить форму. Проверь связь'); }
          finally { setFrameBusy(false); }
        }}
        selected={(live ? profile.data?.map_frame : previewFrame) ?? 'classic'} level={level} image={profile.data?.photo_url ?? draft.photo} initial={(draft.name?.[0] ?? 'Я').toUpperCase()} busy={frameBusy} error={frameError}
        onSelect={async id => {
          if (frameBusy) return;
          setFrameBusy(true); setFrameError('');
          try {
            if (live) {
              await saveProfile({ map_frame: id });
              await Promise.all([qc.invalidateQueries({ queryKey: ['me', 'profile'] }), qc.invalidateQueries({ queryKey: ['people'] })]);
            } else useProfile.getState().setMapFrame(id);
          } catch (e) {
            const error = e as { code?: string; message?: string };
            setFrameError(error.code === '23514' && error.message?.includes('map_frame')
              ? 'Новая коллекция пока недоступна. Выбери классическую рамку.'
              : error.message?.includes('frame-locked') ? 'Эта рамка пока закрыта. Обнови страницу с уровнем.'
              : error.message?.includes('frame-unknown') ? 'Эта рамка появится после обновления сервера.'
              : 'Не удалось сохранить рамку. Попробуй ещё раз.');
          }
          finally { setFrameBusy(false); }
        }} />
      <Text style={{ fontFamily: fonts.body600, color: colors.ink }}>След движения</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{([{ id: 'none', name: 'Без следа', level: 1 }, { id: 'dots', name: 'Точки', level: 1 }, { id: 'comet', name: 'Комета', level: 3 }] as const).map(t => <Pressable key={t.id} accessibilityRole="radio" accessibilityState={{ selected: (live ? profile.data?.map_trail : previewTrail) === t.id, disabled: level < t.level || frameBusy }} disabled={level < t.level || frameBusy} onPress={async () => {
        setFrameBusy(true); setFrameError('');
        try { if (live) { await saveProfile({ map_trail: t.id }); await qc.invalidateQueries({ queryKey: ['me', 'profile'] }); } else setPreviewTrail(t.id); }
        catch { setFrameError('Не удалось сохранить след. Проверь связь'); } finally { setFrameBusy(false); }
      }} style={{ minHeight: 44, paddingHorizontal: 12, borderRadius: 16, justifyContent: 'center', backgroundColor: (live ? profile.data?.map_trail : previewTrail) === t.id ? colors.ink : colors.sand, opacity: level >= t.level ? 1 : .4 }}><Text style={{ fontFamily: fonts.body600, color: (live ? profile.data?.map_trail : previewTrail) === t.id ? colors.paper : colors.ink }}>{t.name}{level < t.level ? ` · ур. ${t.level}` : ''}</Text></Pressable>)}</View>
      {!!frameError && <Text accessibilityRole="alert" style={{ color: colors.accentText }}>{frameError}</Text>}
    </View>
    <Group><Row title="Новые места" sub="Открывай клетки города — 5 очков за каждую" /><Row title="Я на месте" sub="Отметься на событии — 30 очков" /><Row title="Друзья рядом" sub="Встречайтесь и знакомьтесь — очки начисляются за новые знакомства" /></Group>
    <Row title="Награды" sub="Медали за задания — в отдельном разделе" onPress={() => router.push('/profile/awards')} />
    {sticker&&<View style={{alignItems:'center',padding:12,backgroundColor:colors.card,borderRadius:24}}><StickerView st={sticker} size="lg"/><Text style={{fontFamily:fonts.body400,color:colors.muted}}>Отправь этот стикер другу в чате</Text></View>}
    <StickerPicker level={level} onSelect={setSticker}/>
    <Group><Row title="Стикеры «Рядом»" sub="Базовая коллекция открыта сразу" value="17" /><Row title="Стикеры «Город»" sub="Открываются на 3 уровне" value={level >= 3 ? 'Открыты' : 'Уровень 3'} /><Row title="Стикеры «После заката»" sub="Открываются на 7 уровне" value={level >= 7 ? 'Открыты' : 'Уровень 7'} /></Group>
  </SettingsPage>;
}
