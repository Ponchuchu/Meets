import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { Screen, Stub } from '../../src/components/Screen';
import { useApp } from '../../src/state/app';

export default function ForYouScreen() {
  const seenFeed = useApp((s) => s.seenFeed);
  useFocusEffect(useCallback(() => { seenFeed(); }, [seenFeed]));
  return (
    <Screen title="Для тебя">
      <Stub stage={4} text="Стопка карточек: вправо — «пойду», влево — «мимо». Карточка «пойду» улетает дугой в профиль." />
    </Screen>
  );
}
