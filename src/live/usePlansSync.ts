// Планы с сервера (attendance): на новом телефоне и после переустановки «Иду» не теряются (ALPHA А3).
// Сервер главный для событий из базы; свои встречи (meetups) остаются как есть.
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { config } from '../lib/config';
import { usePlans } from '../state/plans';
import { data, eventsSnapshot } from '../data';
import { mergeServerPlans } from '../state/plansMerge';
import { getMyAttendance } from './api';
import { useAuth } from './auth';
import { useReminders } from './reminders';

export function usePlansSync() {
  const live = config.dataMode !== 'demo';
  const uid = useAuth((s) => s.session?.user.id ?? null);
  // Ключ кэша — с id человека: другой аккаунт на этом же телефоне не увидит чужие «Иду».
  const q = useQuery({ queryKey: ['me', 'attendance', uid], queryFn: getMyAttendance, enabled: live && !!uid, staleTime: 60e3 });
  useEffect(() => {
    if (!q.data || !uid) return;
    usePlans.setState((s) => {
      const next = mergeServerPlans({ owner: s.owner, going: s.going, saved: s.saved, meetupIds: s.meetups.map((m) => m.id) }, q.data, uid);
      return s.owner === uid ? next : { ...next, company: {}, invites: [], meetups: [], declined: {} };
    });
  }, [q.data, uid]);

  // Напоминания за час: только мои «Иду» из известных событий.
  const going = usePlans((s) => s.going);
  const { data: events = [] } = useQuery({ queryKey: ['events'], queryFn: () => data.getEvents(), placeholderData: eventsSnapshot });
  useReminders(events.filter((e) => going[e.id]));
}
