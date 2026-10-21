// Одна строка списка событий в панели: обложка или иконка раздела, название, строка под ним и кнопки справа.
// Строки выкатываются снизу по очереди (delay), как в макете.
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Category } from '../../data/types';
import { colors, fonts } from '../../theme';
import { EventCover } from '../../ui/EventCover';

/** «2 500 ₸» не разрывается между строками. */
const keep = (t: string) => t.replace(/(\d) (\d{3})/g, '$1\u00A0$2').replace(/ ₸/g, '\u00A0₸');

export function EventRow({ title, sub, tag, warn, cover, category, right, onPress }: {
  title: string; sub: string; /** Откуда событие: «ЯНДЕКС АФИША», «SXODIM», «TELEGRAM · @…». */ tag?: string; warn?: string; cover?: string | null; category?: Category; right?: ReactNode; onPress: () => void; index?: number;
}) {
  return (
    <View style={styles.row}>
      <Pressable onPress={onPress} style={styles.main} accessibilityRole="button" accessibilityLabel={`Открыть: ${title}`}>
        <EventCover cover={cover} category={category ?? 'meetup'} style={styles.thumb} iconSize={30} />
        <View style={styles.text}>
          {!!tag && <Text style={styles.tag} numberOfLines={1}>{tag}</Text>}
          <Text style={styles.title} numberOfLines={2}>{title}</Text>
          <Text style={styles.sub} numberOfLines={2}>{keep(sub)}</Text>
          {!!warn && <Text style={styles.warn} numberOfLines={1}>{warn}</Text>}
        </View>
      </Pressable>
      {right}
    </View>
  );
}

export function RoundBtn({ label, onPress, solid, children, disabled }: { label: string; onPress: () => void; solid?: boolean; children: ReactNode; disabled?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={label} hitSlop={2}
      style={[styles.round, solid && { backgroundColor: colors.ink, borderColor: colors.ink }, disabled && { opacity: 0.4 }]}>
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.card, borderRadius: 18, borderWidth: 1, borderColor: colors.line, paddingVertical: 10, paddingLeft: 10, paddingRight: 10 },
  main: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52 },
  thumb: { width: 52, height: 52, borderRadius: 14 },
  text: { flex: 1, gap: 2 },
  tag: { fontFamily: fonts.mono600, fontSize: 10, letterSpacing: 0.5, color: colors.muted3 },
  title: { fontFamily: fonts.display700, fontSize: 15.5, lineHeight: 20, color: colors.ink },
  sub: { fontFamily: fonts.body400, fontSize: 12.5, lineHeight: 17, color: colors.muted },
  warn: { fontFamily: fonts.body600, fontSize: 12, color: colors.accentText },
  round: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: colors.line2, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
});
