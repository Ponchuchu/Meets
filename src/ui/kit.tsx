// Базовые элементы из макета: «назад», чипсы, сегменты.
import { Pressable, StyleSheet } from 'react-native';
import { colors } from '../theme';
import { Glyph } from './Glyph';

export function BackButton({ onPress, size = 44, label = 'Назад' }: { onPress: () => void; size?: number; label?: string }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={size < 44 ? (44 - size) / 2 : 0}
      style={[styles.back, { width: size, height: size, borderRadius: size / 2 }]}>
      <Glyph name="back" size={size >= 44 ? 20 : 16} color={colors.ink} strokeWidth={2} />
    </Pressable>
  );
}
const styles = StyleSheet.create({
  back: { borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
});
