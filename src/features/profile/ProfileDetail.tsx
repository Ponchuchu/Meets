import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { Platform,Pressable, Share, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { APP_URL, config } from '../../lib/config';
import { getMeStats, getProfile, saveProfile } from '../../live/api';
import { useSession } from '../../state/session';
import { useProfile } from '../../state/profile';
import { colors, fonts } from '../../theme';
import { SettingsPage, Group, Row } from '../../ui/v6/Settings';
import {useState} from 'react';
import { FramePicker } from './FramePicker';
import { StepsCard } from './StepsCard';
import AwardsPage from './AwardsPage';
import MemoriesPage, { MemoryAlbum } from './MemoriesPage';
import SleepoversPage from './SleepoversPage';
import EditProfile from './EditProfile';

export default function ProfileDetail() {
  const { page } = useLocalSearchParams<{ page: string }>();
  const qc = useQueryClient();
  const [frameBusy, setFrameBusy] = useState(false);
  const [frameError, setFrameError] = useState('');
  const [previewTrail, setPreviewTrail] = useState<'none'|'dots'|'comet'>('dots');
  const previewFrame = useProfile(s => s.mapFrame);
  const previewShape = useProfile(s => s.mapShape);
  const live = config.dataMode !== 'demo';
  const draft = useSession((s) => s.draft);
  const profile = useQuery({ queryKey: ['me', 'profile'], queryFn: () => getProfile(), enabled: live });
  const stats = useQuery({ queryKey: ['me', 'stats'], queryFn: getMeStats, enabled: live });
  const link = profile.data?.handle ? `${APP_URL}/u/${profile.data.handle}` : profile.data?.id ? `${APP_URL}/person/${profile.data.id}` : null;
  if (page === 'edit') return <EditProfile />;
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
  const nextAt = level <= 10 ? level * 1000 : 10000 + (level - 10) * 1500;
  // Уровень проще (21 окт.): крупный номер и полоска, что откроется дальше, как получать очки — и оформление.
  const next = level < 3 ? 'Рамки «Город», след «Комета» и стикеры «Город»' : level < 7 ? 'Стикеры «После заката» и новые рамки' : 'Редкие рамки — каждые несколько уровней';
  const nextLevel = level < 3 ? 3 : level < 7 ? 7 : level + 1;
  return <SettingsPage title="Уровень">
    <View style={{ padding: 20, borderRadius: 24, backgroundColor: colors.ink, gap: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontFamily: fonts.display800, fontSize: 34, color: colors.ink }}>{level}</Text></View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ fontFamily: fonts.display700, fontSize: 20, color: colors.paper }}>Уровень {level}</Text>
          <Text style={{ fontFamily: fonts.body500, fontSize: 14, color: '#BDB8AD' }}>Ещё {Math.max(0, nextAt - points).toLocaleString('ru-RU')} очков до {level + 1}-го</Text>
        </View>
      </View>
      <View style={{ height: 10, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.14)', overflow: 'hidden' }}><View style={{ height: 10, width: `${Math.min(100, (points / nextAt) * 100)}%`, backgroundColor: colors.accent }} /></View>
      <Text style={{ fontFamily: fonts.body500, fontSize: 13.5, lineHeight: 19, color: '#E8E4DA' }}>На {nextLevel} уровне: {next}</Text>
    </View>
    <View style={{ flexDirection: 'row', gap: 8 }}>
      {[['+5', 'новое место в городе'], ['+30', 'отметился на событии'], ['+20', 'новый друг']].map(([n, t]) => (
        <View key={t} style={{ flex: 1, padding: 12, borderRadius: 18, backgroundColor: colors.card, gap: 2 }}>
          <Text style={{ fontFamily: fonts.display800, fontSize: 20, color: colors.accentText }}>{n}</Text>
          <Text style={{ fontFamily: fonts.body500, fontSize: 12.5, lineHeight: 16, color: colors.muted2 }}>{t}</Text>
        </View>
      ))}
    </View>
    <Text style={{ fontFamily: fonts.mono600, fontSize: 10.5, letterSpacing: 0.8, color: colors.muted, marginTop: 4 }}>ОФОРМЛЕНИЕ НА КАРТЕ</Text>
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
    <Group>
      <Row title="Значки" sub="Собирай за походы и ставь один рядом с именем" onPress={() => router.push('/profile/awards')} />
      <Row title="Стикеры" sub={level >= 7 ? 'Открыты все наборы' : level >= 3 ? 'Открыты «Рядом» и «Город»' : 'Открыт набор «Рядом»'} value={`${level >= 7 ? 3 : level >= 3 ? 2 : 1} из 3`} last />
    </Group>
  </SettingsPage>;
}
