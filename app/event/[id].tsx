// Страница события (Event, HikeEvent) — единый шаблон EventPage.
import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { data, eventsSnapshot } from '../../src/data';
import { EventPage } from '../../src/event/EventPage';
import { archiveEvents } from '../../src/data/demo';
import { now as clockNow } from '../../src/lib/clock';
import { usePlans } from '../../src/state/plans';
import { colors } from '../../src/theme';

export default function EventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: events = [] } = useQuery({ queryKey: ['events'], queryFn: () => data.getEvents(), placeholderData: eventsSnapshot });
  const meetups = usePlans((s) => s.meetups);
  const [now, setNow] = useState(clockNow);
  useEffect(() => {
    const t = setInterval(() => setNow(clockNow()), 60000);
    return () => clearInterval(t);
  }, []);
  // Прошлые события из хроники профиля тоже открываются здесь.
  const e = [...meetups, ...events].find((x) => x.id === id) ?? archiveEvents().find((x) => x.id === id);
  if (!e) return <View style={{ flex: 1, backgroundColor: colors.paper, justifyContent: 'center' }}><ActivityIndicator color={colors.ink} /></View>;
  return <EventPage e={e} now={now} onClose={() => (router.canGoBack() ? router.back() : router.replace('/'))} />;
}
