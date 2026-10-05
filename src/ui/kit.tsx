// Базовые элементы из макета: «назад», чипсы, сегменты.
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, shadows } from '../theme';
import { Glyph } from './Glyph';

export function BackButton({ onPress, size = 44, label = 'Назад' }: { onPress: () => void; size?: number; label?: string }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={size < 44 ? (44 - size) / 2 : 0}
      style={[styles.back, { width: size, height: size, borderRadius: size / 2 }]}>
      <Glyph name="back" size={size >= 44 ? 20 : 16} color={colors.ink} strokeWidth={2} />
    </Pressable>
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

const styles = StyleSheet.create({
  back: { borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  chip: { height: 40, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, justifyContent: 'center' },
  chipText: { fontFamily: fonts.body500, fontSize: 14 },
  segments: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: 14, backgroundColor: colors.sand },
  segment: { flex: 1, height: 40, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  segmentText: { fontSize: 13.5, color: colors.ink },
});
