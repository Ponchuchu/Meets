// Realtime: новые сообщения (Postgres Changes) и геолокация друзей (Broadcast, каналы «loc:<id>»).
// В демо-режиме и без входа ничего не подписывает.
import { useQueryClient } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { useEffect } from 'react';
import { requireUser, supabase } from './client';
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

/** Точки друзей: сервер отдаёт последнюю (friend_locations), дальше — Broadcast без записи истории. */
export function useLiveFriends(friendIds: string[]) {
  const qc = useQueryClient();
  const key = friendIds.filter(isRemoteId).sort().join(',');
  useEffect(() => {
    if (!key) return;
    const channels = key.split(',').map((id) =>
      supabase()
        .channel(`loc:${id}`, { config: { private: true } })
        .on('broadcast', { event: 'pos' }, ({ payload }) => {
          const spot = mapSpot({ user_id: id, ...(payload as { lat: number; lon: number; speed: number | null; heading: number | null; updated_at: string }) });
          qc.setQueryData<FriendSpot[]>(['friendSpots'], (old = []) => [...old.filter((s) => s.personId !== id), spot]);
        })
        .subscribe(),
    );
    return () => channels.forEach((c) => void supabase().removeChannel(c));
  }, [key, qc]);
}

/** Огрубление до ~50 м — как на сервере: друзья не видят точнее. */
export const coarse = (lat: number, lon: number) => ({
  lat: Math.round(lat / 0.00045) * 0.00045,
  lon: Math.round(lon / 0.0006) * 0.0006,
});

/**
 * Моя точка: последняя — в locations_last (история не хранится), друзьям — Broadcast.
 * Сервер сам решает, видна ли точка (невидимка, «делиться до», зона дома) — см. friend_locations().
 */
export async function shareMyLocation(pos: { lat: number; lon: number; speed?: number | null; heading?: number | null }, broadcast: boolean): Promise<void> {
  const me = await requireUser();
  const at = new Date().toISOString();
  await supabase().from('locations_last').upsert({ user_id: me, geog: `SRID=4326;POINT(${pos.lon} ${pos.lat})`, speed: pos.speed ?? null, heading: pos.heading ?? null, updated_at: at });
  if (!broadcast) return;
  const ch = supabase().channel(`loc:${me}`, { config: { private: true } });
  await ch.send({ type: 'broadcast', event: 'pos', payload: { ...coarse(pos.lat, pos.lon), speed: pos.speed ?? null, heading: pos.heading ?? null, updated_at: at } });
  void supabase().removeChannel(ch);
}

/**
 * Пока открыта карта и есть вход: следим за своей точкой (если разрешение уже дано) и делимся ей.
 * Настройки значка уходят на сервер — по ним friend_locations() решает, кому видна точка.
 */
export function useShareLocation(marker: { invisible: boolean; shareUntil: string | null }) {
  const { invisible, shareUntil } = marker;
  useEffect(() => {
    let stop: (() => void) | undefined;
    let cancelled = false;
    (async () => {
      const me = await requireUser().catch(() => null);
      if (!me || cancelled) return;
      await supabase().from('marker_settings').upsert({ user_id: me, invisible, share_until: shareUntil });
      const perm = await Location.getForegroundPermissionsAsync();
      if (!perm.granted || cancelled) return;
      const sub = await Location.watchPositionAsync({ accuracy: Location.Accuracy.Balanced, distanceInterval: 50, timeInterval: 30000 }, (p) => {
        const live = !invisible && !!shareUntil && new Date(shareUntil) > new Date();
        void shareMyLocation({ lat: p.coords.latitude, lon: p.coords.longitude, speed: p.coords.speed, heading: p.coords.heading }, live).catch(() => undefined);
      });
      if (cancelled) sub.remove();
      else stop = () => sub.remove();
    })().catch(() => undefined);
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [invisible, shareUntil]);
}
