// Описание события (FIX3): абзацы как у редактора, «Важно: …» — отдельной плашкой, длинный текст раскрывается плавно.
import { ChevronDown, Info } from 'lucide-react-native';
import { useState } from 'react';
import { LayoutAnimation, Platform, Pressable, StyleSheet, Text, UIManager, View } from 'react-native';
import { colors, fonts } from '../../theme';
import { plate } from '../../ui/glass';

if (Platform.OS === 'android') UIManager.setLayoutAnimationEnabledExperimental?.(true);

/** Абзацы и строка «Важно: …» из текста описания. */
export function splitAbout(text: string): { paragraphs: string[]; note: string | null } {
  const parts = text.split(/\n\s*\n|\n(?=Важно:)/).map(p => p.trim()).filter(Boolean);
  const noteIdx = parts.findIndex(p => /^Важно:/i.test(p));
  const note = noteIdx >= 0 ? parts[noteIdx].replace(/^Важно:\s*/i, '') : null;
  return { paragraphs: parts.filter((_, i) => i !== noteIdx), note };
}

export function AboutBlock({ text }: { text: string }) {
  const { paragraphs, note } = splitAbout(text);
  const long = text.length > 360 || paragraphs.length > 2;
  const [open, setOpen] = useState(!long);
  const shown = open ? paragraphs : paragraphs.slice(0, 1);
  return (
    <View style={{ gap: 10 }}>
      {shown.map((p, i) => <Text key={i} style={[styles.p, i === 0 && styles.lead]} numberOfLines={!open && i === 0 ? 4 : undefined}>{p}</Text>)}
      {open && note && (
        <View style={styles.note}>
          <Info size={17} color={colors.accentText} strokeWidth={2} />
          <Text style={styles.noteText}><Text style={{ fontFamily: fonts.body700 }}>Важно: </Text>{note}</Text>
        </View>
      )}
      {long && (
        <Pressable onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.create(220, 'easeInEaseOut', 'opacity')); setOpen(v => !v); }} style={styles.more} accessibilityRole="button" accessibilityState={{ expanded: open }}>
          <Text style={styles.moreText}>{open ? 'Свернуть' : 'Читать полностью'}</Text>
          <ChevronDown size={16} color={colors.ink} strokeWidth={2.2} style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  p: { fontFamily: fonts.body400, fontSize: 15, lineHeight: 23, color: colors.muted2 },
  lead: { fontFamily: fonts.body500, fontSize: 16.5, lineHeight: 24, color: colors.ink },
  note: { flexDirection: 'row', gap: 10, padding: 12, borderRadius: 16, ...plate, alignItems: 'flex-start' },
  noteText: { flex: 1, fontFamily: fonts.body400, fontSize: 14, lineHeight: 20, color: colors.ink },
  more: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', minHeight: 44, paddingHorizontal: 14, borderRadius: 22, ...plate },
  moreText: { fontFamily: fonts.body700, fontSize: 14, color: colors.ink },
});
