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
  return 'Можно прийти одному';
}
