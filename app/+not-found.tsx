// Неизвестная ссылка (например, «meets:///» после обновления из уведомления): не английская заглушка, а сразу домой.
import { Redirect } from 'expo-router';

export default function NotFound() {
  return <Redirect href="/" />;
}
