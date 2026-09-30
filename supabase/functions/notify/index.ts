// Пуши через Expo Push Service. Правила частоты и тихие часы — decide() из src/notify/rules.ts.
// Вызовы (только с CRON_SECRET — из pg_cron и триггера):
//   { type: 'message', message_id }      — триггер на новое сообщение
//   { type: 'job', job: 'reminders' | 'dailyFeed' | 'weekend' | 'friendNear' } — pg_cron
//   { type: 'cancelled', event_id }      — модератор или сборщик отменил событие
//   { type: 'staff', count }             — после сбора: «7 событий ждут проверки»
import { decide, DEFAULT_PREFS, type PushCandidate, type PushKind, type PushPrefs, type SentPush } from '../_shared/app.js';
import { admin, isServiceCall, json } from '../_shared/supabase.ts';

const db = admin();

interface Push {
  userId: string;
  kind: PushKind;
  about?: string | null;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

async function prefsOf(userId: string): Promise<PushPrefs> {
  const { data } = await db.from('notification_prefs').select('*').eq('user_id', userId).maybeSingle();
  if (!data) return DEFAULT_PREFS;
  return { friendNear: data.friend_near, interestNear: data.interest_near, remind2h: data.remind_2h, messages: data.messages, weekend: data.weekend };
}

async function sentOf(userId: string): Promise<SentPush[]> {
  const since = new Date(Date.now() - 26 * 3600e3).toISOString();
  const { data } = await db.from('notification_log').select('kind,about,sent_at').eq('user_id', userId).gte('sent_at', since);
  return (data ?? []).map((r: any) => ({ kind: r.kind, about: r.about, at: new Date(r.sent_at) }));
}

/** Проверяет правила, шлёт на все устройства человека, пишет в журнал. */
async function deliver(p: Push): Promise<string> {
  const candidate: PushCandidate = { kind: p.kind, at: new Date(), about: p.about ?? null };
  const verdict = decide(candidate, await sentOf(p.userId), await prefsOf(p.userId));
  if (!verdict.send) return verdict.reason;
  const { data: tokens } = await db.from('push_tokens').select('token').eq('user_id', p.userId);
  if (!tokens?.length) return 'no-token';
  const messages = tokens.map((t: any) => ({
    to: t.token, title: p.title, body: p.body, data: p.data ?? {}, sound: verdict.silent ? null : 'default', priority: verdict.silent ? 'normal' : 'high',
  }));
  const res = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(Deno.env.get('EXPO_ACCESS_TOKEN') ? { Authorization: `Bearer ${Deno.env.get('EXPO_ACCESS_TOKEN')}` } : {}) },
    body: JSON.stringify(messages),
  });
  if (!res.ok) return `expo ${res.status}`;
  await db.from('notification_log').insert({ user_id: p.userId, kind: p.kind, about: p.about ?? null });
  return 'sent';
}

const PREVIEW: Record<string, string> = { photo: 'Фото', video: 'Видео', voice: 'Голосовое', circle: 'Кружок', sticker: 'Стикер', invite: 'Зовёт на событие', poll: 'Опрос' };

async function onMessage(messageId: string) {
  const { data: m } = await db.from('messages').select('id,chat_id,author_id,kind,body,chats(kind,events(title))').eq('id', messageId).single();
  if (!m || !m.author_id || m.kind === 'system') return [];
  const [{ data: author }, { data: members }] = await Promise.all([
    db.from('profiles').select('name').eq('id', m.author_id).single(),
    db.from('chat_members').select('user_id').eq('chat_id', m.chat_id).neq('user_id', m.author_id),
  ]);
  const chat = m.chats as any;
  const title = chat?.kind === 'event' ? (chat.events?.title ?? 'Чат события') : (author?.name ?? 'Сообщение');
  const text = m.kind === 'text' ? (m.body ?? '') : PREVIEW[m.kind] ?? '';
  const body = chat?.kind === 'event' ? `${author?.name ?? ''}: ${text}` : text;
  const kind: PushKind = m.kind === 'sticker' ? 'sticker' : m.kind === 'invite' ? 'invite' : 'message';
  return Promise.all(
    (members ?? []).map((r: any) => deliver({ userId: r.user_id, kind, about: kind === 'sticker' ? m.author_id : null, title, body, data: { url: `/chat/${m.chat_id}` } })),
  );
}

async function reminders() {
  // Планы, которые начинаются через 1 ч 50 мин – 2 ч 10 мин (задача идёт раз в 10 минут, окно с запасом).
  const now = Date.now();
  const from = new Date(now + 110 * 60e3).toISOString();
  const to = new Date(now + 130 * 60e3).toISOString();
  const { data } = await db.from('attendance').select('user_id,event_id,events!inner(title,starts_at,venue_id)').eq('status', 'going')
    .gte('events.starts_at', from).lt('events.starts_at', to);
  return Promise.all((data ?? []).map((r: any) => deliver({
    userId: r.user_id, kind: 'reminder', about: r.event_id, title: 'Через 2 часа', body: r.events.title, data: { url: `/event/${r.event_id}` },
  })));
}

async function digest(kind: 'dailyFeed' | 'weekend') {
  const { data: users } = await db.from('push_tokens').select('user_id');
  const ids = [...new Set((users ?? []).map((u: any) => u.user_id as string))];
  const title = kind === 'dailyFeed' ? 'Новая подборка «Для тебя»' : 'Подборка на выходные';
  const body = kind === 'dailyFeed' ? '10 событий под твои интересы — листай' : '7 событий на субботу и воскресенье';
  return Promise.all(ids.map((userId) => deliver({ userId, kind, title, body, data: { url: '/foryou' } })));
}

async function friendNear() {
  // Друг (который делится точкой) в 200 м от события, куда я иду сегодня. SQL — friend_near_candidates().
  const { data } = await db.rpc('friend_near_candidates');
  return Promise.all((data ?? []).map((r: any) => deliver({
    userId: r.recipient, kind: 'friendNear', about: r.friend_id,
    title: `${r.friend_name} рядом`, body: `В ${Math.round(r.meters / 10) * 10} м от «${r.event_title}» — позвать?`, data: { url: `/event/${r.event_id}` },
  })));
}

async function cancelled(eventId: string) {
  const { data: ev } = await db.from('events').select('title').eq('id', eventId).single();
  const { data } = await db.from('attendance').select('user_id').eq('event_id', eventId).in('status', ['going', 'saved']);
  return Promise.all((data ?? []).map((r: any) => deliver({
    userId: r.user_id, kind: 'cancelled', about: eventId, title: 'Событие отменили', body: ev?.title ?? '', data: { url: `/event/${eventId}` },
  })));
}

const plural = (n: number, one: string, few: string, many: string) =>
  n % 10 === 1 && n % 100 !== 11 ? one : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? few : many;

async function staff(count: number) {
  const { data } = await db.from('staff').select('user_id');
  const body = `${count} ${plural(count, 'событие ждёт', 'события ждут', 'событий ждут')} проверки`;
  return Promise.all((data ?? []).map((r: any) => deliver({ userId: r.user_id, kind: 'staff', title: 'Модерация', body, data: { url: '/admin' } })));
}

Deno.serve(async (req) => {
  if (!isServiceCall(req)) return json({ error: 'forbidden' }, 403);
  const body = await req.json().catch(() => ({}));
  if (body.type === 'message' && body.message_id) return json({ results: await onMessage(body.message_id) });
  if (body.type === 'cancelled' && body.event_id) return json({ results: await cancelled(body.event_id) });
  if (body.type === 'staff') return json({ results: await staff(Number(body.count) || 0) });
  if (body.type === 'job') {
    if (body.job === 'reminders') return json({ results: await reminders() });
    if (body.job === 'dailyFeed' || body.job === 'weekend') return json({ results: await digest(body.job) });
    if (body.job === 'friendNear') return json({ results: await friendNear() });
  }
  return json({ error: 'unknown call' }, 400);
});
