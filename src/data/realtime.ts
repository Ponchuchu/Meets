// Realtime: новые сообщения (Postgres Changes) и геолокация друзей (Broadcast, каналы «locations:<id>»).
// Свою точку шлёт src/live/location.ts.
// В демо-режиме и без входа ничего не подписывает.
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from './client';
import { isJump, type Pt } from '../live/geo';
import { mapSpot } from './remote';
import type { FriendSpot } from './types';

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** id из базы (uuid), а не из демо-данных. */
export const isRemoteId = (id: string | undefined) => !!id && UUID.test(id);

/** Держит открытый чат свежим: новое сообщение в базе → перечитать сообщения и список чатов. */
export function useLiveChat(chatId: string) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!isRemoteId(chatId)) return;
    const ch = supabase()
      .channel(`chat:${chatId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}` }, () => {
        void qc.invalidateQueries({ queryKey: ['messages', chatId] });
        void qc.invalidateQueries({ queryKey: ['chats'] });
      })
      .subscribe();
    return () => {
      void supabase().removeChannel(ch);
    };
  }, [chatId, qc]);
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
          if (p.lat == null || p.lon == null) return;
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
