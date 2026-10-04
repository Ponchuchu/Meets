import { Geologica_600SemiBold, Geologica_700Bold, Geologica_800ExtraBold } from '@expo-google-fonts/geologica';
import { GolosText_400Regular, GolosText_500Medium, GolosText_600SemiBold, GolosText_700Bold } from '@expo-google-fonts/golos-text';
import { JetBrainsMono_500Medium, JetBrainsMono_600SemiBold } from '@expo-google-fonts/jetbrains-mono';
import { QueryClientProvider } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAuthWatch } from '../src/live/auth';
import { useNetWatch } from '../src/live/net';
import { persister, queryClient } from '../src/live/query';
import { colors } from '../src/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});


export default function RootLayout() {
  useNetWatch();
  useAuthWatch();
  const [loaded, error] = useFonts({
    Geologica_600SemiBold, Geologica_700Bold, Geologica_800ExtraBold,
    GolosText_400Regular, GolosText_500Medium, GolosText_600SemiBold, GolosText_700Bold,
    JetBrainsMono_500Medium, JetBrainsMono_600SemiBold,
  });

  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync().catch(() => {});
  }, [loaded, error]);

  if (!loaded && !error) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.paper }}>
      <SafeAreaProvider>
        {persister ? (
          <PersistQueryClientProvider client={queryClient} persistOptions={{ persister, maxAge: 24 * 3600e3, buster: 'v6' }}>
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
  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.paper }, gestureEnabled: true, fullScreenGestureEnabled: true, animation: 'slide_from_right' }} />
    </>
  );
}
