// Чат — этап 7 (DirectChat, EventChat). Пока — заглушка с последними сообщениями.
import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';
import { Screen, Stub } from '../../src/components/Screen';
import { data } from '../../src/data';
import { colors, fonts } from '../../src/theme';
import { BackButton } from '../../src/ui/kit';

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: messages = [] } = useQuery({ queryKey: ['messages', id], queryFn: () => data.getMessages(id) });
  return (
    <Screen>
      <View style={{ marginBottom: 16 }}><BackButton onPress={() => (router.canGoBack() ? router.back() : router.replace('/chats'))} /></View>
      <Stub stage={7} text="Здесь будет чат: фото, видео, голосовые, кружки, стикеры и приглашения." />
      {messages.map((m) => <Text key={m.id} style={{ fontFamily: fonts.body400, fontSize: 15, color: colors.ink, marginBottom: 6 }}>{m.text || '·'}</Text>)}
    </Screen>
  );
}
