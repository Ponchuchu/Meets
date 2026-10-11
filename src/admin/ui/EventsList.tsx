// «Ивенты» → «На карте»: опубликованные события с поиском. Время, место и цена видны в каждой карточке; чего нет — подсвечено.
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Image, StyleSheet, Text, TextInput, View } from 'react-native';
import { data } from '../../data';
import { supabase, withTimeout } from '../../data/client';
import { photo } from '../../data/photos';
import { eventFacts } from '../../event/facts';
import { colors, fonts } from '../../theme';
import { Btn, Card, Chip, Section } from './kit';

interface Row {
  id: string; title: string; status: string; startsAt: string | null; venue: string | null; address: string | null;
  priceMin: number | null; priceMax: number | null; isFree: boolean; cover: string | null; source: string | null;
}
export type ListFilter = 'all' | 'gaps';
const STATUS: Record<string, string> = { published: 'на карте', draft: 'ждёт', cancelled: 'отменено', archived: 'архив' };

async function loadAll(): Promise<Row[]> {
  const since = new Date(Date.now() - 2 * 86400e3).toISOString();
  const r = await withTimeout(
    supabase().from('events').select('id,title,status,starts_at,address,price_min,price_max,is_free,cover_url,source_url,venues(name)')
      .eq('visibility', 'public').eq('status', 'published').gte('starts_at', since).order('starts_at').limit(400),
  );
  if (r.error) throw r.error;
  return (r.data as unknown as { id: string; title: string; status: string; starts_at: string; address: string | null; price_min: number | null; price_max: number | null; is_free: boolean; cover_url: string | null; source_url: string | null; venues: { name: string } | null }[])
    .map((x) => ({ id: x.id, title: x.title, status: x.status, startsAt: x.starts_at, venue: x.venues?.name ?? null, address: x.address, priceMin: x.price_min, priceMax: x.price_max, isFree: x.is_free, cover: x.cover_url, source: x.source_url }));
}

export function EventsList({ live, filter, onFilter }: { live: boolean; filter: ListFilter; onFilter: (f: ListFilter) => void }) {
  const q = useQuery({
    queryKey: ['admin', 'events-all', live], staleTime: 30_000,
    queryFn: async (): Promise<Row[]> => live ? loadAll() : (await data.getEvents()).map((e) => ({
      id: e.id, title: e.title, status: 'published', startsAt: e.startsAt, venue: e.venueName, address: e.address, priceMin: e.priceMin, priceMax: e.priceMax, isFree: e.isFree, cover: e.cover ?? null, source: e.sourceUrl,
    })),
  });
  const [text, setText] = useState('');
  const f = filter;
  const [shown, setShown] = useState(20);
  const rows = useMemo(() => {
    const s = text.trim().toLowerCase().replace(/ё/g, 'е');
    return (q.data ?? []).filter((r) => {
      const facts = eventFacts({ startsAt: r.startsAt, venueName: r.venue, address: r.address, priceMin: r.priceMin, priceMax: r.priceMax, isFree: r.isFree });
      if (f === 'gaps' && facts.missing === 0) return false;
      return !s || `${r.title} ${r.venue ?? ''} ${r.address ?? ''}`.toLowerCase().replace(/ё/g, 'е').includes(s);
    });
  }, [q.data, text, f]);

  return (
    <Section title="На карте" hint="Время, место и цена — в каждой карточке. Чего не нашли, подсвечено.">
      <TextInput value={text} onChangeText={(v) => { setText(v); setShown(20); }} placeholder="Поиск по названию, месту, адресу" placeholderTextColor={colors.muted3}
        style={styles.search} accessibilityLabel="Поиск по событиям" returnKeyType="search" />
      <View style={styles.chips}>
        <Chip label="Все" on={f === 'all'} onPress={() => onFilter('all')} count={q.data?.length} />
        <Chip label="Чего-то нет" on={f === 'gaps'} onPress={() => onFilter('gaps')} />
      </View>
      {q.isError && <Text style={styles.muted}>Не удалось загрузить события. Проверь связь.</Text>}
      {q.isLoading && <Text style={styles.muted}>Загружаю…</Text>}
      {!q.isLoading && !q.isError && rows.length === 0 && <Text style={styles.muted}>Ничего не нашлось</Text>}
      {rows.slice(0, shown).map((r) => {
        const x = eventFacts({ startsAt: r.startsAt, venueName: r.venue, address: r.address, priceMin: r.priceMin, priceMax: r.priceMax, isFree: r.isFree });
        const img = r.cover ? (/^https?:/.test(r.cover) ? { uri: r.cover } : photo(r.cover)) : null;
        return (
          <Card key={r.id} style={{ gap: 8 }}>
            <View style={styles.top}>
              {img ? <Image source={img} style={styles.cover} /> : <View style={[styles.cover, { backgroundColor: colors.sand }]} />}
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={styles.status}>{(STATUS[r.status] ?? r.status).toUpperCase()}</Text>
                <Text style={styles.title} numberOfLines={2}>{r.title}</Text>
              </View>
            </View>
            <Fact k="Когда" v={x.when} bad={x.whenMissing || x.when.includes('время не указано')} />
            <Fact k="Где" v={x.place} bad={x.placeMissing} />
            <Fact k="Цена" v={x.price} bad={x.priceMissing} />
          </Card>
        );
      })}
      {rows.length > shown && <Btn label={`Показать ещё (${rows.length - shown})`} kind="ghost" onPress={() => setShown((n) => n + 20)} />}
    </Section>
  );
}

function Fact({ k, v, bad }: { k: string; v: string; bad?: boolean }) {
  return (
    <View style={styles.fact}>
      <Text style={styles.k}>{k}</Text>
      <Text style={[styles.v, bad && styles.bad]} numberOfLines={2}>{v}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  search: { minHeight: 48, borderRadius: 24, paddingHorizontal: 18, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line2, fontFamily: fonts.body500, fontSize: 15, color: colors.ink },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  muted: { fontFamily: fonts.body400, fontSize: 14, color: colors.muted },
  top: { flexDirection: 'row', gap: 12 },
  cover: { width: 64, height: 64, borderRadius: 14 },
  status: { fontFamily: fonts.mono600, fontSize: 10.5, color: colors.muted3, letterSpacing: 0.6 },
  title: { fontFamily: fonts.display700, fontSize: 17, color: colors.ink, lineHeight: 22 },
  fact: { flexDirection: 'row', gap: 10 },
  k: { width: 50, fontFamily: fonts.mono500, fontSize: 11, color: colors.muted3, textTransform: 'uppercase', paddingTop: 2 },
  v: { flex: 1, fontFamily: fonts.body600, fontSize: 14, color: colors.ink },
  bad: { color: colors.accentText },
});
