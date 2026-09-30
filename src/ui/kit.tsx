// Базовые элементы из макета: кнопки, «назад», шаги, чипсы, сегменты, поле.
import { forwardRef, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps, type ViewStyle } from 'react-native';
import { colors, fonts, shadows } from '../theme';
import { Glyph } from './Glyph';

type Variant = 'accent' | 'dark' | 'light' | 'disabled';
const V: Record<Variant, { bg: string; fg: string; border?: string }> = {
  accent: { bg: colors.accent, fg: colors.ink },
  dark: { bg: colors.ink, fg: colors.paper },
  light: { bg: colors.card, fg: colors.ink, border: colors.ink },
  disabled: { bg: colors.sand, fg: colors.muted3 },
};

export function Button({ label, onPress, variant = 'dark', height = 56, icon, disabled, style, accessibilityLabel }: {
  label: string; onPress?: () => void; variant?: Variant; height?: number; icon?: ReactNode; disabled?: boolean; style?: ViewStyle; accessibilityLabel?: string;
}) {
  const v = V[disabled ? 'disabled' : variant];
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      accessibilityLabel={accessibilityLabel ?? label}
      style={({ pressed }) => [
        styles.button,
        { height, backgroundColor: v.bg, borderColor: v.border ?? 'transparent', borderWidth: v.border ? 1.5 : 0, transform: [{ scale: pressed && !disabled ? 0.98 : 1 }] },
        style,
      ]}
    >
      {icon}
      <Text style={[styles.buttonText, { color: v.fg, fontSize: height >= 56 ? 16 : 15.5 }]}>{label}</Text>
    </Pressable>
  );
}

export function BackButton({ onPress, size = 44, label = 'Назад' }: { onPress: () => void; size?: number; label?: string }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={size < 44 ? (44 - size) / 2 : 0}
      style={[styles.back, { width: size, height: size, borderRadius: size / 2 }]}>
      <Glyph name="back" size={size >= 44 ? 20 : 16} color={colors.ink} strokeWidth={2} />
    </Pressable>
  );
}

export function Steps({ step, total = 3, onBack }: { step: number; total?: number; onBack?: () => void }) {
  return (
    <View style={styles.steps}>
      {onBack && <BackButton onPress={onBack} size={36} />}
      <Text style={styles.stepText}>{step} / {total}</Text>
      <View style={styles.stepBars} accessibilityLabel={`Шаг ${step} из ${total}`}>
        {Array.from({ length: total }, (_, i) => (
          <View key={i} style={[styles.stepBar, { backgroundColor: i < step ? colors.ink : '#D6D0C3' }]} />
        ))}
      </View>
    </View>
  );
}

export function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: on }}
      style={[styles.chip, { backgroundColor: on ? colors.ink : colors.card, borderColor: on ? colors.ink : colors.line2 }]}>
      <Text style={[styles.chipText, { color: on ? colors.paper : colors.ink }]}>{label}</Text>
    </Pressable>
  );
}

export function Segments<K extends string>({ options, value, onChange, label }: {
  options: [K, string][]; value: K; onChange: (k: K) => void; label: string;
}) {
  return (
    <View style={styles.segments} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {options.map(([k, text]) => {
        const on = k === value;
        return (
          <Pressable key={k} onPress={() => onChange(k)} accessibilityRole="radio" accessibilityState={{ selected: on }}
            style={[styles.segment, on && { backgroundColor: colors.card, ...shadows.small, shadowOpacity: 0.14, shadowRadius: 3 }]}>
            <Text style={[styles.segmentText, { fontFamily: on ? fonts.body600 : fonts.body500 }]}>{text}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export const Field = forwardRef<TextInput, TextInputProps & { invalid?: boolean }>(function Field({ style, invalid, ...props }, ref) {
  return (
    <TextInput
      ref={ref}
      placeholderTextColor={colors.muted3}
      style={[styles.field, invalid && { borderColor: colors.accentText }, style]}
      {...props}
    />
  );
});

export function FieldLabel({ children }: { children: string }) {
  return <Text style={styles.fieldLabel}>{children}</Text>;
}

const styles = StyleSheet.create({
  button: { borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  buttonText: { fontFamily: fonts.body600 },
  back: { borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  steps: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 36 },
  stepText: { fontFamily: fonts.mono600, fontSize: 11, letterSpacing: 0.66, color: colors.ink },
  stepBars: { flex: 1, flexDirection: 'row', gap: 4 },
  stepBar: { flex: 1, height: 3, borderRadius: 2 },
  chip: { height: 40, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, justifyContent: 'center' },
  chipText: { fontFamily: fonts.body500, fontSize: 14 },
  segments: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: 14, backgroundColor: colors.sand },
  segment: { flex: 1, height: 40, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  segmentText: { fontSize: 13.5, color: colors.ink },
  field: {
    height: 52, paddingHorizontal: 16, borderWidth: 1, borderColor: colors.line2, borderRadius: 16,
    backgroundColor: colors.card, fontFamily: fonts.body400, fontSize: 16, color: colors.ink,
  },
  fieldLabel: { fontFamily: fonts.body600, fontSize: 13, color: colors.muted2 },
});
