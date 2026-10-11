// Что показать в строке диалога, чтобы список не был пустым: последнее сообщение с подписью «Ты:»
// и «последнее действие» с этим человеком — приглашение, общий план, куда он идёт.
import type { MessageKind } from '../data/types';

const KIND_TEXT: Partial<Record<MessageKind, string>> = {
  photo: 'Фото', video: 'Видео', voice: 'Голосовое', circle: 'Кружок', sticker: 'Стикер', invite: 'Приглашение', poll: 'Опрос',
};

/** Текст последнего сообщения: у фото, голосовых и кружков — их название. */
export function previewText(kind: MessageKind | undefined, text: string): string {
  if (kind === 'sticker' && text) return `Стикер · ${text}`;
  if (kind === 'invite') return text ? `Приглашение · ${text}` : 'Приглашение';
  return text || (kind ? KIND_TEXT[kind] ?? '' : '');
}

export interface ActivityEvent { id: string; title: string; startsAt: string; friendsGoing: string[] }
export interface ActivityInvite { from_id: string; to_id: string; event_id: string | null; answer: 'yes' | 'no' | null }

const short = (t: string) => (t.length > 26 ? `${t.slice(0, 25).trim()}…` : t);

/** Последнее действие с человеком. Приоритет: ждущее ответа приглашение → общий план → куда он идёт. */
export function friendActivity(personId: string, me: string | null, events: ActivityEvent[], going: Set<string>, invites: ActivityInvite[], now: Date): string | null {
  const byId = (id: string | null) => events.find((e) => e.id === id);
  const future = (e: ActivityEvent) => Date.parse(e.startsAt) + 3 * 3600e3 > now.getTime();
  for (const i of invites) {
    const e = byId(i.event_id);
    if (!e || !future(e)) continue;
    if (i.from_id === personId && i.to_id === me && !i.answer) return `Зовёт тебя на «${short(e.title)}»`;
    if (i.from_id === me && i.to_id === personId) {
      if (!i.answer) return `Ты позвал на «${short(e.title)}» · ждёшь ответ`;
      if (i.answer === 'yes') return `Идёт с тобой на «${short(e.title)}»`;
    }
  }
  const upcoming = events.filter((e) => future(e) && e.friendsGoing.includes(personId)).sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  const both = upcoming.find((e) => going.has(e.id));
  if (both) return `Вы оба идёте на «${short(both.title)}»`;
  if (upcoming[0]) return `Идёт на «${short(upcoming[0].title)}»`;
  return null;
}
