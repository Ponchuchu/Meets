// Строка «кто идёт» под событием: друзья по именам, «ищут компанию» и «идут» — от 3 человек.
import type { EventItem, Person } from '../data/types';

export function socialLine(e: EventItem, people: Person[]): string {
  const names = e.friendsGoing.map((id) => people.find((p) => p.id === id)?.name).filter(Boolean) as string[];
  if (names.length === 1) return `${names[0]} идёт${e.lookingCount >= 3 ? ` · ищут компанию ${e.lookingCount}` : ''}`;
  if (names.length === 2) return `${names[0]} и ${names[1]} идут`;
  if (names.length > 2) return `${names[0]}, ${names[1]} и ещё ${names.length - 2} идут`;
  // «Кто идёт» и «ищут» показываем от 3 человек.
  if (e.lookingCount >= 3) return `Ищут компанию ${e.lookingCount}`;
  if (e.goingCount >= 3) return `Идут ${e.goingCount.toLocaleString('ru-RU')}`;
  // Никого нет — молчим: «Можно прийти одному» на каждой второй карточке было лишним шумом (владелец, 21 окт.).
  return '';
}

/**
 * Давно не обновлялся → время; в пути → скорость и заряд; иначе — заряд.
 * Неизвестный заряд не показываем, малый и зарядка выделены цветом.
 */
export type FriendMark = { kind: 'speed' | 'low' | 'charging' | 'battery' | 'ago'; text: string } | null;
export function friendMark(s: { state: string; speedKmh?: number; battery?: number; charging?: boolean; minutesAgo?: number }, agoText: (m: number) => string): FriendMark {
  if (s.minutesAgo != null && s.minutesAgo >= 10) return { kind: 'ago', text: agoText(s.minutesAgo) };
  const battery = s.battery != null && Number.isFinite(s.battery) && s.battery >= 0 && s.battery <= 100 ? Math.round(s.battery) : undefined;
  if (s.state === 'moving' && s.speedKmh) return { kind: 'speed', text: `${s.speedKmh} км/ч${battery != null ? ` · ${battery}%` : ''}` };
  if (battery != null && battery <= 20 && !s.charging) return { kind: 'low', text: `${battery}%` };
  if (s.charging && battery != null) return { kind: 'charging', text: `${battery}%` };
  if (battery != null) return { kind: 'battery', text: `${battery}%` };
  return null;
}
