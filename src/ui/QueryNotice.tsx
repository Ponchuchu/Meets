import { ActivityIndicator, Text, View } from 'react-native';
import { colors, fonts } from '../theme';

/** Первая загрузка — тихая строка. Ошибку обновления не показываем плашкой (21 окт., как в Telegram):
 *  сохранённое остаётся на экране, а о связи говорит заголовок «Соединение…». onRetry оставлен для совместимости. */
export function QueryNotice({ pending }: { pending: boolean; error?: boolean; onRetry?: () => void }) {
  if (!pending) return null;
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 }} accessibilityLiveRegion="polite">
    <ActivityIndicator size="small" color={colors.muted2} />
    <Text style={{ fontFamily: fonts.body500, color: colors.muted2 }}>Загружаю…</Text>
  </View>;
}
