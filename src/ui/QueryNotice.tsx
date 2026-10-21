import { Pressable, Text, View } from 'react-native';
import { colors, fonts } from '../theme';

/** Ошибка загрузки не выглядит как пустой список и не прячет уже сохранённые данные. */
export function QueryNotice({ pending, error, onRetry }: { pending: boolean; error: boolean; onRetry: () => void }) {
  if (!pending && !error) return null;
  return <View style={{ padding: 14, gap: 6, borderRadius: 18, backgroundColor: colors.sand }} accessibilityLiveRegion="polite">
    <Text style={{ fontFamily: fonts.body500, color: colors.ink }}>{error ? 'Не удалось обновить данные. Сохранённое остаётся доступно' : 'Загружаю…'}</Text>
    {error && <Pressable accessibilityRole="button" onPress={onRetry} style={{ minHeight: 44, justifyContent: 'center' }}>
      <Text style={{ fontFamily: fonts.body700, color: colors.ink }}>Повторить</Text>
    </Pressable>}
  </View>;
}
