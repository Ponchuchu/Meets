// Планы с сервера (attendance): на новом телефоне и после переустановки «Иду» не теряются (ALPHA А3).
// Сервер главный для событий из базы; свои встречи (meetups) остаются как есть.
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { config } from '../lib/config';
import { usePlans } from '../state/plans';
import { data, eventsSnapshot } from '../data';
import { getMyAttendance } from './api';
import { useReminders } from './reminders';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function usePlansSync() {
  const live = config.dataMode !== 'demo';
  const q = useQuery({ queryKey: ['me', 'attendance'], queryFn: getMyAttendance, enabled: live, staleTime: 60e3 });
  useEffect(() => {
    if (!q.data) return;
    usePlans.setState((s) => {
      const going: Record<string, string> = {};
      for (const [id, at] of Object.entries(s.going)) if (!UUID.test(id)) going[id] = at;
      for (const r of q.data) if (r.status === 'going' || r.status === 'arrived') going[r.event_id] = r.at;
      const saved: Record<string, true> = {};
      for (const id of Object.keys(s.saved)) if (!UUID.test(id)) saved[id] = true;
      for (const r of q.data) if (r.status === 'saved') saved[r.event_id] = true;
      return { going, saved };
    });
  }, [q.data]);

  // Напоминания за час: только мои «Иду» из известных событий.
  const going = usePlans((s) => s.going);
  const { data: events = [] } = useQuery({ queryKey: ['events'], queryFn: () => data.getEvents(), placeholderData: eventsSnapshot });
  useReminders(events.filter((e) => going[e.id]));
}
