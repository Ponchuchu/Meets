// «Ивенты» → «Все»: все события на карте — иконка и название. Нажми, чтобы открыть: переименовать, поставить своё фото, снять с карты, удалить.
// Время, место и цена видны в карточке; чего нет — подсвечено, а фильтр «Чего-то нет» собирает такие.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { data } from '../../data';
import { supabase, withTimeout } from '../../data/client';
import type { Category } from '../../data/types';
import { eventFacts } from '../../event/facts';
import { colors, fonts } from '../../theme';
import { eventAction, renameEvent, setEventCover } from '../api';
import { sourceLabel, type SourceItem } from '../model';
import { useAdminDemo } from '../store';
import { EventRow } from './EventRow';
import { EventSheet, type AdminEvent } from './EventSheet';
import { Banner, Btn, Chip, Section } from './kit';

export type ListFilter = 'all' | 'gaps';

async function loadAll(): Promise<AdminEvent[]> {
  const since = new Date(Date.now() - 2 * 86400e3).toISOString();
  const r = await withTimeout(
    supabase().from('events').select('id,title,category,starts_at,address,price_min,price_max,is_free,cover_url,source_url,venues(name),sources(kind,handle,title)')
      .eq('visibility', 'public').eq('status', 'published').gte('starts_at', since).order('starts_at').limit(400),
  );
  if (r.error) throw r.error;
  return (r.data as unknown as { id: string; title: string; category: Category; starts_at: string; address: string | null; price_min: number | null; price_max: number | null; is_free: boolean; cover_url: string | null; source_url: string | null; venues: { name: string } | null; sources: { kind: SourceItem['kind']; handle: string; title: string } | null }[])
    .map((x) => ({ id: x.id, title: x.title, category: x.category, startsAt: x.starts_at, venue: x.venues?.name ?? null, address: x.address, priceMin: x.price_min, priceMax: x.price_max, isFree: x.is_free, cover: x.cover_url, source: x.source_url, from: x.sources ? sourceLabel(x.sources.kind, x.sources.handle, x.sources.title) : 'ДОБАВЛЕНО ВРУЧНУЮ' }));
}

const norm = (s: string) => s.toLowerCase().replace(/ё/g, 'е');
const factsOf = (r: AdminEvent) => eventFacts({ startsAt: r.startsAt, venueName: r.venue, address: r.address, priceMin: r.priceMin, priceMax: r.priceMax, isFree: r.isFree });

export function EventsList({ live, filter, onFilter }: { live: boolean; filter: ListFilter; onFilter: (f: ListFilter) => void }) {
  const qc = useQueryClient();
  const demo = useAdminDemo();
  const q = useQuery({
    queryKey: ['admin', 'events-all', live], staleTime: 30_000,
    queryFn: async (): Promise<AdminEvent[]> => live ? loadAll() : (await data.getEvents()).map((e) => ({
      id: e.id, title: e.title, category: e.category, startsAt: e.startsAt, venue: e.venueName, address: e.address, priceMin: e.priceMin, priceMax: e.priceMax, isFree: e.isFree, cover: e.cover ?? null, source: e.sourceUrl,
    })),
  });
  const [text, setText] = useState('');
  const [shown, setShown] = useState(20);
  const [openId, setOpenId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  // В демо правки живут в памяти: так видно, как всё работает, не трогая базу.
  const all = useMemo(() => (q.data ?? []).filter((r) => live || !demo.evEdits[r.id]?.gone)
    .map((r) => (live ? r : { ...r, title: demo.evEdits[r.id]?.title ?? r.title, cover: demo.evEdits[r.id]?.cover ?? r.cover })), [q.data, live, demo.evEdits]);
  const rows = useMemo(() => {
    const s = norm(text.trim());
    return all.filter((r) => {
      if (filter === 'gaps' && factsOf(r).missing === 0) return false;
      return !s || norm(`${r.title} ${r.venue ?? ''} ${r.address ?? ''}`).includes(s);
    });
  }, [all, text, filter]);
  const open = all.find((r) => r.id === openId) ?? null;

  const run = useMutation({
    mutationFn: async (job: { kind: 'rename'; title: string } | { kind: 'photo' } | { kind: 'unpublish' } | { kind: 'delete' }): Promise<string> => {
      const id = open!.id;
      if (job.kind === 'photo') {
        const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [16, 9], quality: 0.8 });
        if (res.canceled || !res.assets[0]) return '';
        if (live) await setEventCover(id, res.assets[0].uri); else demo.editEvent(id, { cover: res.assets[0].uri });
        return 'Фото поставили';
      }
      if (job.kind === 'rename') {
        if (live) await renameEvent(id, job.title); else demo.editEvent(id, { title: job.title.trim() });
        return 'Переименовали';
      }
      if (live) await eventAction(id, job.kind); else demo.editEvent(id, { gone: true });
      return job.kind === 'delete' ? 'Удалили' : 'Сняли с карты — событие в «Новые»';
    },
    onMutate: () => { setError(null); setNote(null); },
    onSuccess: (msg, job) => {
      if (!msg) return;
      setNote(msg);
      if (job.kind === 'unpublish' || job.kind === 'delete') setOpenId(null);
      void qc.invalidateQueries({ queryKey: ['admin'] });
      void qc.invalidateQueries({ queryKey: ['events'] });
    },
    onError: (e) => setError(e instanceof Error && e.message ? e.message : 'Не получилось. Проверь связь и попробуй ещё раз'),
  });

  return (
    <Section title="Все события" hint="Нажми на событие, чтобы открыть, переименовать, поставить своё фото или удалить.">
      {!!note && !open && <Banner tone="ok" text={note} />}
      <TextInput value={text} onChangeText={(v) => { setText(v); setShown(20); }} placeholder="Поиск по названию, месту, адресу" placeholderTextColor={colors.muted3}
        style={styles.search} accessibilityLabel="Поиск по событиям" returnKeyType="search" />
      <View style={styles.chips}>
        <Chip label="Все" on={filter === 'all'} onPress={() => onFilter('all')} count={all.length} />
        <Chip label="Чего-то нет" on={filter === 'gaps'} onPress={() => onFilter('gaps')} />
      </View>
      {q.isError && <Text style={styles.muted}>Не удалось загрузить события. Проверь связь.</Text>}
      {q.isLoading && <Text style={styles.muted}>Загружаю…</Text>}
      {!q.isLoading && !q.isError && rows.length === 0 && <Text style={styles.muted}>{all.length ? 'Ничего не нашлось' : 'На карте пока пусто. Найди события наверху'}</Text>}
      <View style={{ gap: 8 }}>
        {rows.slice(0, shown).map((r, i) => {
          const x = factsOf(r);
          return <EventRow key={r.id} index={i} title={r.title} sub={`${x.when} · ${x.place}`} warn={x.missing ? `Не указано: ${x.missing}` : undefined}
            cover={r.cover} category={r.category} tag={r.from} onPress={() => { setError(null); setNote(null); setOpenId(r.id); }} />;
        })}
      </View>
      {rows.length > shown && <Btn label={`Показать ещё (${rows.length - shown})`} kind="ghost" onPress={() => setShown((n) => n + 20)} />}
      {open && (
        <EventSheet key={open.id} ev={open} busy={run.isPending} error={error} note={note} onClose={() => setOpenId(null)}
          onRename={(title) => run.mutate({ kind: 'rename', title })} onPhoto={() => run.mutate({ kind: 'photo' })}
          onUnpublish={() => run.mutate({ kind: 'unpublish' })} onDelete={() => run.mutate({ kind: 'delete' })} />
      )}
    </Section>
  );
}

const styles = StyleSheet.create({
  search: { minHeight: 48, borderRadius: 24, paddingHorizontal: 18, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line2, fontFamily: fonts.body500, fontSize: 15, color: colors.ink },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  muted: { fontFamily: fonts.body400, fontSize: 14, color: colors.muted },
});
