// Интересы на входе (V5LoginTaste): 12 чипсов → ключи стартового вкуса ленты (src/reco/startTaste).
import type { Interest } from '../reco/startTaste';

export const TASTE_CHIPS: { id: string; label: string; interest: Interest }[] = [
  { id: 'jazz', label: 'Джаз', interest: 'music' },
  { id: 'standup', label: 'Стендап', interest: 'standup' },
  { id: 'mountains', label: 'Горы', interest: 'hike' },
  { id: 'boardgames', label: 'Настолки', interest: 'games' },
  { id: 'cinema', label: 'Кино', interest: 'talks' },
  { id: 'museums', label: 'Музеи', interest: 'art' },
  { id: 'coffee', label: 'Кофе', interest: 'food' },
  { id: 'dance', label: 'Танцы', interest: 'party' },
  { id: 'sport', label: 'Спорт', interest: 'sport' },
  { id: 'theatre', label: 'Театр', interest: 'art' },
  { id: 'parties', label: 'Вечеринки', interest: 'party' },
  { id: 'yoga', label: 'Йога', interest: 'sport' },
];

export const MIN_TASTE = 3;

/** Выбранные чипсы → интересы для ленты, без повторов, в порядке чипсов. */
export function interestsOf(ids: string[]): Interest[] {
  const out: Interest[] = [];
  for (const c of TASTE_CHIPS) if (ids.includes(c.id) && !out.includes(c.interest)) out.push(c.interest);
  return out;
}
