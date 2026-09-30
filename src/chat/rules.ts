// Правила чатов (PRODUCT.md, разделы 5 и 9): незнакомым — только при общем событии и если человек разрешил,
// не больше 10 новых разговоров в день, новые аккаунты первые 24 часа не пишут первыми,
// медиа от незнакомых размыты до «показать», чаты событий и с незнакомыми живут 48 часов после события.

export const CHAT_TTL_MS = 48 * 3600 * 1000;
export const NEW_ACCOUNT_MS = 24 * 3600 * 1000;

export type WhoCanWrite = 'all' | 'friends' | 'common';

export interface WriteCheck {
  ok: boolean;
  reason?: 'not-allowed' | 'no-common-event' | 'new-account' | 'daily-limit' | 'blocked' | 'closed';
}

export const WRITE_REASONS: Record<NonNullable<WriteCheck['reason']>, string> = {
  'not-allowed': 'Человек разрешил писать только друзьям',
  'no-common-event': 'Писать незнакомым можно, только если вы идёте на одно событие',
  'new-account': 'Первые 24 часа новые аккаунты не пишут первыми — дождись, пока напишут тебе',
  'daily-limit': 'На сегодня хватит новых разговоров: не больше 10 в день',
  blocked: 'Ты заблокировал этого человека',
  closed: 'Чат закрылся через 48 часов после события. Добавьтесь в друзья, чтобы продолжить',
};

export function canWrite(opts: {
  friend: boolean;
  recipientAllows: WhoCanWrite;
  commonEvent: boolean;
  /** Уже есть переписка — лимиты новых разговоров не действуют. */
  existing: boolean;
  myAccountCreatedAt: string;
  newChatsToday: number;
  blocked: boolean;
  now: Date;
  /** Конец общего события (для закрытия чата с незнакомым). */
  eventEndsAt?: string | null;
}): WriteCheck {
  const o = opts;
  if (o.blocked) return { ok: false, reason: 'blocked' };
  if (o.friend) return { ok: true };
  if (o.eventEndsAt && o.now.getTime() > new Date(o.eventEndsAt).getTime() + CHAT_TTL_MS) return { ok: false, reason: 'closed' };
  if (o.existing) return { ok: true };
  if (o.recipientAllows === 'friends') return { ok: false, reason: 'not-allowed' };
  if (o.recipientAllows === 'common' && !o.commonEvent) return { ok: false, reason: 'no-common-event' };
  if (o.now.getTime() - new Date(o.myAccountCreatedAt).getTime() < NEW_ACCOUNT_MS) return { ok: false, reason: 'new-account' };
  if (o.newChatsToday >= 10) return { ok: false, reason: 'daily-limit' };
  return { ok: true };
}

/** Фото и видео от незнакомых размыты, пока не нажмёшь «показать». */
export function isBlurred(fromFriend: boolean, revealed: boolean): boolean {
  return !fromFriend && !revealed;
}

/** Чат события закрывается через 48 часов после конца события (или начала + 2 ч). */
export function eventChatOpen(startsAt: string, endsAt: string | null, now: Date): boolean {
  const end = endsAt ? new Date(endsAt).getTime() : new Date(startsAt).getTime() + 2 * 3600e3;
  return now.getTime() <= end + CHAT_TTL_MS;
}

/** «начало через 1 ч 28 мин», «идёт сейчас», «закончилось». */
export function startsIn(startsAt: string, endsAt: string | null, now: Date): string {
  const s = new Date(startsAt).getTime();
  const e = endsAt ? new Date(endsAt).getTime() : s + 2 * 3600e3;
  const t = now.getTime();
  if (t >= e) return 'закончилось';
  if (t >= s) return 'идёт сейчас';
  const min = Math.round((s - t) / 60000);
  if (min < 60) return `начало через ${min} мин`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h >= 24) return `начало через ${Math.round(h / 24)} дн`;
  return `начало через ${h} ч${m ? ` ${m} мин` : ''}`;
}

/** Опрос: голос можно поменять, проценты — от всех голосов. */
export function vote(options: { text: string; votes: number }[], mine: number | null, pick: number) {
  const next = options.map((o, i) => ({ ...o, votes: o.votes - (mine === i ? 1 : 0) + (pick === i ? 1 : 0) }));
  return { options: next, mine: pick, total: next.reduce((a, b) => a + b.votes, 0) };
}

/** Ключ свежести для списка чатов: «18:10» — сегодня (минуты), «вчера» — раньше, дата — ещё раньше. */
export function recencyKey(time: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  if (/^вчера/i.test(time.trim())) return -1;
  return -2;
}

/** Один список чатов: закреплённые сверху, дальше от новых к старым. */
export function sortChats<T extends { id: string; time: string }>(list: T[], pinned: Record<string, true>): T[] {
  return [...list].sort((a, b) => Number(!!pinned[b.id]) - Number(!!pinned[a.id]) || recencyKey(b.time) - recencyKey(a.time));
}
