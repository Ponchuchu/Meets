import { useQuery } from '@tanstack/react-query';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { Text } from 'react-native';
import { supabase } from '../../src/data/client';
import { SettingsPage } from '../../src/ui/v6/Settings';

export default function HandleLink() {
  const { handle } = useLocalSearchParams<{ handle: string }>();
  const q = useQuery({ queryKey: ['handle', handle], queryFn: async () => { const r = await supabase().from('profiles').select('id').eq('handle', handle).maybeSingle(); if (r.error) throw r.error; return r.data; } });
  if (q.data) return <Redirect href={{ pathname: '/person/[id]', params: { id: q.data.id } }} />;
  return <SettingsPage title="Профиль"><Text>{q.isPending ? 'Ищу профиль…' : 'Профиль не найден или недоступен'}</Text></SettingsPage>;
}
