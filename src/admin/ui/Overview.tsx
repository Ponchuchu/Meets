// «Аналитика», верх: люди и контент одним взглядом (admin_overview — только команда). Без входа — пример.
import { useQuery } from '@tanstack/react-query';
import { StyleSheet, Text, View } from 'react-native';
import { supabase, withTimeout } from '../../data/client';
import { colors, fonts } from '../../theme';
import { Banner, Section, Stat } from './kit';

export interface Overview {
  users: number; new_24h: number; new_7d: number; online_24h: number; sharing_now: number; friendships: number; chats: number;
  messages_24h: number; going: number; meetups: number; events_published: number; events_upcoming: number; events_draft: number; drafts_stale: number;
  events_no_price: number; events_no_place: number; events_no_cover: number; runs_failed_24h: number;
  last_run: { status: string; found: number; queued: number; at: string; error: string | null } | null;
  top_cats: { category: string; n: number }[];
}
export const SAMPLE: Overview = {
  users: 2, new_24h: 0, new_7d: 2, online_24h: 2, sharing_now: 1, friendships: 1, chats: 2, messages_24h: 14, going: 3, meetups: 1,
  events_published: 48, events_upcoming: 31, events_draft: 4, drafts_stale: 1, events_no_price: 6, events_no_place: 2, events_no_cover: 9, runs_failed_24h: 0,
  last_run: { status: 'done', found: 28, queued: 28, at: new Date().toISOString(), error: null },
  top_cats: [{ category: 'music', n: 12 }, { category: 'standup', n: 8 }],
};
const CAT: Record<string, string> = { music: 'Музыка', concert: 'Концерты', standup: 'Стендап', art: 'Выставки', theatre: 'Театр', sport: 'Спорт', food: 'Еда', party: 'Вечеринки', talks: 'Лекции', lecture: 'Лекции', meetup: 'Встречи', hike: 'Горы', games: 'Настолки', bike: 'Вело' };

/** Сводка из базы (только команда). Без входа сотрудника — пример. Обновляется раз в минуту. */
export function useOverview(live: boolean) {
  const q = useQuery({
    queryKey: ['admin', 'overview'], enabled: live, refetchInterval: 60_000,
    queryFn: async () => {
      const r = await withTimeout(supabase().rpc('admin_overview'));
      if (r.error) throw r.error;
      return r.data as Overview;
    },
  });
  return { data: live ? q.data : SAMPLE, isError: live && q.isError, isLoading: live && q.isPending, refetch: q.refetch };
}

export function OverviewBlock({ live }: { live: boolean }) {
  const q = useOverview(live);
  const o = q.data;
  return (
    <Section title="Люди" hint={live ? 'Обновляется раз в минуту' : 'Пример: настоящие цифры видны после входа сотрудника'}>
      {q.isError && <Banner tone="error" text="Сводка не загрузилась. Нужна миграция 21 (admin_overview) — Actions → Supabase backend." />}
      {!o && !q.isError && <Text style={styles.muted}>Загружаю…</Text>}
      {o && (
        <>
          <View style={styles.grid}>
            <Stat n={o.users} label="всего людей" />
            <Stat n={o.new_24h} label="новых за сутки" />
            <Stat n={o.new_7d} label="новых за неделю" />
            <Stat n={o.online_24h} label="заходили за сутки" />
            <Stat n={o.sharing_now} label="на карте сейчас" />
            <Stat n={o.friendships} label="дружб" />
            <Stat n={o.chats} label="чатов" />
            <Stat n={o.messages_24h} label="сообщений за сутки" />
            <Stat n={o.going} label="планов «иду»" />
          </View>
          <Text style={styles.sub}>События</Text>
          <View style={styles.grid}>
            <Stat n={o.events_published} label="на карте" />
            <Stat n={o.events_draft} label="ждут согласования" />
            <Stat n={o.meetups} label="встреч друзей" />
          </View>
          {o.top_cats.length > 0 && <Text style={styles.muted}>Больше всего: {o.top_cats.map((c) => `${CAT[c.category] ?? c.category} ${c.n}`).join(' · ')}</Text>}
        </>
      )}
    </Section>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  sub: { fontFamily: fonts.body700, fontSize: 15, color: colors.ink, marginTop: 4 },
  muted: { fontFamily: fonts.body400, fontSize: 13.5, color: colors.muted },
});
