// Общая обёртка экрана вкладки: фон paper, отступ сверху от безопасной зоны.
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, space } from '../theme';

export function Screen({ title, children, scroll = true }: { title?: string; children?: ReactNode; scroll?: boolean }) {
  const insets = useSafeAreaInsets();
  const body = (
    <>
      {title ? <Text style={styles.title} accessibilityRole="header">{title}</Text> : null}
      {children}
    </>
  );
  return scroll ? (
    <ScrollView style={styles.root} contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}>{body}</ScrollView>
  ) : (
    <View style={[styles.root, styles.content, { paddingTop: insets.top + 12 }]}>{body}</View>
  );
}

export function Stub({ stage, text }: { stage: number; text: string }) {
  return (
    <View style={styles.stub}>
      <Text style={styles.stubLabel}>ЭТАП {stage}</Text>
      <Text style={styles.stubText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  content: { paddingHorizontal: space.screen, paddingBottom: 24 },
  title: { fontFamily: fonts.display700, fontSize: 30, letterSpacing: -0.6, color: colors.ink, marginBottom: 16 },
  stub: { backgroundColor: colors.card, borderRadius: 24, borderWidth: 1, borderColor: colors.line, padding: 18, gap: 6, marginBottom: 16 },
  stubLabel: { fontFamily: fonts.mono600, fontSize: 11, letterSpacing: 0.8, color: colors.accentText },
  stubText: { fontFamily: fonts.body400, fontSize: 15, color: colors.muted2, lineHeight: 21 },
});
