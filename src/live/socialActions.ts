// Локальные флаги меняются только после успешной записи; ошибка остаётся видимой на экране.
import { config } from '../lib/config';
import { useSocial, type RequestAnswer } from '../state/social';
import { answerFriend, cancelFriendRequest, removeFriend, requestFriend } from './api';
import { queryClient } from './query';

const pending = new Set<string>();

async function change(id: string, remote: () => Promise<void>, local: () => void, onError: (text: string) => void): Promise<boolean> {
  if (pending.has(id)) return false;
  pending.add(id);
  try {
    if (config.dataMode !== 'demo') await remote();
    local();
    for (const key of ['people', 'friendRequests', 'friendSpots', 'chats', 'person']) {
      void queryClient.invalidateQueries({ queryKey: [key] });
    }
    return true;
  } catch {
    onError('Не удалось сохранить. Проверь связь и повтори');
    return false;
  } finally {
    pending.delete(id);
  }
}

export function useSocialActions(onError: (text: string) => void) {
  const social = useSocial();
  return {
    ...social,
    answer: (id: string, answer: RequestAnswer) => change(id,
      () => answerFriend(id, answer === 'accepted'),
      () => {
        useSocial.getState().answer(id, answer);
        if (answer === 'accepted') useSocial.setState(s => ({ removed: Object.fromEntries(Object.entries(s.removed).filter(([key]) => key !== id)) }));
      }, onError),
    toggleRequest: (id: string) => {
      const sent = !!useSocial.getState().sent[id];
      return change(id, () => sent ? cancelFriendRequest(id) : requestFriend(id), () => useSocial.getState().toggleRequest(id), onError);
    },
    removeFriend: (id: string) => change(id, () => removeFriend(id), () => useSocial.getState().removeFriend(id), onError),
  };
}
