let seq = 0;
/** Уникальный id для локальных записей (сообщения, приглашения) до появления сервера. */
export function uid(prefix = 'id'): string {
  seq += 1;
  return `${prefix}-${Date.now().toString(36)}-${seq}`;
}
