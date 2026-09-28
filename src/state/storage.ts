// Хранилище для zustand persist: AsyncStorage (на web — localStorage). При статической сборке web window нет — пустышка.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { createJSONStorage, type StateStorage } from 'zustand/middleware';

const SSR: StateStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };

export const deviceStorage = () =>
  createJSONStorage(() => (Platform.OS === 'web' && typeof window === 'undefined' ? SSR : (AsyncStorage as StateStorage)));
