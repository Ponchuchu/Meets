// Вкладки v6: Карта, Рекомендации, Планы, Чаты, Профиль (docs/ALPHA.md А1). Без входа — на «привет».
import { useQuery } from '@tanstack/react-query';
import { Redirect, router, Tabs } from 'expo-router';
import { useEffect } from 'react';
import { TabBar } from '../../src/components/TabBar';
import { config } from '../../src/lib/config';
import { getProfile, getSettings } from '../../src/live/api';
import { useAuth } from '../../src/live/auth';
import { useLiveLocation } from '../../src/live/useLiveLocation';
import { usePlansSync } from '../../src/live/usePlansSync';
import { useInvites } from '../../src/live/useInvites';
import { useNotificationTaps } from '../../src/live/reminders';
import { useSession } from '../../src/state/session';
import { useTabBadges } from '../../src/state/tabBadges';
import { colors } from '../../src/theme';
import { Splash } from '../../src/ui/v6/Splash';
import { Tutorial } from '../../src/ui/v6/Tutorial';

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
  useLiveLocation();
  usePlansSync();
  useInvites();
  useNotificationTaps((url) => router.push(url as never));
  const prof = useQuery({ queryKey: ['me', 'profile'], queryFn: () => getProfile(), enabled: !demo });
  const draft = useSession((s) => s.draft);
  useEffect(() => {
    const name = prof.data?.name ?? draft.name;
    const url = prof.data?.photo_url ?? (draft.photo?.startsWith('http') ? draft.photo : null);
    useTabBadges.getState().set({ avatar: { url, letter: (name?.trim()[0] ?? '').toUpperCase() } });
  }, [prof.data, draft.name, draft.photo]);
  return (
    <>
      <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.paper } }}>
        <Tabs.Screen name="index" options={{ title: 'Карта' }} />
        <Tabs.Screen name="foryou" options={{ title: 'Рекомендации' }} />
        <Tabs.Screen name="plans" options={{ title: 'Планы' }} />
        <Tabs.Screen name="chats" options={{ title: 'Чаты' }} />
        <Tabs.Screen name="me" options={{ title: 'Профиль' }} />
      </Tabs>
      <Tutorial />
      <Splash />
    </>
  );
}
