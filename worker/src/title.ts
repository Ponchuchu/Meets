/** Заголовок должен называть событие, а не инструктировать читателя. */
export function usableTitle(title: string): boolean {
  const t = title.trim();
  return t.length > 1 && !/^(пусто|нет названия|без названия|смотрите программу в карусели)[.!\s]*$/i.test(t);
}
