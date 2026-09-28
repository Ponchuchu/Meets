// «Создать встречу» — этап 3 (CreateEvent).
import { router } from 'expo-router';
import { View } from 'react-native';
import { Screen, Stub } from '../src/components/Screen';
import { BackButton } from '../src/ui/kit';

export default function CreateScreen() {
  return (
    <Screen title="Новая встреча">
      <View style={{ position: 'absolute', right: 16, top: 0 }}><BackButton onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} /></View>
      <Stub stage={3} text="Встреча для друзей или открытая: адрес видят только принявшие, кто что принесёт." />
    </Screen>
  );
}
