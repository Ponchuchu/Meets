// «Поделиться» событием: ссылка на событие в приложении и готовые ссылки для мессенджеров.
import { APP_URL } from '../lib/config';

export type ShareTarget = 'telegram' | 'whatsapp' | 'threads' | 'instagram';

export function eventLink(id: string): string {
  return `${APP_URL}/event/${encodeURIComponent(id)}`;
}

export function shareText(title: string, when: string): string {
  return `${title} — ${when}. Пойдём?`;
}

/** Куда открыть. Instagram не принимает текст по ссылке: копируем ссылку и открываем директ. */
export function shareUrl(target: ShareTarget, text: string, link: string): string {
  const t = encodeURIComponent(text);
  const l = encodeURIComponent(link);
  switch (target) {
    case 'telegram':
      return `https://t.me/share/url?url=${l}&text=${t}`;
    case 'whatsapp':
      return `https://wa.me/?text=${t}%20${l}`;
    case 'threads':
      return `https://www.threads.net/intent/post?text=${t}%20${l}`;
    case 'instagram':
      return 'https://www.instagram.com/direct/inbox/';
  }
}
