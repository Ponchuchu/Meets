// Общая работа с Kimi (Moonshot): поиск событий (search.ts), разбор постов (ai.ts), поиск картинок (images.ts).
// Особенности нашего аккаунта (бесплатный уровень): 3 запроса в минуту и один одновременно — между запросами держим паузу,
// на 429 повторяем. Модели k2.6/k3 принимают только temperature=1, поэтому параметр не передаём; «размышление» выключаем:
// иначе модель пишет рассуждения прямо в ответ и упирается в лимит длины.

export const KIMI_DEFAULT_MODEL = 'kimi-k2.6';
export const isKimi = (model: string) => /^(kimi|moonshot)-/i.test(model);

export const kimiBase = () => (process.env.KIMI_BASE_URL || 'https://api.moonshot.ai/v1').replace(/\/$/, '');

let last = 0;
/** Пауза под лимит аккаунта (по умолчанию 21 с между запросами; KIMI_MIN_GAP_MS=0 — без паузы, если баланс пополнен). */
export async function paceKimi(): Promise<void> {
  const gap = Number(process.env.KIMI_MIN_GAP_MS ?? 21_000);
  const wait = last + gap - Date.now();
  last = Date.now() + Math.max(0, wait);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
}

export interface KimiMessage {
  role: string;
  content?: string | null;
  tool_calls?: { id: string; function: { name: string; arguments: string } }[];
  tool_call_id?: string;
  name?: string;
}
export interface KimiResponse {
  choices?: { finish_reason?: string; message?: KimiMessage }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

/** Модели, доступные этому ключу. */
export async function kimiModels(key: string): Promise<string[]> {
  const res = await fetch(`${kimiBase()}/models`, { headers: { authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`Kimi /models ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return ((await res.json()) as { data?: { id: string }[] }).data?.map((m) => m.id) ?? [];
}

/** Из списка берём не-«thinking» k2.6, потом k3/k2, потом moonshot-v1. */
export function pickKimiModel(ids: string[]): string | null {
  const ok = ids.filter((m) => !/thinking|vision|image|audio|embed|code/i.test(m));
  for (const re of [/^kimi-k2\.6$/i, /^kimi-k3$/i, /^kimi-k2/i, /^kimi-latest$/i, /^moonshot-v1-32k$/i, /^moonshot-v1/i]) {
    const m = ok.find((x) => re.test(x));
    if (m) return m;
  }
  return null;
}

/** Модель, которой на ключе нет, → найденная замена (запоминаем до конца запуска). */
const replaced = new Map<string, string>();

/**
 * Один запрос chat/completions. Сам: ждёт паузу, повторяет при 429/5xx, убирает «thinking», если модель его не знает,
 * подменяет несуществующую модель на доступную. Ошибки — с текстом ответа API.
 */
export async function kimiPost(key: string, body: Record<string, unknown>, timeoutMs = 120_000): Promise<KimiResponse> {
  const deadline = Date.now() + timeoutMs;
  let thinkingOff = process.env.KIMI_THINKING !== 'on';
  let model = replaced.get(String(body.model)) ?? String(body.model);
  const send = async () => {
    await paceKimi();
    return fetch(`${kimiBase()}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: JSON.stringify({ ...body, model, ...(thinkingOff ? { thinking: { type: 'disabled' } } : {}) }),
      signal: AbortSignal.timeout(Math.max(1000, deadline - Date.now())),
    });
  };
  let res = await send();
  for (let retry = 1; retry <= 3 && (res.status === 429 || res.status >= 500) && deadline - Date.now() > 5000; retry++) {
    await new Promise((r) => setTimeout(r, 2000 * retry));
    res = await send();
  }
  if (res.status === 400 && thinkingOff && /thinking/i.test(await res.clone().text())) { thinkingOff = false; res = await send(); }
  if (res.status === 404) {
    const alt = pickKimiModel(await kimiModels(key));
    console.error(`  Kimi: модели ${model} нет, беру ${alt ?? '—'}`);
    if (alt && alt !== model) { replaced.set(String(body.model), alt); model = alt; res = await send(); }
  }
  if (!res.ok) throw new Error(`Kimi ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return (await res.json()) as KimiResponse;
}
