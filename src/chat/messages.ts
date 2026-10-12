import type { Message } from '../data/types';

/** Ответ сервера заменяет локальную копию по id; ошибка отправки сохраняется до подтверждения. */
export function mergeChatMessages(remote: Message[], pending: Message[]): Message[] {
  const rows = new Map(remote.map(m => [m.id, m]));
  pending.forEach(m => { if (!rows.has(m.id)) rows.set(m.id, m); });
  const result = [...rows.values()];
  if (result.every(m => m.createdAt && Number.isFinite(Date.parse(m.createdAt)))) result.sort((a,b) => Date.parse(a.createdAt!) - Date.parse(b.createdAt!));
  return result;
}
