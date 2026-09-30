// Правила видимости — таблица «Кто что видит» (PRODUCT.md, раздел 14).
// ● видно · ◐ если человек сам включил · — не видно никому. Вкус и рекомендации не видит никто, кроме команды.

export type Relation = 'stranger' | 'coEvent' | 'friend' | 'self';
export type Field = 'profile' | 'lookingForCompany' | 'achievements' | 'plans' | 'location' | 'speedStatus' | 'taste';

export interface OwnerPrivacy {
  /** Заявка «ищу компанию» есть и кому видна. */
  company: 'none' | 'all' | 'fof';
  achievements: 'me' | 'friends' | 'all';
  plansVisible: 'all' | 'friends' | 'nobody';
  /** Геолокация для друзей включена сейчас (на 2 часа или всегда). */
  sharingLocation: boolean;
  invisible: boolean;
  /** Сейчас в зоне 300 м вокруг дома. */
  atHome: boolean;
  /** Показывать ли, что в пути. */
  showMoving: boolean;
}

export const DEFAULT_PRIVACY: OwnerPrivacy = {
  company: 'none', achievements: 'friends', plansVisible: 'friends', sharingLocation: false, invisible: false, atHome: false, showMoving: true,
};

export function canSee(rel: Relation, field: Field, p: OwnerPrivacy, opts: { friendOfFriend?: boolean } = {}): boolean {
  if (field === 'taste') return false; // только команда в админке, даже не сам человек
  if (rel === 'self') return true;
  switch (field) {
    case 'profile':
      return true;
    case 'lookingForCompany':
      if (p.company === 'none' || p.invisible) return false;
      if (rel === 'friend' || rel === 'coEvent') return true;
      return p.company === 'all' || (p.company === 'fof' && !!opts.friendOfFriend);
    case 'achievements':
      if (p.achievements === 'me') return false;
      return rel === 'friend' || p.achievements === 'all';
    case 'plans':
      if (p.invisible || p.plansVisible === 'nobody') return false;
      return rel === 'friend' || p.plansVisible === 'all';
    case 'location':
      return rel === 'friend' && p.sharingLocation && !p.invisible && !p.atHome;
    case 'speedStatus':
      return canSee(rel, 'location', p) && p.showMoving;
    default:
      return false;
  }
}

/** Точность геолокации ~50 м: координата округляется к сетке. */
export function fuzz(lat: number, lon: number): { lat: number; lon: number } {
  const dLat = 50 / 111320;
  const dLon = 50 / (111320 * Math.cos((lat * Math.PI) / 180));
  return { lat: Math.round(lat / dLat) * dLat, lon: Math.round(lon / dLon) * dLon };
}

export function distanceM(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6371000;
  const toR = (d: number) => (d * Math.PI) / 180;
  const dLat = toR(b.lat - a.lat);
  const dLon = toR(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toR(a.lat)) * Math.cos(toR(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export const HOME_RADIUS_M = 300;

export function inHomeZone(pos: { lat: number; lon: number }, home: { lat: number; lon: number } | null): boolean {
  return !!home && distanceM(pos, home) <= HOME_RADIUS_M;
}

/** «в 400 м», «в 1,2 км». */
export function distanceLabel(m: number): string {
  if (m < 1000) return `в ${Math.max(50, Math.round(m / 50) * 50)} м`;
  return `в ${(m / 1000).toFixed(1).replace('.', ',')} км`;
}

/** Стикер другу — не чаще раза в 10 минут. */
export const STICKER_COOLDOWN_MS = 10 * 60 * 1000;
export function canSendSticker(lastAt: string | undefined, now: Date): boolean {
  return !lastAt || now.getTime() - new Date(lastAt).getTime() >= STICKER_COOLDOWN_MS;
}
