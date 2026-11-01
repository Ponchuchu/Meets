import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { supabase } from '../data/client';
import { isRemoteId } from '../data/realtime';
import { STICKERS } from './catalog';

export const stickerTopic = (sender: string, recipient: string) => `map-sticker:${sender}:${recipient}`;

/** HTTP Broadcast не открывает чат и не создаёт сообщения. */
export async function sendMapSticker(sender: string, recipient: string, sticker: string, count: number) {
  if (!isRemoteId(sender) || !isRemoteId(recipient) || sender === recipient || !STICKERS.some(s => s.id === sticker) || !Number.isInteger(count) || count < 1 || count > 100) throw new Error('Invalid map sticker');
  const sb = supabase();
  const ch = sb.channel(stickerTopic(sender, recipient), { config: { private: true } });
  try {
    await sb.realtime.setAuth();
    const response = await ch.httpSend('sticker', { sticker, count });
    if (!response.success) throw new Error('Map sticker delivery failed');
  } finally { void sb.removeChannel(ch); }
}

/** Только открытая карта принимает события; RLS проверяет пару друзей. */
export function useMapStickerReceiver(me: string | undefined, friendIds: string[], enabled: boolean, receive: (from: string, sticker: string, count: number) => void) {
  const callback = useRef(receive);
  const [active, setActive] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => setActive(state === 'active'));
    return () => sub.remove();
  }, []);
  useEffect(() => { callback.current = receive; }, [receive]);
  const key = [...new Set(friendIds.filter(isRemoteId))].sort().join(',');
  useEffect(() => {
    if (!enabled || !active || !me || !isRemoteId(me) || !key) return;
    const sb = supabase();
    const channels = key.split(',').filter(id => id !== me).map(id => sb.channel(stickerTopic(id, me), { config: { private: true } })
      .on('broadcast', { event: 'sticker' }, ({ payload }) => {
        const item = payload as { sticker?: unknown; count?: unknown };
        if (typeof item.sticker !== 'string' || !STICKERS.some(s => s.id === item.sticker) || !Number.isInteger(item.count) || (item.count as number) < 1 || (item.count as number) > 100) return;
        callback.current(id, item.sticker, item.count as number);
      }).subscribe());
    return () => { channels.forEach(ch => void sb.removeChannel(ch)); };
  }, [me, key, enabled, active]);
}
