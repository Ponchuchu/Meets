import { useQuery } from '@tanstack/react-query';
import { ActivityIndicator, StyleSheet, Text } from 'react-native';
import { EventRow } from '../../src/components/EventRow';
import { Screen, Stub } from '../../src/components/Screen';
import { data } from '../../src/data';
import { colors, fonts } from '../../src/theme';

export default function MapScreen() {
  const { data: events, isLoading } = useQuery({ queryKey: ['events'], queryFn: () => data.getEvents() });
  const real = events?.filter((e) => e.origin === 'real').length ?? 0;
  return (
    <Screen title="Карта">
      <Stub stage={2} text="Здесь будет карта Mapbox с пинами событий и друзьями. Пока — все события списком." />
      {isLoading ? <ActivityIndicator color={colors.ink} /> : (
        <Text style={styles.source}>
          {`${events?.length ?? 0} СОБЫТИЙ · НАСТОЯЩИХ ${real} · ${data.lastSource() === 'supabase' ? 'ИЗ SUPABASE' : 'ДЕМО-РЕЖИМ'}`}
        </Text>
      )}
      {events?.map((e) => <EventRow key={e.id} e={e} />)}
    </Screen>
  );
}

const styles = StyleSheet.create({
  source: { fontFamily: fonts.mono600, fontSize: 11, letterSpacing: 0.8, color: colors.accentText, marginBottom: 12 },
});
