// Страница события (Event, HikeEvent) — единый шаблон EventPage.
import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { data, eventsSnapshot } from '../../src/data';
import { EventPage } from '../../src/event/EventPage';
import {config} from '../../src/lib/config';
import {getEventsByIds} from '../../src/live/api';
import { archiveEvents } from '../../src/data/demo';
import { now as clockNow } from '../../src/lib/clock';
import { usePlans } from '../../src/state/plans';
import { colors } from '../../src/theme';

export default function EventScreen() {
  const { id, invite } = useLocalSearchParams<{ id: string; invite?: string }>();
  const { data: events = [] } = useQuery({ queryKey: ['events'], queryFn: () => data.getEvents(), placeholderData: eventsSnapshot });
  const meetups = usePlans((s) => s.meetups);
  const [now, setNow] = useState(clockNow);
  useEffect(() => {
    const t = setInterval(() => setNow(clockNow()), 60000);
    return () => clearInterval(t);
  }, []);
  // Прошлые события из хроники профиля тоже открываются здесь.
  const known = [...meetups, ...events].find(x=>x.id===id);
  const detail=useQuery({queryKey:['event',id],queryFn:()=>getEventsByIds([id]),enabled:config.dataMode!=='demo'&&!known,retry:1});
  const e = known ?? (config.dataMode==='demo'?archiveEvents().find(x=>x.id===id):detail.data?.[0]);
  if(!e&&!(config.dataMode!=='demo'&&detail.isPending))return <View style={{flex:1,backgroundColor:colors.paper,justifyContent:'center',alignItems:'center',gap:20}}><Text>Событие недоступно или не удалось загрузить</Text><Pressable onPress={()=>router.canGoBack()?router.back():router.replace('/')}><Text>Вернуться</Text></Pressable></View>;
  if (!e) return <View style={{ flex: 1, backgroundColor: colors.paper, justifyContent: 'center' }}><ActivityIndicator color={colors.ink} /></View>;
  return <EventPage e={e} now={now} initialSheet={invite === '1' ? 'invite' : null} onClose={() => (router.canGoBack() ? router.back() : router.replace('/'))} />;
}
