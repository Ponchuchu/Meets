/** Дата события показывается отдельно от названия. */
export function displayEventTitle(title: string): string {
  return title.replace(/\s*\(\s*\d{1,2}\s+(?:января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря|january|february|march|april|may|june|july|august|september|october|november|december)(?:\s+\d{4})?\s*\)\s*$/iu, '').trim() || title.trim();
}
