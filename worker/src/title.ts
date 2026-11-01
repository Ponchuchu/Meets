/** Заголовок должен называть событие, а не инструктировать читателя. */
export function usableTitle(title: string): boolean {
  const t = title.trim();
  return t.length > 1 && !/^(пусто|нет названия|без названия|смотрите программу в карусели)[.!\s]*$/i.test(t);
}

/** Удаляем только дату в скобках в конце, не трогая значимые части названия. */
export function cleanEventTitle(title: string): string {
  return title.replace(/\s*\(\s*\d{1,2}\s+(?:января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)(?:\s+\d{4})?\s*\)\s*$/iu, '').trim();
}
