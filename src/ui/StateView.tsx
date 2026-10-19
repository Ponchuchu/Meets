// Единые состояния экранов: загрузка, ошибка, нет сети, пусто. Одна иконка в мягкой плашке, заголовок, пояснение,
// при необходимости — кнопка. Без постоянных анимаций: для загрузки — системный индикатор (дешёвый на любых телефонах).
import { AlertCircle, Inbox, SearchX, WifiOff, type LucideIcon } from 'lucide-react-native';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { colors, fonts, radii, space } from '../theme';

export type StateKind = 'loading' | 'error' | 'offline' | 'empty' | 'nothing-found';

const DEFAULTS: Record<StateKind, { Icon?: LucideIcon; title: string; text?: string }> = {
  loading: { title: 'Загружаю…' },
  error: { Icon: AlertCircle, title: 'Не получилось загрузить', text: 'Попробуй ещё раз через минуту.' },
  offline: { Icon: WifiOff, title: 'Нет интернета', text: 'Покажу, что сохранилось. Обновлю, как появится связь.' },
  empty: { Icon: Inbox, title: 'Пока пусто' },
  'nothing-found': { Icon: SearchX, title: 'Ничего не нашлось', text: 'Попробуй другое слово.' },
};

export function StateView({ kind, title, text, action, onAction, compact, style }: {
  kind: StateKind; title?: string; text?: string; action?: string; onAction?: () => void;
  /** В списке или шторке: меньше отступы, без плашки-иконки. */
  compact?: boolean; style?: StyleProp<ViewStyle>;
}) {
  const d = DEFAULTS[kind];
  const Icon = d.Icon;
  const label = action ?? (kind === 'error' || kind === 'offline' ? 'Повторить' : undefined);
  return (
    <Animated.View entering={FadeIn.duration(180)} style={[styles.root, compact && styles.compact, style]}
      accessibilityLiveRegion="polite" accessibilityRole={kind === 'loading' ? 'progressbar' : 'summary'}>
      {kind === 'loading' ? <ActivityIndicator color={colors.accent} size={compact ? 'small' : 'large'} /> : Icon && !compact ? (
        <View style={[styles.icon, kind === 'error' || kind === 'offline' ? styles.iconWarn : null]}>
          <Icon size={26} color={kind === 'error' || kind === 'offline' ? colors.accentText : colors.muted2} strokeWidth={1.8} />
        </View>
      ) : null}
      <Text style={[styles.title, compact && styles.titleCompact]}>{title ?? d.title}</Text>
      {(text ?? d.text) ? <Text style={[styles.text, compact && { textAlign: 'left' }]}>{text ?? d.text}</Text> : null}
      {label && onAction ? (
        <Pressable onPress={onAction} style={({ pressed }) => [styles.btn, pressed && { transform: [{ scale: 0.97 }] }]} accessibilityRole="button" hitSlop={4}>
          <Text style={styles.btnText}>{label}</Text>
        </Pressable>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', justifyContent: 'center', gap: space.s, paddingVertical: 40, paddingHorizontal: space.xl },
  compact: { paddingVertical: space.l, paddingHorizontal: space.s, alignItems: 'flex-start' },
  icon: { width: 64, height: 64, borderRadius: radii.lg, backgroundColor: colors.sand, alignItems: 'center', justifyContent: 'center', marginBottom: space.xs },
  iconWarn: { backgroundColor: 'rgba(240,82,31,0.14)' },
  title: { fontFamily: fonts.display700, fontSize: 18, color: colors.ink, textAlign: 'center' },
  titleCompact: { fontSize: 15.5, textAlign: 'left' },
  text: { fontFamily: fonts.body400, fontSize: 14, lineHeight: 20, color: colors.muted, textAlign: 'center', maxWidth: 300 },
  btn: { marginTop: space.s, minHeight: 44, paddingHorizontal: 22, borderRadius: radii.md, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontFamily: fonts.body700, fontSize: 15, color: colors.paper },
});
