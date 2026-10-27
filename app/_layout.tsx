import { Pacifico_400Regular } from '@expo-google-fonts/pacifico';
import { Rubik_400Regular, Rubik_500Medium, Rubik_600SemiBold, Rubik_700Bold, Rubik_800ExtraBold } from '@expo-google-fonts/rubik';
import { QueryClientProvider } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useSyncExternalStore } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Splash } from '../src/features/auth/Splash';
import { useAuthWatch } from '../src/live/auth';
import '../src/live/location'; // фоновая задача геолокации должна быть объявлена при старте
import { useNetWatch } from '../src/live/net';
import { useLiveChats } from '../src/data/realtime';
import { KEEP_MS, persister, queryClient, shouldPersist } from '../src/live/query';
import { colors, fonts } from '../src/theme';
import { installCrashHandler, recordCrash, setCrashScreen } from '../src/lib/crash';
import { Platform, Pressable, Text, View } from 'react-native';
import { router, Stack, usePathname, type ErrorBoundaryProps } from 'expo-router';

SplashScreen.preventAutoHideAsync().catch(() => {});
installCrashHandler();

/** Ошибка отрисовки любого экрана: вместо закрытия приложения — запись в журнал и «Вернуться». */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => { void recordCrash(error, false); }, [error]);
  return (
    <View style={{ flex: 1, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 14 }}>
      <Text style={{ fontFamily: fonts.display800, fontSize: 24, color: colors.ink, textAlign: 'center' }}>Что-то сломалось</Text>
      <Text style={{ fontFamily: fonts.body400, fontSize: 15, lineHeight: 21, color: colors.muted2, textAlign: 'center' }}>Мы уже записали ошибку и починим её. Вернись назад и попробуй ещё раз.</Text>
      <Pressable onPress={() => { void retry(); if (router.canGoBack()) router.back(); else router.replace('/'); }} accessibilityRole="button"
        style={{ minHeight: 50, paddingHorizontal: 28, borderRadius: 16, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontFamily: fonts.body700, fontSize: 15.5, color: colors.paper }}>Вернуться</Text>
      </Pressable>
    </View>
  );
}

const subscribeMount = () => () => undefined;
const clientSnapshot = () => true;
const serverSnapshot = () => false;

export default function RootLayout() {
  const mounted = useSyncExternalStore(subscribeMount, clientSnapshot, serverSnapshot);
  useNetWatch();
  useAuthWatch();
  const [loaded, error] = useFonts({
    Rubik_400Regular, Rubik_500Medium, Rubik_600SemiBold, Rubik_700Bold, Rubik_800ExtraBold, Pacifico_400Regular,
  });

  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync().catch(() => {});
  }, [loaded, error]);

  if ((Platform.OS === 'web' && !mounted) || (!loaded && !error)) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.paper }}>
      <SafeAreaProvider>
        {persister ? (
          <PersistQueryClientProvider client={queryClient} persistOptions={{ persister, maxAge: KEEP_MS, buster: 'v6', dehydrateOptions: { shouldDehydrateQuery: (q) => q.state.status === 'success' && shouldPersist(q.queryKey) } }}>
            <Root />
          </PersistQueryClientProvider>
        ) : (
          <QueryClientProvider client={queryClient}><Root /></QueryClientProvider>
        )}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function Root() {
  // Deep links can open a chat/profile without mounting the tabs shell.
  useLiveChats();
  const path = usePathname();
  useEffect(() => { setCrashScreen(path); }, [path]);
  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.paper }, gestureEnabled: true, fullScreenGestureEnabled: true, animation: 'slide_from_right' }} />
      <Splash />
    </>
  );
}
