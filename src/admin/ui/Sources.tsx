// Источники: ссылки, доверие, «собирать», «Добавить ссылку». Заголовок и пояснение даёт «Настройки».
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import { colors, fonts } from '../../theme';
import { Toggle as Switch } from '../../ui/v6/Settings';
import { addSource, loadSources, parseSourceLink, updateSource } from '../api';
import type { SourceItem } from '../model';
import { sourceHow, sourceMark } from '../runStats';
import { useAdminDemo } from '../store';

export function Sources({ live }: { live: boolean }) {
  const qc = useQueryClient();
  const demo = useAdminDemo();
  const q = useQuery({ queryKey: ['admin', 'sources'], queryFn: loadSources, enabled: live });
  const list = live ? (q.data ?? []) : demo.sources;
  const [adding,setAdding]=useState(false);
  const [link, setLink] = useState('');
  const [error, setError] = useState<string | null>(null);

  const change = useMutation({
    mutationFn: async ({ s, patch }: { s: SourceItem; patch: Partial<SourceItem> }) => {
      if (!live) return demo.setSource(s.id, patch);
      await updateSource(s.id, { trusted: patch.trusted, enabled: patch.enabled, auto_publish: patch.trusted === false ? false : undefined });
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['admin', 'sources'] }),
  });

  const add = async () => {
    const parsed = parseSourceLink(link);
    if (!parsed) return setError('Не похоже на ссылку: t.me/канал, threads.net/@ник или адрес сайта');
    setError(null);
    if(adding)return;
    setAdding(true);
    if (live) {
      try {
        await addSource(link);
        void qc.invalidateQueries({ queryKey: ['admin', 'sources'] });
      } catch {
        setAdding(false);return setError('Такой источник уже есть или нет связи');
      }
    } else {
      demo.addSource({ id: `s-${Date.now()}`, kind: parsed.kind, title: parsed.title, note: parsed.kind === 'telegram' ? 'канал читается целиком' : 'проверим вручную', trusted: false, autoPublish: false, enabled: true });
    }
    setLink('');setAdding(false);
  };

  return (
    <View style={styles.root}>
      <View style={styles.box}>
        {list.map((s, i) => (
          <Animated.View key={s.id} entering={FadeInDown.duration(200)} layout={LinearTransition} style={[styles.row, i > 0 && styles.rowLine]}>
            <View style={styles.mark}><Text style={styles.markText}>{sourceMark(s.kind, s.title, s.handle)}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{s.title}</Text>
              {!!s.note && <Text style={styles.note}>{s.note}</Text>}
              {!!sourceHow(s.kind).label && <Text style={[styles.note, { color: sourceHow(s.kind).free ? colors.muted2 : colors.muted }]}>{sourceHow(s.kind).label}</Text>}
            </View>
            {s.trusted && <View style={styles.trust}><Text style={styles.trustText}>ДОВЕРИЕ</Text></View>}
            <View style={styles.toggles}>
              <View style={styles.toggle}><Text style={styles.tLabel}>доверять</Text><Switch on={s.trusted} onChange={(v) => {if(!change.isPending)change.mutate({ s, patch: { trusted: v } });}} label={`Доверие: ${s.title}`} /></View>
              <View style={styles.toggle}><Text style={styles.tLabel}>собирать</Text><Switch on={s.enabled} onChange={(v) => {if(!change.isPending)change.mutate({ s, patch: { enabled: v } });}} label={`Собирать: ${s.title}`} /></View>
            </View>
          </Animated.View>
        ))}
        <View style={[styles.row, styles.rowLine]}>
          <View style={[styles.mark, styles.plus]}><Text style={[styles.markText, { color: colors.muted }]}>+</Text></View>
          <TextInput value={link} onChangeText={setLink} onSubmitEditing={add} placeholder="Добавить ссылку" placeholderTextColor={colors.muted2} style={styles.input} accessibilityLabel="Ссылка на источник" autoCapitalize="none" />
          {!!link.trim() && <Pressable onPress={add} style={styles.addBtn} accessibilityRole="button"><Text style={styles.addText}>Добавить</Text></Pressable>}
        </View>
      </View>
      {(q.isError||change.isError)&&<Text style={[styles.note,{color:colors.accentText}]}>Не удалось сохранить источники. Проверь связь и повтори.</Text>}
      {error && <Text style={[styles.note, { color: colors.accentText }]}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { width: '100%', paddingTop: 0, paddingBottom: 0, gap: 12 },
  box: { backgroundColor: colors.cardAlt, borderRadius: 18, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 12, flexWrap: 'wrap' },
  rowLine: { borderTopWidth: 1, borderTopColor: colors.line },
  mark: { width: 34, height: 34, borderRadius: 9, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  plus: { backgroundColor: 'transparent', borderWidth: 1.2, borderStyle: 'dashed', borderColor: colors.line2 },
  markText: { fontFamily: fonts.mono600, fontSize: 11, color: colors.paper },
  title: { fontFamily: fonts.body700, fontSize: 14.5, color: colors.ink },
  note: { fontFamily: fonts.body400, fontSize: 12.5, color: colors.muted },
  trust: { backgroundColor: colors.ink, borderRadius: 5, paddingHorizontal: 6, paddingVertical: 3 },
  trustText: { fontFamily: fonts.mono600, fontSize: 9.5, color: colors.paper },
  toggles: { flexDirection: 'row', gap: 12, flexBasis:'100%',flexWrap:'wrap' },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tLabel: { fontFamily: fonts.body500, fontSize: 12.5, color: colors.muted2 },
  input: { flex: 1, height: 36, fontFamily: fonts.body500, fontSize: 14.5, color: colors.ink },
  addBtn: { height: 34, borderRadius: 10, backgroundColor: colors.ink, paddingHorizontal: 14, justifyContent: 'center' },
  addText: { fontFamily: fonts.body700, fontSize: 13, color: colors.paper },
});
