import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { openDirectChat } from '../../data/remote';
import { colors } from '../../theme';
import { StateView } from '../../ui/StateView';

/** No composer or local messages exist until the server resolves the direct chat. */
export function DirectChatOpening({ personId }: { personId: string }) {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    openDirectChat(personId).then((id) => {
      if (!active) return;
      void qc.invalidateQueries({ queryKey: ['chats'] });
      router.replace({ pathname: '/chat/[id]', params: { id } });
    }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [attempt, personId, qc]);
  return <View style={{ flex: 1, backgroundColor: colors.paper, justifyContent: 'center' }}>
    <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace('/chats')}
      accessibilityRole="button" accessibilityLabel="Назад"
      style={{ position: 'absolute', top: Math.max(44, insets.top + 4), left: 12, width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}>
      <ChevronLeft size={28} color={colors.ink} strokeWidth={2.2} />
    </Pressable>
    <StateView kind={failed ? 'error' : 'loading'} title={failed ? 'Не получилось открыть чат' : 'Открываю чат…'}
      text={failed ? 'Проверь связь и попробуй ещё раз.' : undefined} action={failed ? 'Повторить' : undefined}
      onAction={failed ? () => { setFailed(false); setAttempt(n => n + 1); } : undefined} />
  </View>;
}
