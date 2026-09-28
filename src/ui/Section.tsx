// Общие куски экранов настроек: подпись раздела, карточка-группа, строка с переключателем.
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme';
import { Switch } from './controls';

export function Cap({ children }: { children: string }) {
  return <Text style={styles.cap}>{children}</Text>;
}

export function Group({ children }: { children: ReactNode }) {
  return <View style={styles.group}>{children}</View>;
}

export function Row({ title, sub, right, last, children }: { title: string; sub?: string; right?: ReactNode; last?: boolean; children?: ReactNode }) {
  return (
    <View style={[styles.row, !last && styles.line]}>
      <View style={styles.rowTop}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.title}>{title}</Text>
          {!!sub && <Text style={styles.sub}>{sub}</Text>}
        </View>
        {right}
      </View>
      {children}
    </View>
  );
}

export function SwitchRow({ title, sub, on, onChange, last }: { title: string; sub?: string; on: boolean; onChange: (v: boolean) => void; last?: boolean }) {
  return <Row title={title} sub={sub} last={last} right={<Switch on={on} onChange={onChange} label={title} />} />;
}

const styles = StyleSheet.create({
  cap: { fontFamily: fonts.mono600, fontSize: 11, letterSpacing: 0.9, color: colors.muted, marginTop: 8 },
  group: { borderRadius: 18, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card },
  row: { paddingVertical: 12, paddingHorizontal: 14, gap: 10 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  line: { borderBottomWidth: 1, borderBottomColor: colors.sand },
  title: { fontFamily: fonts.body600, fontSize: 15, color: colors.ink },
  sub: { fontFamily: fonts.body400, fontSize: 12.5, lineHeight: 17, color: colors.muted },
});
