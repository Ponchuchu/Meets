// Колокольчик «Уведомления» с числом нового (FIX5) — в «Чатах» и в «Профиле», ведёт в ленту уведомлений.
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Bell } from 'lucide-react-native';
import { Pressable, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { getActivity, useActivitySeen } from '../../activity/data';
import { unseenCount } from '../../activity/model';
import { colors } from '../../theme';

export function useNewActivity(): number {
  const q = useQuery({ queryKey: ['activity'], queryFn: getActivity, staleTime: 60e3, refetchInterval: 120e3 });
  const seenAt = useActivitySeen((s) => s.seenAt);
  return unseenCount(q.data ?? [], seenAt);
}

export function ActivityBell({ style, dot, dotText, color = colors.ink }: { style: StyleProp<ViewStyle>; dot: StyleProp<ViewStyle>; dotText: StyleProp<TextStyle>; color?: string }) {
  const n = useNewActivity();
  return (
    <Pressable onPress={() => router.push('/activity')} style={style} accessibilityRole="button" accessibilityLabel={n ? `Уведомления, новых: ${n}` : 'Уведомления'}>
      <Bell size={20} color={color} strokeWidth={1.9} />
      {n > 0 && <View style={dot}><Text style={dotText}>{n > 9 ? '9+' : n}</Text></View>}
    </Pressable>
  );
}
