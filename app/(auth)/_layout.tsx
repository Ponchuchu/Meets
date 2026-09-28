import { Redirect, Stack } from 'expo-router';
import { useSession } from '../../src/state/session';
import { colors } from '../../src/theme';

export default function AuthLayout() {
  const hydrated = useSession((s) => s.hydrated);
  const onboarded = useSession((s) => s.onboarded);
  if (hydrated && onboarded) return <Redirect href="/" />;
  return <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right', contentStyle: { backgroundColor: colors.paper } }} />;
}
