// «Поделиться» событием: ссылка на событие и подпись. Сама отправка — картинкой (event/ui/ShareCard.tsx).
import { APP_URL } from '../lib/config';

export function eventLink(id: string): string {
  return `${APP_URL}/event/${encodeURIComponent(id)}`;
}

export function shareText(title: string, when: string): string {
  return `${title} — ${when}. Пойдём?`;
}
