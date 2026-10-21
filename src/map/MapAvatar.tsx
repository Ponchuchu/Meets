import type { Person } from '../data/types';
import { AvatarFrame } from '../profile/frames';

export { MAP_FRAMES } from '../profile/frames';

/** Один рисунок для карты, профиля и предпросмотра. Хвост указывает на координату. */
export function MapAvatar({ person, size = 42, ring }: { person: Person; size?: number; ring?: string }) {
  return <AvatarFrame frameId={person.mapFrame} shape={person.mapShape} photo={person.photo} initial={person.initial} tint={person.tint} size={size} ring={ring} mapPin />;
}
