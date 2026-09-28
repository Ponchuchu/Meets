import { useQuery } from '@tanstack/react-query';
import { StyleSheet, Text, View } from 'react-native';
import { Screen, Stub } from '../../src/components/Screen';
import { data } from '../../src/data';
import { colors, fonts } from '../../src/theme';

export default function ChatsScreen() {
  const { data: chats } = useQuery({ queryKey: ['chats'], queryFn: () => data.getChats() });
  return (
    <Screen title="Чаты">
      <Stub stage={7} text="Чаты событий и личные: фото, видео, голосовые, кружки и приглашения." />
      {chats?.map((c) => (
        <View key={c.id} style={styles.row}>
          <Text style={styles.title} numberOfLines={1}>{c.title}</Text>
          <Text style={styles.time}>{c.lastTime}</Text>
          <Text style={styles.last} numberOfLines={1}>{c.lastText}</Text>
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.line },
  title: { flex: 1, fontFamily: fonts.body600, fontSize: 15.5, color: colors.ink },
  time: { fontFamily: fonts.mono500, fontSize: 11, color: colors.muted },
  last: { width: '100%', fontFamily: fonts.body400, fontSize: 13.5, color: colors.muted, marginTop: 3 },
});
