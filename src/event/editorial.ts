import type { EventItem } from '../data/types';
const norm = (s: string) => s.toLowerCase().replace(/ё/g, 'е').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
/** Remove standalone repeated facts, keeping narrative sentences and practical conditions. */
export function editorialText(e: Pick<EventItem, 'title' | 'about' | 'address' | 'venueName'>): string {
  const facts = [e.title, e.address, e.venueName ?? ''].map(norm).filter(s => s.length >= 4);
  return e.about.split('\n').filter(line => {
    const text = line.trim(), n = norm(text);
    if (facts.includes(n)) return false;
    if (/^[\s📍📅🕐🕒🎟🎫💰]*(?:\d{1,2}\s+(?:января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)|\d{1,2}[./]\d{1,2})[\d\s,:.\-–—|]*(?:\d{1,2}:\d{2})?\s*$/iu.test(text)) return false;
    if (/^[📍\s]*(?:адрес|место|площадка)\s*:/iu.test(text)) return false;
    if (/^[🎟🎫💰\s]*(?:билеты?\s*(?:от|:)|цена\s*:|стоимость\s*:)/iu.test(text)) return false;
    return true;
  }).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
