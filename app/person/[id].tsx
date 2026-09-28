// Профиль человека — этап 6 (Person, PersonFriend).
import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';
import { Screen, Stub } from '../../src/components/Screen';
import { data } from '../../src/data';
import { colors, fonts } from '../../src/theme';
import { Avatar } from '../../src/ui/Avatar';
import { BackButton } from '../../src/ui/kit';

export default function PersonScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: people = [] } = useQuery({ queryKey: ['people'], queryFn: () => data.getPeople() });
  const p = people.find((x) => x.id === id);
  return (
    <Screen>
      <View style={{ marginBottom: 16 }}><BackButton onPress={() => (router.canGoBack() ? router.back() : router.replace('/people'))} /></View>
      {p && <View style={{ alignItems: 'center', gap: 10, marginBottom: 16 }}><Avatar p={p} size={96} radius={30} /><Text style={{ fontFamily: fonts.display700, fontSize: 26, color: colors.ink }}>{p.name}{p.age ? `, ${p.age}` : ''}</Text></View>}
      <Stub stage={6} text="Профиль: общие интересы, планы, «Добавить в друзья», «Написать»." />
    </Screen>
  );
}
