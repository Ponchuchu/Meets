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
 * Одна пометка у друга на карте (FIX5): только самое важное, остальное — в карточке по нажатию.
 * В пути → скорость; мало заряда (≤ 20 %, не заряжается) → красная батарейка; заряжается → молния;
 * давно не обновлялся (от 10 мин) → «25 мин»; всё обычно → ничего.
 */
export type FriendMark = { kind: 'speed' | 'low' | 'charging' | 'ago'; text: string } | null;
export function friendMark(s: { state: string; speedKmh?: number; battery?: number; charging?: boolean; minutesAgo?: number }, agoText: (m: number) => string): FriendMark {
  if (s.state === 'moving' && s.speedKmh) return { kind: 'speed', text: `${s.speedKmh} км/ч` };
  if (s.battery != null && s.battery <= 20 && !s.charging) return { kind: 'low', text: `${s.battery}%` };
  if (s.charging && s.battery != null) return { kind: 'charging', text: `${s.battery}%` };
  if (s.minutesAgo != null && s.minutesAgo >= 10) return { kind: 'ago', text: agoText(s.minutesAgo) };
  return null;
}
