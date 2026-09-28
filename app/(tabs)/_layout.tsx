import { Tabs } from 'expo-router';
import { TabBar } from '../../src/components/TabBar';
import { colors } from '../../src/theme';

export default function TabsLayout() {
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
