// Планы с сервера (attendance): на новом телефоне и после переустановки «Иду» не теряются (ALPHA А3).
// Сервер главный для событий из базы; свои встречи (meetups) остаются как есть.
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { config } from '../lib/config';
import { usePlans } from '../state/plans';
import { data, eventsSnapshot } from '../data';
import { mergeServerPlans } from '../state/plansMerge';
import {getSettings, getMyAttendance } from './api';
import { useAuth } from './auth';
import { useReminders } from './reminders';

export function usePlansSync() {
  const live = config.dataMode !== 'demo';
  const uid = useAuth((s) => s.session?.user.id ?? null);
  // Ключ кэша — с id человека: другой аккаунт на этом же телефоне не увидит чужие «Иду».
  const settings=useQuery({queryKey:['me','settings',uid],queryFn:getSettings,enabled:live&&!!uid});
  useEffect(()=>{if(uid&&usePlans.getState().owner===uid&&Array.isArray(settings.data?.muted_events))usePlans.setState({muted:Object.fromEntries(settings.data.muted_events.filter((id):id is string=>typeof id==='string').map(id=>[id,true as const]))});},[settings.data,uid]);
  const q = useQuery({ queryKey: ['me', 'attendance', uid], queryFn: getMyAttendance, enabled: live && !!uid, staleTime: 60e3 });
  useEffect(() => {
    if (!q.data || !uid) return;
    const remoteMuted=Array.isArray(settings.data?.muted_events)?settings.data.muted_events:[];
    usePlans.setState((s) => {
      const next = mergeServerPlans({ owner: s.owner, going: s.going, saved: s.saved, meetupIds: s.meetups.map((m) => m.id) }, q.data, uid);
      return s.owner === uid ? next : { ...next, muted: Object.fromEntries(remoteMuted.filter((id:unknown):id is string=>typeof id==='string').map((id:string)=>[id,true as const])), company: {}, invites: [], meetups: [], declined: {} };
    });
  }, [q.data, uid, settings.data]);

  // Напоминания за час: только мои «Иду» из известных событий.
  const going = usePlans((s) => s.going);
  const muted = usePlans((s) => s.muted);
  const meetups = usePlans((s) => s.meetups);
  const { data: events = [] } = useQuery({ queryKey: ['events'], queryFn: () => data.getEvents(), placeholderData: eventsSnapshot });
  useReminders([...events, ...meetups].filter((e, i, all) => going[e.id] && !muted[e.id] && all.findIndex((a) => a.id === e.id) === i));
}
