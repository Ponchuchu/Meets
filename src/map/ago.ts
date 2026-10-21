// Подпись у друга, который давно не обновлял точку.
/** «5 мин», «3 ч», «вчера», «4 дн» — вместо «702 МИН». */
export function agoShort(min: number): string {
  if (min < 1) return 'сейчас';
  if (min < 60) return `${Math.round(min)} мин`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} ч`;
  const d = Math.round(h / 24);
  return d <= 1 ? 'вчера' : `${d} дн`;
}
