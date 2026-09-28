import { useQuery } from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Screen, Stub } from '../../src/components/Screen';
import { data } from '../../src/data';
import { photo } from '../../src/data/photos';
import { useApp } from '../../src/state/app';
import { colors, fonts } from '../../src/theme';

export default function MeScreen() {
  const seenPlans = useApp((s) => s.seenPlans);
  useFocusEffect(useCallback(() => { seenPlans(); }, [seenPlans]));
  const { data: me } = useQuery({ queryKey: ['me'], queryFn: () => data.getMe() });
  return (
    <Screen title="Профиль">
      {me && (
        <View style={styles.head}>
          <Image source={photo(me.photo)} style={styles.ava} accessibilityIgnoresInvertColors />
          <Text style={styles.name}>{me.name}</Text>
        </View>
      )}
      <Stub stage={5} text="Мои планы, моя карта города, значки и настройки." />
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 16 },
  ava: { width: 64, height: 64, borderRadius: 32 },
  name: { fontFamily: fonts.display700, fontSize: 24, color: colors.ink },
});
