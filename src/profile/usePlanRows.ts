// Планы для профиля и календаря: иду, зовут, сохранено — одинаковые строки в обоих местах.
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { data, eventsSnapshot, type EventItem } from '../data';
import { useApp } from '../state/app';
import { usePlans } from '../state/plans';
import { colors } from '../theme';
import { withFriends, type PlanRow } from './ui/Plans';

/** «от Дениса», «от Игоря», «от Айнуры». */
function genitive(name: string): string {
  if (/ь$/.test(name)) return name.slice(0, -1) + 'я';
  if (/[ая]$/.test(name)) return name.slice(0, -1) + (/[гкхжшщч]а$/.test(name) ? 'и' : 'ы');
  if (/й$/.test(name)) return name.slice(0, -1) + 'я';
  return name + 'а';
}

export function usePlanRows(now: Date) {
  const { data: events = [] } = useQuery({ queryKey: ['events'], queryFn: () => data.getEvents(), placeholderData: eventsSnapshot });
  const { data: people = [] } = useQuery({ queryKey: ['people'], queryFn: () => data.getPeople() });
  const { data: me } = useQuery({ queryKey: ['myProfile'], queryFn: () => data.getMyProfile() });
  const { going, saved, meetups, declined, go, decline } = usePlans();
  const addPlan = useApp((s) => s.addPlan);

  const all = useMemo(() => [...meetups, ...events], [meetups, events]);
  const byId = (id: string) => all.find((e) => e.id === id);
  const upcoming = (e: EventItem | undefined): e is EventItem => !!e && new Date(e.endsAt ?? e.startsAt).getTime() + 7200e3 > now.getTime();

  const goingRows: PlanRow[] = Object.entries(going)
    .map(([id, at]) => ({ e: byId(id), at }))
    .filter((x): x is { e: EventItem; at: string } => upcoming(x.e))
    .sort((a, b) => a.e.startsAt.localeCompare(b.e.startsAt))
    .map(({ e, at }) => ({
      e,
      sub: e.meetup ? `${e.meetup.invited.length} из ${e.meetup.invited.length} приняли` : withFriends(e, people),
      faces: e.friendsGoing.map((id) => people.find((p) => p.id === id)).filter((p): p is NonNullable<typeof p> => !!p),
      tag: e.meetup ? { text: 'ОРГАНИЗУЮ', bg: colors.accent, fg: colors.ink }
        : now.getTime() - new Date(at).getTime() < 3 * 3600e3 ? { text: 'НОВОЕ', bg: colors.ink, fg: colors.paper } : undefined,
    }));
  const inviteRows: PlanRow[] = (me?.invitesToMe ?? [])
    .filter((i) => !going[i.eventId] && !declined[i.eventId])
    .map((i) => ({ i, e: byId(i.eventId), from: people.find((p) => p.id === i.fromId) }))
    .filter((x) => upcoming(x.e))
    .map(({ i, e, from }) => ({
      e: e!,
      sub: `${from?.name ?? 'Друг'} зовёт`,
      faces: from ? [from] : [],
      tag: { text: `ОТ ${genitive(from?.name ?? '').toUpperCase()}`, bg: colors.friend, fg: '#FFFFFF' },
      invite: { fromName: from?.name ?? '', onYes: () => { go(i.eventId); addPlan(); }, onNo: () => decline(i.eventId) },
    }));
  const savedRows: PlanRow[] = Object.keys(saved).map(byId).filter(upcoming).map((e) => ({ e, sub: `${e.isFree ? 'бесплатно' : `от ${(e.priceMin ?? 0).toLocaleString('ru-RU')} ₸`} · решишь позже` }));

  return { events, people, me, all, byId, goingRows, inviteRows, savedRows };
}
