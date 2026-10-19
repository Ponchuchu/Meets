// Realtime: новые сообщения (Postgres Changes) и геолокация друзей (Broadcast, каналы «locations:<id>»).
// Свою точку шлёт src/live/location.ts.
// В демо-режиме и без входа ничего не подписывает.
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { resolveMessages, type MessageRow } from './remote';
import { requireUser, supabase } from './client';
import { isJump, type Pt } from '../live/geo';
import { config } from '../lib/config';
import { useAuth } from '../live/auth';
import { AppState } from 'react-native';
import { mapSpot } from './remote';
import type { Message, FriendSpot } from './types';

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** id из базы (uuid), а не из демо-данных. */
export const isRemoteId = (id: string | undefined) => !!id && UUID.test(id);

/** Держит открытый чат свежим: новое сообщение в базе → перечитать сообщения и список чатов. */
export function useLiveChat(chatId: string, focused = true) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!focused || !isRemoteId(chatId)) return;
    let alive = true;
    let refresh: ReturnType<typeof setTimeout> | undefined;
    const ch = supabase()
      .channel(`chat:${chatId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}` }, async payload => {
        try {
          const user = await requireUser();
          const rows = await resolveMessages([payload.new as MessageRow], user);
          if (!alive) return;
          if (qc.getQueryData(['messages', chatId])) {
            await qc.cancelQueries({ queryKey: ['messages', chatId], exact: true });
            qc.setQueryData<Message[]>(['messages', chatId], (old = []) => [...old.filter(m => m.id !== rows[0].id), ...rows].sort((a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? '')));
          } else void qc.invalidateQueries({ queryKey: ['messages', chatId] });
        } catch { if (alive) void qc.invalidateQueries({ queryKey: ['messages', chatId] }); }
        if (!alive) return;
        clearTimeout(refresh);
        refresh = setTimeout(() => void qc.invalidateQueries({ queryKey: ['chats'] }), 350);
      })
      .subscribe(status => { if (status === 'SUBSCRIBED' && alive) { void qc.invalidateQueries({ queryKey: ['messages', chatId] }); void qc.invalidateQueries({ queryKey: ['chats'] }); } });
    return () => { alive = false; clearTimeout(refresh); void supabase().removeChannel(ch); };
  }, [chatId, qc, focused]);
}

/** Точки друзей: сервер отдаёт последнюю (friend_locations), дальше — Broadcast «locations:<друг>» (V6 §3.2).
 *  Скачки GPS отбрасываем, точку без координат («только район») не рисуем. */
export function useLiveFriends(friendIds: string[]) {
  const qc = useQueryClient();
  const key = friendIds.filter(isRemoteId).sort().join(',');
  useEffect(() => {
    if (!key) return;
    const prev = new Map<string, Pt>();
    const channels = key.split(',').map((id) =>
      supabase()
        .channel(`locations:${id}`, { config: { private: true } })
        .on('broadcast', { event: 'pos' }, ({ payload }) => {
          const p = payload as { lat?: number; lon?: number; speed: number | null; heading: number | null; accuracy?: number | null; status?: string | null; updated_at: string };
          if (p.lat == null || p.lon == null || !Number.isFinite(p.lat) || !Number.isFinite(p.lon) || Math.abs(p.lat) > 90 || Math.abs(p.lon) > 180 || !Number.isFinite(Date.parse(p.updated_at))) return;
          const pt: Pt = { lat: p.lat, lon: p.lon, at: Date.parse(p.updated_at), accuracy: p.accuracy };
          if (isJump(prev.get(id) ?? null, pt)) return;
          prev.set(id, pt);
          const spot = mapSpot({ user_id: id, lat: p.lat, lon: p.lon, speed: p.speed, heading: p.heading, updated_at: p.updated_at, status: p.status });
          qc.setQueryData<FriendSpot[]>(['friendSpots'], (old = []) => [...old.filter((s) => s.personId !== id), spot]);
        })
        .subscribe(),
    );
    // Подписи «2 мин» стареют сами — раз в минуту перечитываем с сервера.
    const t = setInterval(() => void qc.invalidateQueries({ queryKey: ['friendSpots'] }), 60000);
    return () => { clearInterval(t); channels.forEach((c) => void supabase().removeChannel(c)); };
  }, [key, qc]);
}

/** Огрубление до ~50 м (PRODUCT.md «Кто что видит»): друзья не видят точнее. Сервер огрубляет так же. */
export const coarse = (lat: number, lon: number) => ({
  lat: Math.round(lat / 0.00045) * 0.00045,
  lon: Math.round(lon / 0.0006) * 0.0006,
});

/** Список чатов обновляется и тогда, когда открыт другой экран. */
export function useLiveChats() {
  const qc = useQueryClient();
  const userId = useAuth(s => s.session?.user.id);
  useEffect(() => {
    if (!userId || config.dataMode === 'demo') return;
    const refresh = () => { for (const key of ['chats', 'people', 'friendRequests']) void qc.invalidateQueries({ queryKey: [key] }); };
    const channel = supabase().channel(`inbox:${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => void qc.invalidateQueries({ queryKey: ['chats'] }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friend_requests' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_members' }, refresh)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, () => void qc.invalidateQueries({ queryKey: ['people'] }))
      .subscribe(status => { if (status === 'SUBSCRIBED') refresh(); });
    const app = AppState.addEventListener('change', s => { if (s === 'active') { refresh(); void qc.invalidateQueries({ queryKey: ['friendSpots'] }); } });
    const timer = setInterval(() => { if (AppState.currentState === 'active') refresh(); }, 60000);
    return () => { clearInterval(timer); app.remove(); void supabase().removeChannel(channel); };
  }, [userId, qc]);
}
