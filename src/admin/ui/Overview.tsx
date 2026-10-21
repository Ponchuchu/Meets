// «Аналитика», верх: люди и контент одним взглядом (admin_overview — только команда). Без входа — пример.
import { useQuery } from '@tanstack/react-query';
import { Hash } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import { supabase, withTimeout } from '../../data/client';
import { colors, fonts } from '../../theme';
import { Banner, Kpi, Section, Stat } from './kit';

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

/** Дашборд: четыре главные цифры сразу, остальное — в «Все цифры» (FIX3: двенадцать одинаковых плиток читались плохо). */
export function OverviewBlock({ live }: { live: boolean }) {
  const q = useOverview(live);
  const o = q.data;
  return (
    <Section title="Сегодня" hint={live ? 'Из базы, обновляется раз в минуту' : 'Пример: настоящие цифры видны после входа сотрудника'}>
      {q.isError && <Banner tone="error" text="Сводка не загрузилась. Потяни экран вниз, чтобы повторить." />}
      {!o && !q.isError && <Text style={styles.muted}>Загружаю…</Text>}
      {o && (
        <>
          <View style={styles.grid}>
            <Kpi accent n={o.users} label="людей в Meets" sub={`+${o.new_7d} за неделю`} />
            <Kpi n={o.sharing_now} label="на карте сейчас" sub={`заходили за сутки: ${o.online_24h}`} />
            <Kpi n={o.messages_24h} label="сообщений за сутки" sub={`чатов: ${o.chats}`} />
            <Kpi n={o.events_upcoming} label="событий впереди" sub={`ждут проверки: ${o.events_draft}`} />
          </View>
          <Section title="Все цифры" icon={Hash} fold="closed">
            <View style={styles.grid}>
              <Stat n={o.new_24h} label="новых за сутки" />
              <Stat n={o.friendships} label="дружб" />
              <Stat n={o.going} label="планов «иду»" />
              <Stat n={o.events_published} label="опубликовано всего" />
              <Stat n={o.meetups} label="встреч друзей" />
              <Stat n={o.runs_failed_24h} label="сбоев поиска за сутки" warn={o.runs_failed_24h > 0} />
            </View>
            {o.top_cats.length > 0 && <Text style={styles.muted}>Больше всего: {o.top_cats.map((c) => `${CAT[c.category] ?? c.category} ${c.n}`).join(' · ')}</Text>}
          </Section>
        </>
      )}
    </Section>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  muted: { fontFamily: fonts.body400, fontSize: 13.5, color: colors.muted },
});
