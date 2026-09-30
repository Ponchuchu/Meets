// Правила пушей (PRODUCT.md, раздел 15). Чистые функции: их считает сервер (Edge Function notify),
// а тесты проверяют здесь. Время — по Алматы.
import { almaty, dayIndex, dayStart } from '../lib/clock';

export type PushKind = 'message' | 'sticker' | 'invite' | 'friendNear' | 'interestNear' | 'reminder' | 'dailyFeed' | 'weekend' | 'cancelled' | 'staff';

export interface PushPrefs {
  friendNear: boolean;
  interestNear: boolean;
  remind2h: boolean;
  messages: boolean;
  weekend: boolean;
}

export const DEFAULT_PREFS: PushPrefs = { friendNear: true, interestNear: true, remind2h: true, messages: true, weekend: false };

export interface SentPush {
  kind: PushKind;
  at: Date;
  /** О ком / о чём: id друга для «друг рядом» и стикеров, id события для напоминаний. */
  about?: string | null;
}

export interface PushCandidate {
  kind: PushKind;
  at: Date;
  about?: string | null;
}

export type Decision =
  | { send: true; silent: boolean }
  | { send: false; reason: 'prefs' | 'quiet' | 'dailyLimit' | 'friendCooldown' | 'stickerCooldown' | 'duplicate'; retryAt?: Date };

export const DAILY_LIMIT = 4;
export const QUIET_FROM = 23;
export const QUIET_TO = 9;
export const FRIEND_NEAR_COOLDOWN_MS = 3 * 3600e3;
/** Стикеры кидать можно без лимита; пуш — не чаще раза в 30 с от одного друга, чтобы серия не звенела десять раз. */
export const STICKER_COOLDOWN_MS = 30e3;
export const REMINDER_BEFORE_MS = 2 * 3600e3;

/** «Сразу»: сообщения, стикеры, приглашения, отмена события. В тихие часы приходят без звука. */
const INSTANT: PushKind[] = ['message', 'sticker', 'invite', 'cancelled', 'staff'];
/** В дневной лимит не входят сообщения и стикеры, отмена того, куда ты идёшь, и рабочие пуши команде. */
const OUTSIDE_LIMIT: PushKind[] = ['message', 'sticker', 'cancelled', 'staff'];

export function isQuiet(at: Date): boolean {
  const h = almaty(at).getUTCHours();
  return h >= QUIET_FROM || h < QUIET_TO;
}

/** Ближайшие 09:00 по Алматы после момента в тихие часы. */
export function quietEnd(at: Date): Date {
  const day = dayIndex(at) + (almaty(at).getUTCHours() >= QUIET_FROM ? 1 : 0);
  return new Date(dayStart(day).getTime() + QUIET_TO * 3600e3);
}

function allowedByPrefs(kind: PushKind, p: PushPrefs): boolean {
  switch (kind) {
    case 'message':
    case 'sticker':
    case 'invite':
      return p.messages;
    case 'friendNear':
      return p.friendNear;
    case 'interestNear':
      return p.interestNear;
    case 'reminder':
      return p.remind2h;
    case 'weekend':
      return p.weekend;
    case 'dailyFeed':
    case 'cancelled':
    case 'staff':
      return true;
  }
}

/** Отправлять ли пуш сейчас. `sent` — журнал уже отправленного этому человеку (достаточно последних суток). */
export function decide(c: PushCandidate, sent: SentPush[], prefs: PushPrefs = DEFAULT_PREFS): Decision {
  if (!allowedByPrefs(c.kind, prefs)) return { send: false, reason: 'prefs' };
  const t = c.at.getTime();

  if (c.kind === 'sticker' && c.about) {
    const last = sent.find((s) => s.kind === 'sticker' && s.about === c.about && t - s.at.getTime() < STICKER_COOLDOWN_MS);
    if (last) return { send: false, reason: 'stickerCooldown', retryAt: new Date(last.at.getTime() + STICKER_COOLDOWN_MS) };
  }
  if (c.kind === 'friendNear' && c.about) {
    const last = sent.find((s) => s.kind === 'friendNear' && s.about === c.about && t - s.at.getTime() < FRIEND_NEAR_COOLDOWN_MS);
    if (last) return { send: false, reason: 'friendCooldown' };
  }
  if ((c.kind === 'reminder' || c.kind === 'dailyFeed' || c.kind === 'weekend') && sent.some((s) => s.kind === c.kind && s.about === (c.about ?? undefined) && dayIndex(s.at) === dayIndex(c.at))) {
    return { send: false, reason: 'duplicate' };
  }

  if (!OUTSIDE_LIMIT.includes(c.kind)) {
    const today = dayIndex(c.at);
    const counted = sent.filter((s) => !OUTSIDE_LIMIT.includes(s.kind) && dayIndex(s.at) === today).length;
    if (counted >= DAILY_LIMIT) return { send: false, reason: 'dailyLimit' };
  }

  if (isQuiet(c.at)) {
    if (INSTANT.includes(c.kind) || c.kind === 'reminder') return { send: true, silent: true };
    // «Друг рядом» к утру неактуален — не переносим.
    if (c.kind === 'friendNear' || c.kind === 'interestNear') return { send: false, reason: 'quiet' };
    return { send: false, reason: 'quiet', retryAt: quietEnd(c.at) };
  }
  return { send: true, silent: false };
}

/** Когда напомнить о плане: за 2 часа до начала (не раньше «сейчас»). */
export function reminderAt(startsAt: Date | string, now: Date): Date | null {
  const start = new Date(startsAt).getTime();
  if (start <= now.getTime()) return null;
  return new Date(Math.max(start - REMINDER_BEFORE_MS, now.getTime()));
}

/** Следующий запуск расписания: подборка — каждый день в 10:00, выходные — в четверг в 18:00. */
export function nextScheduled(kind: 'dailyFeed' | 'weekend', now: Date): Date {
  const hour = kind === 'dailyFeed' ? 10 : 18;
  let day = dayIndex(now);
  for (let i = 0; i < 8; i++, day++) {
    const at = new Date(dayStart(day).getTime() + hour * 3600e3);
    // 1970-01-01 — четверг, поэтому четверг = day % 7 === 0.
    if (at > now && (kind === 'dailyFeed' || day % 7 === 0)) return at;
  }
  throw new Error('unreachable');
}
