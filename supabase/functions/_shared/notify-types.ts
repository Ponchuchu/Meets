// Сгенерировано scripts/build-functions.mjs — не править руками.
export type PushKind = 'message' | 'sticker' | 'invite' | 'friendNear' | 'interestNear' | 'reminder' | 'dailyFeed' | 'weekend' | 'cancelled' | 'staff';

export interface PushPrefs {
  friendNear: boolean;
  interestNear: boolean;
  remind2h: boolean;
  messages: boolean;
  weekend: boolean;
}

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
