// Каркас шагов регистрации 1–3: отступы как в макете, кнопка внизу, прокрутка на маленьких экранах.
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts } from '../theme';
import { Appear } from './motion';

export function StepScreen({ top, title, subtitle, children, footer, gap = 18, titleSize = 32 }: {
  top: ReactNode; title: string; subtitle: string; children: ReactNode; footer: ReactNode; gap?: number; titleSize?: number;
}) {
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[styles.content, { gap, paddingTop: Math.max(56, insets.top + 16), paddingBottom: insets.bottom + 30 }]} keyboardShouldPersistTaps="handled">
        {top}
        <Appear style={{ gap: 6 }}>
          <Text style={[styles.h1, { fontSize: titleSize }]} accessibilityRole="header">{title}</Text>
          <Text style={styles.sub}>{subtitle}</Text>
        </Appear>
        {children}
        <View style={{ flex: 1, minHeight: 12 }} />
        {footer}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  content: { flexGrow: 1, paddingHorizontal: 20 },
  h1: { fontFamily: fonts.display700, letterSpacing: -0.8, lineHeight: 34, color: colors.ink },
  sub: { fontFamily: fonts.body400, fontSize: 15, lineHeight: 22.5, color: colors.muted },
});
