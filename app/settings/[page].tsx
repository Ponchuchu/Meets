import { useLocalSearchParams } from 'expo-router';
import { SettingsSubPage } from '../../src/features/profile/settings';

export default function SettingsPageRoute() {
  const { page } = useLocalSearchParams<{ page: string }>();
  return <SettingsSubPage page={String(page ?? '')} />;
}
