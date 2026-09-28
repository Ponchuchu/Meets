import { useQuery } from '@tanstack/react-query';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Screen, Stub } from '../../src/components/Screen';
import { data } from '../../src/data';
import { photo } from '../../src/data/photos';
import { colors, fonts } from '../../src/theme';

export default function PeopleScreen() {
  const { data: people } = useQuery({ queryKey: ['people'], queryFn: () => data.getPeople() });
  return (
    <Screen title="Люди">
      <Stub stage={6} text="Друзья рядом, их планы, заявки и приглашение по ссылке." />
      {people?.map((p) => (
        <View key={p.id} style={styles.row}>
          {p.photo ? (
            <Image source={photo(p.photo)} style={[styles.ava, { borderColor: p.isFriend ? colors.friend : 'transparent' }]} accessibilityIgnoresInvertColors />
          ) : (
            <View style={[styles.ava, styles.letter, { backgroundColor: p.tint, borderColor: p.isFriend ? colors.friend : 'transparent' }]}>
              <Text style={styles.initial}>{p.initial}</Text>
            </View>
          )}
          <Text style={styles.name}>{p.name}</Text>
          <Text style={styles.tag}>{p.isFriend ? 'ДРУГ' : ''}</Text>
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  ava: { width: 44, height: 44, borderRadius: 22, borderWidth: 2 },
  letter: { alignItems: 'center', justifyContent: 'center' },
  initial: { fontFamily: fonts.display700, fontSize: 17, color: colors.ink },
  name: { flex: 1, fontFamily: fonts.body600, fontSize: 15.5, color: colors.ink },
  tag: { fontFamily: fonts.mono600, fontSize: 10, letterSpacing: 0.8, color: colors.friend },
});
