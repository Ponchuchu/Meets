// Политика конфиденциальности и правила сообщества: /legal?doc=privacy | rules. Нужны сторам (TECH.md).
import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PRIVACY, RULES } from '../src/legal/texts';
import { colors, fonts } from '../src/theme';
import { BackButton } from '../src/ui/kit';

export default function Legal() {
  const insets = useSafeAreaInsets();
  const { doc } = useLocalSearchParams<{ doc?: string }>();
  const d = doc === 'rules' ? RULES : PRIVACY;
  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40, paddingHorizontal: 20 }}>
      <View style={styles.inner}>
        <BackButton onPress={() => (router.canGoBack() ? router.back() : router.replace('/settings'))} />
        <Text style={styles.h1} accessibilityRole="header">{d.title}</Text>
        <Text style={styles.updated}>ОБНОВЛЕНО {d.updated.toUpperCase()}</Text>
        {d.sections.map((s) => (
          <View key={s.h} style={{ gap: 8 }}>
            <Text style={styles.h2}>{s.h}</Text>
            {s.p.map((p) => <Text key={p} style={styles.p}>{p}</Text>)}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  inner: { width: '100%', maxWidth: 680, alignSelf: 'center', gap: 18 },
  h1: { fontFamily: fonts.display700, fontSize: 28, color: colors.ink, letterSpacing: -0.5, marginTop: 8 },
  updated: { fontFamily: fonts.mono500, fontSize: 10.5, color: colors.muted, letterSpacing: 0.5, marginTop: -10 },
  h2: { fontFamily: fonts.body700, fontSize: 17, color: colors.ink },
  p: { fontFamily: fonts.body400, fontSize: 15, lineHeight: 22, color: colors.muted2 },
});
