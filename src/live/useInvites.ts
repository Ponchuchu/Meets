// Приглашения вживую: таблица invites через Realtime (RLS — только свои), бейдж «Планов» = зовут и ждут ответа.
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '../data/client';
import { config } from '../lib/config';
import { useTabBadges } from '../state/tabBadges';
import { getInvites } from './api';
import { myId } from './auth';

export function useInvites() {
  const live = config.dataMode !== 'demo';
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['invites'], queryFn: getInvites, enabled: live, staleTime: 30e3 });
  useEffect(() => {
    if (!live) return;
    const ch = supabase().channel(`invites:${myId() ?? ''}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invites' }, () => void qc.invalidateQueries({ queryKey: ['invites'] }))
      .subscribe();
    return () => { void supabase().removeChannel(ch); };
  }, [live, qc]);
  const me = myId();
  const waiting = (q.data ?? []).filter((i) => i.to_id === me && !i.answer).length;
  useEffect(() => { useTabBadges.getState().set({ plans: waiting }); }, [waiting]);
  return q;
}
