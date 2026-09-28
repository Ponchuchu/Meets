// Страница события — полностью делается на этапе 3 (EventPage). Пока — заголовок и описание.
import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Screen, Stub } from '../../src/components/Screen';
import { data } from '../../src/data';
import { colors, fonts } from '../../src/theme';
import { BackButton } from '../../src/ui/kit';

export default function EventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: events } = useQuery({ queryKey: ['events'], queryFn: () => data.getEvents() });
  const e = events?.find((x) => x.id === id);
  return (
    <Screen>
      <View style={{ marginBottom: 16 }}><BackButton onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} /></View>
      <Text style={styles.title}>{e?.title ?? 'Событие'}</Text>
      <Text style={styles.about}>{e?.about}</Text>
      <Stub stage={3} text="Полная страница события: погода, маршрут, «Я иду», «Ищу компанию», «Позвать»." />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: fonts.display700, fontSize: 30, color: colors.ink, marginBottom: 8 },
  about: { fontFamily: fonts.body400, fontSize: 15, lineHeight: 22, color: colors.muted2, marginBottom: 16 },
});
