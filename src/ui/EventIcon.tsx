// Значок события в карточках (26 октября): тот же объёмный значок, что на карте (набор владельца, assets/map/sprites),
// вместо линейной иконки в чёрном квадрате. Одинаковый в профиле, «Ищу компанию», событии и планах.
import { Image } from 'expo-image';
import type { EventItem } from '../data/types';
import { SPRITE_PT, SPRITES, type SpriteName } from '../map/sprites';
import { eventSprite } from '../map/symbols';

export function EventIcon({ e, sprite, size = 48 }: { e?: Pick<EventItem, 'category' | 'title' | 'venueName'>; sprite?: SpriteName; size?: number }) {
  const id = sprite ?? (e ? eventSprite(e) : 'ev-business');
  return <Image source={SPRITES[id]} style={{ width: size, height: size * (SPRITE_PT.h / SPRITE_PT.w) }} contentFit="contain" accessibilityIgnoresInvertColors />;
}
