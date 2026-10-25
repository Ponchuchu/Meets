// Источники одним списком: значок типа, название, адрес или @канал и один переключатель «собирать».
// Нажатие на строку — подробности: название, доверие, удаление. «Добавить источник» — одно поле, тип узнаём сами.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AtSign, Globe, PenLine, Plus, Rss, Send, Sparkles, Trash2, type LucideIcon } from 'lucide-react-native';
import { memo, useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, fonts } from '../../theme';
import { Toggle } from '../../ui/v6/Settings';
import { addSource, loadSources, parseSourceLink, removeSource, updateSource } from '../api';
import type { SourceItem } from '../model';
import { sourceInfo, type SourceType } from '../rules';
import { sourceHow } from '../runStats';
import { useAdminDemo } from '../store';
import { Banner, Btn, Empty, Sheet, confirmAsk } from './kit';

const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

const ICON: Record<Exclude<SourceType, 'yandex'>, LucideIcon> = { site: Globe, telegram: Send, threads: AtSign, manual: PenLine, search: Sparkles };

/** Значок источника: Яндекс — буква «Я», остальные — линейная иконка типа. */
export function SourceMark({ type }: { type: SourceType }) {
  if (type === 'yandex') return <View style={[styles.mark, styles.markYa]}><Text style={styles.markYaText}>Я</Text></View>;
  const Icon = ICON[type];
  return <View style={styles.mark}><Icon size={18} color={colors.ink} strokeWidth={1.8} /></View>;
}

const Row = memo(function Row({ s, last, onOpen, onToggle }: { s: SourceItem; last: boolean; onOpen: (s: SourceItem) => void; onToggle: (s: SourceItem, v: boolean) => void }) {
  const info = sourceInfo(s);
  // «Telegram · @канал» → «@канал»: тип и так виден по значку и во второй строке.
  const name = (info.type === 'telegram' || info.type === 'threads') && s.title.startsWith(`${info.label} · `) ? s.title.slice(info.label.length + 3) : s.title;
  return (
    <View style={[styles.row, !last && styles.sep]}>
      <Pressable onPress={() => onOpen(s)} style={({ pressed }) => [styles.rowMain, pressed && { opacity: 0.6 }]} accessibilityRole="button" accessibilityLabel={`Источник ${s.title}: подробнее`}>
        <SourceMark type={info.type} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.title} numberOfLines={1}>{name}</Text>
          <Text style={styles.line} numberOfLines={1}>{info.label}{info.line !== name && !s.title.includes(info.line) ? ` · ${info.line}` : ''}{s.trusted ? ' · доверие' : ''}{s.enabled ? '' : ' · не читается'}</Text>
        </View>
      </Pressable>
      <Toggle on={s.enabled} onChange={(v) => onToggle(s, v)} label={`Собирать: ${s.title}`} />
    </View>
  );
});

export function Sources({ live }: { live: boolean }) {
  const qc = useQueryClient();
  const demo = useAdminDemo();
  const q = useQuery({ queryKey: ['admin', 'sources'], queryFn: loadSources, enabled: live });
  const list = live ? (q.data ?? []) : demo.sources;
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [note, setNote] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const open = list.find((s) => s.id === openId) ?? null;

  // Переключатель срабатывает сразу (FIX5): строка меняется на месте, сохранение идёт в фоне,
  // список не перезагружается после каждого нажатия (раньше всё «подливало» и прыгало). Ошибка — откатываем и говорим.
  const change = useMutation({
    mutationFn: async ({ s, patch }: { s: SourceItem; patch: Partial<SourceItem> }) => {
      if (!live) return demo.setSource(s.id, patch);
      await updateSource(s.id, { trusted: patch.trusted, enabled: patch.enabled, title: patch.title, auto_publish: patch.trusted === false ? false : undefined });
    },
    onMutate: ({ s, patch }) => {
      if (!live) return;
      qc.setQueryData<SourceItem[]>(['admin', 'sources'], (old) => old?.map((x) => (x.id === s.id ? { ...x, ...patch } : x)));
    },
    onError: (_e, { s }) => {
      if (live) qc.setQueryData<SourceItem[]>(['admin', 'sources'], (old) => old?.map((x) => (x.id === s.id ? s : x)));
      setNote({ tone: 'error', text: 'Не удалось сохранить. Проверь связь и попробуй ещё раз' });
    },
  });
  const { mutate } = change;
  const toggle = useCallback((s: SourceItem, v: boolean) => mutate({ s, patch: { enabled: v } }), [mutate]);
  const openRow = useCallback((x: SourceItem) => setOpenId(x.id), []);

  const remove = async (s: SourceItem) => {
    const ok = await confirmAsk('Удалить источник?', `«${s.title}» больше не будет читаться при поиске. Уже найденные события останутся.`, 'Удалить');
    if (!ok) return;
    try {
      if (live) await removeSource(s.id); else demo.removeSource(s.id);
      setOpenId(null);
      setNote({ tone: 'ok', text: 'Источник удалён' });
      void qc.invalidateQueries({ queryKey: ['admin', 'sources'] });
    } catch {
      setNote({ tone: 'error', text: 'Не удалось удалить. Проверь связь и попробуй ещё раз' });
    }
  };

  return (
    <View style={styles.root}>
      {live && q.isLoading ? <Empty loading title="Загружаю источники…" />
        : live && q.isError ? <Empty icon={Rss} tone="error" title="Источники не загрузились" text="Проверь связь." action={{ label: 'Повторить', onPress: () => void q.refetch() }} />
          : list.length === 0 ? <Empty icon={Rss} title="Источников пока нет" text="Добавь сайт афиши или Telegram-канал — поиск начнёт их читать." />
            : (
              <View style={styles.box}>
                {list.map((s, i) => <Row key={s.id} s={s} last={i === list.length - 1} onOpen={openRow} onToggle={toggle} />)}
              </View>
            )}
      <Text style={styles.help}>Переключатель — читать ли источник при поиске. Нажми на строку, чтобы переименовать, доверять или удалить.</Text>
      {note && <Banner tone={note.tone} text={note.text} />}
      <Pressable onPress={() => { setNote(null); setAdding(true); }} style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.8 }]} accessibilityRole="button" accessibilityLabel="Добавить источник">
        <Plus size={18} color={colors.paper} strokeWidth={1.8} />
        <Text style={styles.addText}>Добавить источник</Text>
      </Pressable>

      {open && <Details s={open} busy={false} onClose={() => setOpenId(null)}
        onChange={(patch) => change.mutate({ s: open, patch })} onRemove={() => void remove(open)} />}
      {adding && <AddSheet live={live} onClose={() => setAdding(false)} onAdded={(t) => { setAdding(false); setNote({ tone: 'ok', text: `Добавили: ${t}` }); }} />}
    </View>
  );
}

function Details({ s, busy, onClose, onChange, onRemove }: { s: SourceItem; busy: boolean; onClose: () => void; onChange: (p: Partial<SourceItem>) => void; onRemove: () => void }) {
  const info = sourceInfo(s);
  const [title, setTitle] = useState(s.title);
  const how = sourceHow(s.kind);
  const dirty = title.trim() && title.trim() !== s.title;
  return (
    <Sheet title={s.title} onClose={onClose}>
      <View style={styles.headRow}>
        <SourceMark type={info.type} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.title}>{info.label}</Text>
          <Text style={styles.line} numberOfLines={2}>{info.line}</Text>
        </View>
      </View>
      {!!(s.note || how.label) && <Text style={styles.help}>{cap([s.note, how.label].filter(Boolean).join('. '))}</Text>}
      <Text style={styles.label}>Название</Text>
      <TextInput value={title} onChangeText={setTitle} style={styles.input} accessibilityLabel="Название источника" placeholderTextColor={colors.muted3} />
      {dirty && <Btn label="Сохранить название" onPress={() => onChange({ title: title.trim() })} disabled={busy} />}
      <View style={styles.box}>
        <View style={[styles.row, styles.sep]}>
          <View style={{ flex: 1, gap: 2 }}><Text style={styles.title}>Собирать</Text><Text style={styles.line}>Читать при каждом поиске</Text></View>
          <Toggle on={s.enabled} onChange={(v) => onChange({ enabled: v })} label="Собирать" />
        </View>
        <View style={styles.row}>
          <View style={{ flex: 1, gap: 2 }}><Text style={styles.title}>Доверять</Text><Text style={styles.line}>Публиковать без проверки, если включено «Публиковать сразу»</Text></View>
          <Toggle on={s.trusted} onChange={(v) => onChange({ trusted: v })} label="Доверять" />
        </View>
      </View>
      <Pressable onPress={onRemove} style={({ pressed }) => [styles.del, pressed && { opacity: 0.7 }]} accessibilityRole="button" accessibilityLabel="Удалить источник">
        <Trash2 size={18} color={colors.accentText} strokeWidth={1.8} />
        <Text style={styles.delText}>Удалить источник</Text>
      </Pressable>
    </Sheet>
  );
}

function AddSheet({ live, onClose, onAdded }: { live: boolean; onClose: () => void; onAdded: (title: string) => void }) {
  const qc = useQueryClient();
  const demo = useAdminDemo();
  const [link, setLink] = useState('');
  const [name, setName] = useState('');
  const [nameTouched, setNameTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const parsed = link.trim() ? parseSourceLink(link) : null;
  const info = parsed ? sourceInfo({ kind: parsed.kind, title: parsed.title, handle: parsed.handle }) : null;
  const shown = nameTouched ? name : parsed?.title ?? '';

  const add = async () => {
    if (!link.trim()) return setError('Вставь ссылку на сайт или @канал');
    if (!parsed) return setError('Не похоже на ссылку. Примеры: t.me/afisha_almaty, @afisha_almaty, threads.net/@almaty.weekend, sxodim.com/almaty');
    const title = shown.trim() || parsed.title;
    setError(null); setBusy(true);
    try {
      if (live) {
        await addSource(link, title);
        void qc.invalidateQueries({ queryKey: ['admin', 'sources'] });
      } else {
        if (demo.sources.some((s) => s.title === title)) throw new Error('dup');
        demo.addSource({ id: `s-${Date.now()}`, kind: parsed.kind, handle: parsed.handle, title, note: parsed.kind === 'telegram' ? 'канал читается целиком' : null, trusted: false, autoPublish: false, enabled: true });
      }
      onAdded(title);
    } catch {
      setError('Не получилось добавить: такой источник уже есть или нет связи');
    }
    setBusy(false);
  };

  return (
    <Sheet title="Новый источник" onClose={onClose}>
      <Text style={styles.label}>Ссылка или @канал</Text>
      <TextInput value={link} onChangeText={(v) => { setLink(v); setError(null); }} onSubmitEditing={() => void add()} autoFocus autoCapitalize="none" autoCorrect={false}
        keyboardType="url" placeholder="t.me/afisha_almaty или сайт афиши" placeholderTextColor={colors.muted3} style={styles.input} accessibilityLabel="Ссылка или @канал" />
      {info ? (
        <View style={styles.chipRow}>
          <View style={styles.typeChip}><Text style={styles.typeChipText}>{info.label}</Text></View>
          <Text style={styles.line} numberOfLines={1}>{info.line}</Text>
        </View>
      ) : <Text style={styles.help}>Тип узнаем сами: Telegram, Threads, Яндекс Афиша или сайт.</Text>}
      <Text style={styles.label}>Название (можно не менять)</Text>
      <TextInput value={shown} onChangeText={(v) => { setName(v); setNameTouched(true); }} placeholder="Появится из ссылки" placeholderTextColor={colors.muted3}
        style={styles.input} accessibilityLabel="Название источника" />
      {error && <Banner tone="error" text={error} />}
      <Btn label={busy ? 'Добавляю…' : 'Добавить'} onPress={() => void add()} disabled={busy || !link.trim()} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  root: { gap: 12 },
  box: { backgroundColor: colors.card, borderRadius: 18, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 14, paddingRight: 14, minHeight: 64, paddingVertical: 8 },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 },
  sep: { borderBottomWidth: 1, borderBottomColor: colors.line },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  mark: { width: 36, height: 36, borderRadius: 11, backgroundColor: colors.sand, alignItems: 'center', justifyContent: 'center' },
  markYa: { backgroundColor: colors.ink },
  markYaText: { fontFamily: fonts.display700, fontSize: 17, color: colors.paper },
  title: { fontFamily: fonts.body700, fontSize: 15, color: colors.ink },
  line: { flexShrink: 1, fontFamily: fonts.body400, fontSize: 13, color: colors.muted },
  help: { fontFamily: fonts.body400, fontSize: 13, lineHeight: 18, color: colors.muted },
  label: { fontFamily: fonts.body600, fontSize: 13, color: colors.muted2 },
  input: { minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: colors.line2, backgroundColor: colors.card, paddingHorizontal: 14, fontFamily: fonts.body500, fontSize: 15, color: colors.ink },
  chipRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  typeChip: { backgroundColor: colors.ink, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 },
  typeChipText: { fontFamily: fonts.body700, fontSize: 12.5, color: colors.paper },
  addBtn: { minHeight: 48, borderRadius: 14, backgroundColor: colors.ink, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  addText: { fontFamily: fonts.body700, fontSize: 15, color: colors.paper },
  del: { minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: colors.line2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 4 },
  delText: { fontFamily: fonts.body700, fontSize: 15, color: colors.accentText },
});
