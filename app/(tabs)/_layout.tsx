// Вкладки v6: Карта, Рекомендации, Планы, Чаты, Профиль (docs/ALPHA.md А1). Без входа — на «привет».
import { useQuery } from '@tanstack/react-query';
import { Redirect, router, Tabs } from 'expo-router';
import { useEffect } from 'react';
import { InteractionManager } from 'react-native';
import { trimCache } from '../../src/live/memory';
import { TabBar } from '../../src/components/TabBar';
import { config } from '../../src/lib/config';
import { getProfile, getSettings } from '../../src/live/api';
import { useAuth } from '../../src/live/auth';
import { useLiveChats } from '../../src/data/realtime';
import { useStepTracking } from '../../src/live/steps';
import { usePushRegistration } from '../../src/live/push';
import { useLiveLocation } from '../../src/live/useLiveLocation';
import { usePlansSync } from '../../src/live/usePlansSync';
import { useInvites } from '../../src/live/useInvites';
import { useNotificationTaps } from '../../src/live/reminders';
import { useSession } from '../../src/state/session';
import { useTabBadges } from '../../src/state/tabBadges';
import { colors } from '../../src/theme';
import { Tutorial } from '../../src/features/auth/Tutorial';

export default function TabsLayout() {
  const hydrated = useSession((s) => s.hydrated);
  const onboarded = useSession((s) => s.onboarded);
  const ready = useAuth((s) => s.ready);
  const session = useAuth((s) => s.session);
  const demo = config.dataMode === 'demo';
  if (!hydrated || (!demo && !ready)) return null;
  if (demo) return onboarded ? <Shell /> : <Redirect href="/hello" />;
  if (!session) return <Redirect href="/hello" />;
  if (!onboarded) return <ServerOnboarded />;
  return <Shell />;
}

/** Переустановка или новый телефон: вход уже был — флаг лежит на сервере, анкету второй раз не показываем. */
function ServerOnboarded() {
  const q = useQuery({ queryKey: ['me', 'settings'], queryFn: getSettings, retry: 1 });
  useEffect(() => {
    if (q.data?.onboarded) useSession.getState().finish();
  }, [q.data]);
  if (q.isPending) return null;
  if (q.data?.onboarded) return null;
  return <Redirect href="/name" />;
}

function Shell() {
  const demo = config.dataMode === 'demo';
  useLiveChats();
  useStepTracking();
  usePushRegistration();
  useLiveLocation();
  usePlansSync();
  useInvites();
  useNotificationTaps((url) => router.push(url as never));
  // Кэш кружков и видео не разрастается: раз за запуск, когда всё уже открылось.
  useEffect(() => { const t = InteractionManager.runAfterInteractions(() => { void trimCache().catch(() => undefined); }); return () => t.cancel(); }, []);
  const prof = useQuery({ queryKey: ['me', 'profile'], queryFn: () => getProfile(), enabled: !demo });
  const draft = useSession((s) => s.draft);
  useEffect(() => {
    const name = prof.data?.name ?? draft.name;
    const url = prof.data?.photo_url ?? (draft.photo?.startsWith('http') ? draft.photo : null);
    useTabBadges.getState().set({ avatar: { url, letter: (name?.trim()[0] ?? '').toUpperCase() } });
  }, [prof.data, draft.name, draft.photo]);
  return (
    <>
      <Tabs detachInactiveScreens tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.paper }, freezeOnBlur: false, animation: 'none' }}>
        <Tabs.Screen name="index" options={{ title: 'Карта' }} />
        {/* Скрытые вкладки (кроме карты) замирают: не перерисовываются от сообщений и точек друзей, пока открыта другая.
            Карту не замораживаем — она сама отключает отрисовку вне фокуса (MapScreen: focused). */}
        <Tabs.Screen name="foryou" options={{ title: 'Рекомендации', freezeOnBlur: true }} />
        <Tabs.Screen name="plans" options={{ title: 'Планы', freezeOnBlur: true }} />
        <Tabs.Screen name="chats" options={{ title: 'Чаты', freezeOnBlur: true }} />
        <Tabs.Screen name="me" options={{ title: 'Профиль', freezeOnBlur: true }} />
      </Tabs>
      <Tutorial />
    </>
  );
}
