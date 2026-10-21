// Статус своего сообщения (часики / одна / две галочки / ошибка) — чистая логика для Tick.tsx и тестов.
export type TickKind = 'wait' | 'sent' | 'read' | 'failed';

export const tickOf = (m: { delivery?: 'sending' | 'failed'; createdAt?: string }, readUpTo?: string): TickKind =>
  m.delivery === 'failed' ? 'failed' : m.delivery ? 'wait' : readUpTo && m.createdAt && Date.parse(m.createdAt) <= Date.parse(readUpTo) ? 'read' : 'sent';

export const TICK_LABEL: Record<TickKind, string> = { wait: 'Отправляется', sent: 'Доставлено', read: 'Прочитано', failed: 'Не отправилось' };

