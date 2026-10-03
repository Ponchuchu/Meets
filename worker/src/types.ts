// Типы сборщика событий (docs/PIPELINE.md).

export type SourceKind = 'telegram' | 'site' | 'search' | 'threads' | 'manual' | 'user';

export interface Source {
  id: string;
  kind: SourceKind;
  handle: string;
  title: string;
  trusted: boolean;
  auto_publish: boolean;
  enabled: boolean;
  cursor: string | null;
}

/** Сырой пост из источника. */
export interface RawPost {
  sourceId: string;
  externalId: string; // номер поста в канале
  url: string;
  text: string;
  images: string[];
  postedAt: string | null;
}

export type PostClass = 'event' | 'ad' | 'meme' | 'not_almaty' | 'cancel';

export const CATEGORIES = ['music', 'standup', 'art', 'hike', 'games', 'food', 'sport', 'talks', 'theatre', 'lecture', 'meetup', 'party', 'bike', 'concert'] as const;
export type Category = (typeof CATEGORIES)[number];

/** Черновик карточки — structured output ИИ (или эвристики в демо-режиме). */
export interface Extraction {
  class: PostClass;
  title: string;
  category: Category;
  tags: string[];
  starts_at: string | null;
  ends_at: string | null;
  is_long: boolean;
  venue_name: string | null;
  address: string | null;
  address_note: string | null;
  price_min: number | null;
  price_max: number | null;
  is_free: boolean;
  /** Цена мелким шрифтом или неясна — модератору «проверь сумму». */
  price_unsure: boolean;
  about: string;
  organizer: string | null;
  confidence: number;
  /** Для отмены: название события, которое отменили. */
  cancel_of: string | null;
}

export type Flag = 'needs_pin' | 'check_price' | 'cancel_reported';

export interface Point {
  lat: number;
  lon: number;
}

/** Готовый черновик для таблицы events. */
export interface Draft {
  title: string;
  category: Category;
  tags: string[];
  starts_at: string;
  ends_at: string | null;
  is_long: boolean;
  venue_id: string | null;
  venue_name: string | null;
  address: string | null;
  address_note: string | null;
  point: Point | null;
  price_min: number | null;
  price_max: number | null;
  is_free: boolean;
  about: string;
  organizer: string | null;
  source_url: string;
  cover_url: string | null;
  ai_confidence: number;
  flags: Flag[];
  status: 'draft' | 'published';
}

/** Известное событие для поиска дублей (из базы или из этого же запуска). */
export interface KnownEvent {
  id: string;
  title: string;
  starts_at: string;
  venue_name: string | null;
}
