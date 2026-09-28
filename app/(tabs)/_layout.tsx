import { Redirect, Tabs } from 'expo-router';
import { TabBar } from '../../src/components/TabBar';
import { useSession } from '../../src/state/session';
import { colors } from '../../src/theme';

export default function TabsLayout() {
  const hydrated = useSession((s) => s.hydrated);
  const onboarded = useSession((s) => s.onboarded);
  if (!hydrated) return null;
  if (!onboarded) return <Redirect href="/start" />;
  return (
    <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.paper } }}>
      <Tabs.Screen name="index" options={{ title: 'Карта' }} />
      <Tabs.Screen name="foryou" options={{ title: 'Для тебя' }} />
      <Tabs.Screen name="chats" options={{ title: 'Чаты' }} />
      <Tabs.Screen name="people" options={{ title: 'Люди' }} />
      <Tabs.Screen name="me" options={{ title: 'Профиль' }} />
    </Tabs>
  );
}
