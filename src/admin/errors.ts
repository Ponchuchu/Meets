// Понятные причины сбоев поиска: из сырого текста журнала (GitHub, Gemini, Kimi, сайты) — заголовок и что делать.
export type ErrorKind = 'money' | 'limit' | 'key' | 'model' | 'timeout' | 'github' | 'empty' | 'other';
export interface Explained { kind: ErrorKind; title: string; hint: string }

export function explainError(text?: string | null): Explained {
  const t = (text ?? '').trim();
  if (/\b402\b|prepayment|depleted|insufficient|balance|недостаточно средств|закончились деньги/i.test(t)) {
    return { kind: 'money', title: 'Закончились деньги на счёте ИИ', hint: 'Пополни баланс у поставщика (Gemini: AI Studio → Billing, Kimi: platform.moonshot). Код менять не нужно. Афиши сайтов ищутся без ИИ и бесплатно.' };
  }
  // «Запуск завершился с ошибкой. Журнал: GitHub → …» — поиск уже шёл, токен тут ни при чём.
  if (/завершился с ошибкой/i.test(t)) {
    return { kind: 'other', title: 'Поиск остановился на середине', hint: 'Афиши прочитаны, но запись прервалась. Запусти ещё раз — найденное не потеряется.' };
  }
  if (/не удалось запустить|dispatch|токен|token|Bad credentials/i.test(t) && !/API[_ ]?KEY/i.test(t)) {
    return { kind: 'github', title: 'Не удалось запустить поиск на GitHub', hint: 'Проверь токен в «Настройки → Подключение» и повтори.' };
  }
  if (/Нет (GEMINI|KIMI)_API_KEY|API[_ ]?KEY|\b401\b|PERMISSION_DENIED|unauthori[sz]ed|invalid.*key|ключ/i.test(t)) {
    return { kind: 'key', title: 'Ключ ИИ не принят или не добавлен', hint: 'GitHub → Settings → Secrets and variables → Actions: GEMINI_API_KEY или KIMI. Токены в чат не присылай.' };
  }
  if (/\b429\b|RESOURCE_EXHAUSTED|rate.?limit|too many|quota|лимит/i.test(t)) {
    return { kind: 'limit', title: 'ИИ просит подождать: лимит запросов', hint: 'Подожди минуту и запусти снова. Афиши сайтов лимит не тратят.' };
  }
  if (/модел[иь].*нет|model.*not.*found|does not exist|\b404\b/i.test(t)) {
    return { kind: 'model', title: 'Такой модели нет', hint: 'Выбери модель из списка в «Настройки → ИИ-поиск».' };
  }
  if (/время вышло|timeout|timed out|AbortError|не успел/i.test(t)) {
    return { kind: 'timeout', title: 'ИИ не успел ответить', hint: 'Запусти ещё раз или уменьши «дней вперёд» в настройках.' };
  }
  if (/0 событий|ничего не наш|не нашл/i.test(t)) {
    return { kind: 'empty', title: 'Ничего не нашлось', hint: 'Увеличь «дней вперёд» в настройках или выбери другой источник.' };
  }
  return { kind: 'other', title: 'Запуск не удался', hint: 'Подробности: GitHub → Actions → search.' };
}

const MIN = 60_000;
/** «только что», «5 мин назад», «сегодня 10:12», «вчера 22:40», «12 окт». */
export function ago(iso: string | null | undefined, now = new Date()): string {
  if (!iso) return 'ещё не запускали';
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '—';
  const d = now.getTime() - t;
  if (d < MIN) return 'только что';
  if (d < 60 * MIN) return `${Math.round(d / MIN)} мин назад`;
  const a = new Date(t + 5 * 3600e3);
  const n = new Date(now.getTime() + 5 * 3600e3);
  const hm = `${String(a.getUTCHours()).padStart(2, '0')}:${String(a.getUTCMinutes()).padStart(2, '0')}`;
  const day = Math.floor(n.getTime() / 86400e3) - Math.floor(a.getTime() / 86400e3);
  if (day === 0) return `сегодня ${hm}`;
  if (day === 1) return `вчера ${hm}`;
  const M = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  return `${a.getUTCDate()} ${M[a.getUTCMonth()]}, ${hm}`;
}
