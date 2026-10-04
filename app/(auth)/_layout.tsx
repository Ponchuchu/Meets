// Вход альфы (V5Login*): привет → номер → код → «это ты?» → интересы → разрешения → «добро пожаловать».
import { Redirect, Stack } from 'expo-router';
import { useAuth } from '../../src/live/auth';
import { useSession } from '../../src/state/session';
import { colors } from '../../src/theme';

export default function AuthLayout() {
  const hydrated = useSession((s) => s.hydrated);
  const onboarded = useSession((s) => s.onboarded);
  const session = useAuth((s) => s.session);
  if (hydrated && onboarded && session) return <Redirect href="/" />;
  return <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right', contentStyle: { backgroundColor: colors.paper } }} />;
}
