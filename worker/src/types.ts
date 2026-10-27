// Типы сборщика событий (docs/PIPELINE.md).

export type SourceKind = 'telegram' | 'site' | 'search' | 'threads' | 'instagram' | 'manual' | 'user';

export interface Source {
  id: string;
  kind: SourceKind;
  handle: string;
  title: string;
  trusted: boolean;
  auto_publish: boolean;
  enabled: boolean;
  cursor: string | null;
  /** Папка в панели (afisha, venue, mall, theatre…) и место по умолчанию у страницы площадки. */
  folder?: string;
  venue_name?: string | null;
}

/** Фото или видео события (копия в хранилище event-media). */
export interface MediaItem {
  type: 'image' | 'video';
  url: string;
  poster?: string | null;
}

/** Сырой пост из источника. */
export interface RawPost {
  sourceId: string;
  externalId: string; // номер поста в канале
  url: string;
  text: string;
  images: string[];
  postedAt: string | null;
  /** Фото и видео поста (Instagram, Threads). */
  media?: MediaItem[];
}

export type PostClass = 'event' | 'ad' | 'meme' | 'not_almaty' | 'cancel';

export const CATEGORIES = ['music', 'standup', 'art', 'hike', 'games', 'food', 'sport', 'talks', 'movie', 'theatre', 'lecture', 'meetup', 'party', 'bike', 'concert'] as const;
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
  /** Точка площадки, если источник её отдаёт (Яндекс Афиша): геокодер тогда не нужен. */
  lat?: number | null;
  lon?: number | null;
  /** Время начала написано в посте. Нет — дубли ищем по дню, а не по минуте. */
  time_known?: boolean;
  /** Все даты показов (ISO), если их несколько. */
  sessions?: string[];
}

export type Flag = 'needs_pin' | 'check_price' | 'cancel_reported';

export interface Point {
  lat: number;
  lon: number;
  /** Адрес, который нашёл геокодер по названию площадки («проспект Абая, 43»). */
  address?: string;
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
  media?: MediaItem[];
  sessions?: string[];
  ai_confidence: number;
  flags: Flag[];
  status: 'draft' | 'published';
}

/** Известное событие для поиска дублей (из базы или из этого же запуска). */
export interface KnownEvent {
  is_long?: boolean;
  sessions?: string[];
  id: string;
  title: string;
  starts_at: string;
  venue_name: string | null;
}
