// Описание события (FIX3): абзацы как у редактора, длинный текст раскрывается плавно.
// «Важно: …» больше не показываем (21 окт.): там повторялись время, место и цена, которые уже есть на плашках выше.
import { ChevronDown, Languages } from 'lucide-react-native';
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

/** Язык события — тихой строкой над описанием, если не русский (описание уже по-русски). */
const LANGS = ['на казахском и русском', 'на казахском', 'на английском'];
export const langOf = (tags: string[] = []) => LANGS.find((l) => tags.includes(l)) ?? null;

export function AboutBlock({ text, lang, original }: { text: string; lang?: string | null; original?: { title?: string; about: string } }) {
  // «Показать оригинал»: карточка переведена с казахского — по кнопке видно исходный текст.
  const [orig, setOrig] = useState(false);
  const { paragraphs } = splitAbout(orig && original ? original.about || text : text);
  const long = text.length > 360 || paragraphs.length > 2;
  const [open, setOpen] = useState(!long);
  const shown = open ? paragraphs : paragraphs.slice(0, 1);
  return (
    <View style={{ gap: 10 }}>
      {!!lang && <View style={styles.lang}><Languages size={13} color={colors.muted2} strokeWidth={2} /><Text style={styles.langText}>{original ? 'Переведено с казахского' : `Событие ${lang} · описание по-русски`}</Text></View>}
      {!!original && (
        <Pressable onPress={() => setOrig((v) => !v)} style={styles.origBtn} accessibilityRole="button" accessibilityState={{ selected: orig }}>
          <Text style={styles.origText}>{orig ? 'Показать перевод' : 'Показать оригинал'}</Text>
        </Pressable>
      )}
      {orig && !!original?.title && <Text style={styles.origTitle}>{original.title}</Text>}
      {shown.map((p, i) => <Text key={i} style={[styles.p, i === 0 && styles.lead]} numberOfLines={!open && i === 0 ? 4 : undefined}>{p}</Text>)}
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
  lang: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 9, height: 24, borderRadius: 12, backgroundColor: colors.sand },
  langText: { fontFamily: fonts.body500, fontSize: 12, color: colors.muted2 },
  origBtn: { alignSelf: 'flex-start', minHeight: 36, justifyContent: 'center' },
  origText: { fontFamily: fonts.body700, fontSize: 13.5, color: colors.accentText },
  origTitle: { fontFamily: fonts.display700, fontSize: 17, color: colors.ink },
  p: { fontFamily: fonts.body400, fontSize: 15, lineHeight: 23, color: colors.muted2 },
  lead: { fontFamily: fonts.body500, fontSize: 16.5, lineHeight: 24, color: colors.ink },
  more: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', minHeight: 44, paddingHorizontal: 14, borderRadius: 22, ...plate },
  moreText: { fontFamily: fonts.body700, fontSize: 14, color: colors.ink },
});
