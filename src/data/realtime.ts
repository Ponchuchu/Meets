// Realtime: новые сообщения (Postgres Changes) и геолокация друзей (Broadcast, каналы «locations:<id>»).
// Свою точку шлёт src/live/location.ts.
// В демо-режиме и без входа ничего не подписывает.
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { resolveMessages, type MessageRow } from './remote';
import { requireUser, supabase, uniqTopic } from './client';
import { isJump, type Pt } from '../live/geo';
import { config } from '../lib/config';
import { useAuth } from '../live/auth';
import { AppState } from 'react-native';
import { isEco } from '../state/perf';
import { mapSpot, touchPresence } from './remote';
import type { Message, FriendSpot } from './types';

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** id из базы (uuid), а не из демо-данных. */
export const isRemoteId = (id: string | undefined) => !!id && UUID.test(id);

/** Держит открытый чат свежим: новое сообщение в базе → сразу в ленту, список чатов — следом.
 *  Android закрывает сокет в фоне, поэтому при возвращении в приложение и при обрыве канала переподписываемся
 *  и дочитываем пропущенное; пока канал не подключён, раз в 8 с проверяем новые сообщения запросом. */
export function useLiveChat(chatId: string, focused = true) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!focused || !isRemoteId(chatId)) return;
    let alive = true;
    let joined = false;
    let refresh: ReturnType<typeof setTimeout> | undefined;
    let ch: ReturnType<ReturnType<typeof supabase>['channel']> | null = null;
    const catchUp = () => { void qc.invalidateQueries({ queryKey: ['messages', chatId] }); void qc.invalidateQueries({ queryKey: ['chats'] }); };
    const connect = () => {
      if (ch) void supabase().removeChannel(ch);
      joined = false;
      ch = supabase()
        .channel(uniqTopic(`chat:${chatId}`))
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
        // Собеседник исправил сообщение — меняем текст на месте, без перезагрузки ленты.
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}` }, payload => {
          const r = payload.new as MessageRow;
          if (!alive || !r?.id) return;
          qc.setQueryData<Message[]>(['messages', chatId], old => old?.map(m => m.id === r.id ? { ...m, text: r.body ?? m.text, editedAt: r.edited_at ?? m.editedAt } : m));
        })
        // Собеседник прочитал — две галочки без перезагрузки.
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chat_members', filter: `chat_id=eq.${chatId}` }, () => {
          if (alive) void qc.invalidateQueries({ queryKey: ['chats'] });
        })
        .subscribe(status => {
          if (!alive) return;
          if (status === 'SUBSCRIBED') { joined = true; catchUp(); }
          else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') joined = false;
        });
    };
    connect();
    const app = AppState.addEventListener('change', s => { if (s === 'active' && alive) { connect(); catchUp(); } });
    // Страховка: канал не подключён (плохая сеть, фон) — проверяем сами; подключён — изредка сверяемся.
    let ticks = 0;
    const poll = setInterval(() => {
      if (!alive || AppState.currentState !== 'active') return;
      ticks++;
      if (!joined) { void qc.invalidateQueries({ queryKey: ['messages', chatId] }); if (ticks % 4 === 0) connect(); }
      else if (ticks % 6 === 0) void qc.invalidateQueries({ queryKey: ['messages', chatId] });
    }, 8000);
    return () => { alive = false; clearTimeout(refresh); clearInterval(poll); app.remove(); if (ch) void supabase().removeChannel(ch); };
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
    // Точки друзей копим и применяем пачкой раз в секунду (в экономии — раз в 3 с): каждая точка отдельно
    // перерисовывала карту и всё, что подписано на точки друзей.
    const pending = new Map<string, FriendSpot>();
    let flushTimer: ReturnType<typeof setTimeout> | undefined;
    const flush = () => {
      flushTimer = undefined;
      if (!pending.size) return;
      const fresh = [...pending.values()];
      pending.clear();
      qc.setQueryData<FriendSpot[]>(['friendSpots'], (old = []) => [...old.filter((s) => !fresh.some((f) => f.personId === s.personId)), ...fresh]);
    };
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
          pending.set(id, spot);
          flushTimer ??= setTimeout(flush, isEco() ? 3000 : 1000);
        })
        .subscribe(),
    );
    // Подписи «2 мин» стареют сами — раз в минуту перечитываем с сервера.
    // Приложение свёрнуто (процесс жив из-за фоновой геолокации) — не ходим в сеть зря.
    const t = setInterval(() => { if (AppState.currentState === 'active') void qc.invalidateQueries({ queryKey: ['friendSpots'] }); }, 60000);
    return () => { clearInterval(t); clearTimeout(flushTimer); channels.forEach((c) => void supabase().removeChannel(c)); };
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
    let channel: ReturnType<ReturnType<typeof supabase>['channel']> | null = null;
    let chatsTimer: ReturnType<typeof setTimeout> | undefined;
    // Пачка сообщений подряд — один запрос списка, а не десять.
    const chatsSoon = () => { clearTimeout(chatsTimer); chatsTimer = setTimeout(() => void qc.invalidateQueries({ queryKey: ['chats'] }), 400); };
    const connect = () => {
      if (channel) void supabase().removeChannel(channel);
      channel = supabase().channel(uniqTopic(`inbox:${userId}`))
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, chatsSoon)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships' }, refresh)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'friend_requests' }, refresh)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_members' }, chatsSoon)
        .subscribe(status => { if (status === 'SUBSCRIBED') refresh(); });
    };
    connect();
    // Сокет в фоне закрывается — при возвращении подключаемся заново и дочитываем пропущенное.
    const app = AppState.addEventListener('change', s => { if (s === 'active') { connect(); refresh(); void qc.invalidateQueries({ queryKey: ['friendSpots'] }); } });
    // «В сети» для друзей: отметка при открытии и раз в минуту, пока приложение на экране.
    const seen = () => { if (AppState.currentState === 'active') void touchPresence().catch(() => undefined); };
    seen();
    let beat = 0;
    const timer = setInterval(() => { if (AppState.currentState !== 'active') return; void qc.invalidateQueries({ queryKey: ['chats'] }); if (++beat % 2 === 0) seen(); }, 30000);
    const appSeen = AppState.addEventListener('change', s => { if (s === 'active') seen(); });
    return () => { clearInterval(timer); clearTimeout(chatsTimer); app.remove(); appSeen.remove(); if (channel) void supabase().removeChannel(channel); };
  }, [userId, qc]);
}
