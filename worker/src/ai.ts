// ИИ-разбор поста: Claude Haiku 4.5 классифицирует и извлекает поля (tool use = structured output,
// картинки-афиши — vision). Уверенность ниже 0.8 — повтор на Sonnet. Ключ — только в секретах воркера.
// Если ключа Anthropic нет, но есть KIMI_API_KEY — разбирает Kimi (Moonshot, OpenAI-совместимый API, режим JSON).
import { extract } from './heuristics.ts';
import { CATEGORIES, type Extraction, type RawPost } from './types.ts';

export const MODEL_FAST = 'claude-haiku-4-5-20251001';
export const MODEL_STRONG = 'claude-sonnet-5-5';
const RETRY_BELOW = 0.8;

const SCHEMA = {
  type: 'object',
  properties: {
    class: { type: 'string', enum: ['event', 'ad', 'meme', 'not_almaty', 'cancel'], description: 'event — событие в Алматы с датой; ad — реклама; meme — мемы, личное, новости; not_almaty — событие в другом городе; cancel — отмена или перенос события' },
    title: { type: 'string', description: 'Короткое название без эмодзи и кавычек-ёлочек снаружи, до 60 символов' },
    category: { type: 'string', enum: [...CATEGORIES] },
    tags: { type: 'array', items: { type: 'string' }, description: '2–4 тега строчными: «джаз», «для всех», «на улице»' },
    starts_at: { type: ['string', 'null'], description: 'ISO 8601 с поясом +05:00' },
    ends_at: { type: ['string', 'null'] },
    is_long: { type: 'boolean', description: 'выставка, маркет, фестиваль — идёт несколько часов или дней' },
    venue_name: { type: ['string', 'null'] },
    address: { type: ['string', 'null'], description: 'улица и дом; null, если адрес размытый («в центре», «в парке»)' },
    address_note: { type: ['string', 'null'], description: '«3 этаж», «вход со двора»' },
    price_min: { type: ['integer', 'null'] },
    price_max: { type: ['integer', 'null'] },
    is_free: { type: 'boolean' },
    price_unsure: { type: 'boolean', description: 'цена мелким шрифтом, «от», неясна — пусть модератор проверит' },
    about: { type: 'string', description: '2–4 предложения по единому образцу: что будет, для кого, что взять; для походов — сложность и длительность' },
    organizer: { type: ['string', 'null'] },
    confidence: { type: 'number', description: 'уверенность 0–1, что поля верны' },
    cancel_of: { type: ['string', 'null'], description: 'для cancel — название отменённого события' },
  },
  required: ['class', 'title', 'category', 'tags', 'starts_at', 'ends_at', 'is_long', 'venue_name', 'address', 'address_note', 'price_min', 'price_max', 'is_free', 'price_unsure', 'about', 'organizer', 'confidence', 'cancel_of'],
};

const SYSTEM = `Ты разбираешь посты городских афиш Алматы для приложения «рядом.» — карты событий.
Верни поля через инструмент event_card. Время — по Алматы (+05:00). Если год не указан — ближайшая будущая дата после даты поста.
Описание пиши нейтрально, без восклицаний и эмодзи, по-русски. Не выдумывай то, чего нет в посте или на афише.`;

async function ask(model: string, post: RawPost, key: string): Promise<Extraction> {
  const content: unknown[] = post.images.slice(0, 2).map((url) => ({ type: 'image', source: { type: 'url', url } }));
  content.push({ type: 'text', text: `Пост от ${post.postedAt ?? 'неизвестно когда'} (${post.url}):\n\n${post.text}` });
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      system: SYSTEM,
      tools: [{ name: 'event_card', description: 'Черновик карточки события', input_schema: SCHEMA }],
      tool_choice: { type: 'tool', name: 'event_card' },
      messages: [{ role: 'user', content }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const body = (await res.json()) as { content: { type: string; input?: Extraction }[] };
  const out = body.content.find((c) => c.type === 'tool_use')?.input;
  if (!out) throw new Error('Anthropic: нет ответа инструмента');
  return out;
}

const KIMI_BASE = process.env.KIMI_BASE_URL || 'https://api.moonshot.ai/v1';
let kimiModel: string | null = process.env.KIMI_MODEL || null;

/** Модель Kimi: из KIMI_MODEL или самая новая из списка аккаунта (k3 → k2 → первая текстовая). */
async function pickKimiModel(key: string): Promise<string> {
  if (kimiModel) return kimiModel;
  const res = await fetch(`${KIMI_BASE}/models`, { headers: { authorization: `Bearer ${key}` } });
  if (!res.ok) throw new Error(`Kimi models ${res.status}`);
  const ids = ((await res.json()) as { data: { id: string }[] }).data.map((m) => m.id).filter((id) => !/vision|embed|audio/i.test(id));
  kimiModel = ids.find((id) => /k3/i.test(id)) ?? ids.find((id) => /k2/i.test(id)) ?? ids[0];
  if (!kimiModel) throw new Error('Kimi: нет доступных моделей');
  return kimiModel;
}

/** Kimi отвечает JSON-объектом по той же схеме, что и инструмент Claude. */
export async function askKimi(post: RawPost, key: string): Promise<Extraction> {
  const model = await pickKimiModel(key);
  const res = await fetch(`${KIMI_BASE}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: `${SYSTEM.replace('через инструмент event_card', 'одним JSON-объектом')}\nСхема ответа (JSON Schema): ${JSON.stringify(SCHEMA)}\nРеклама, скидки, промокоды, розыгрыши, мемы — class ad или meme. Бесплатное событие с датой и местом — event.` },
        { role: 'user', content: `Пост от ${post.postedAt ?? 'неизвестно когда'} (${post.url}):\n\n${post.text}` },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Kimi ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const body = (await res.json()) as { choices: { message: { content: string } }[] };
  const raw = body.choices[0]?.message.content ?? '';
  const json = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1)) as Partial<Extraction>;
  if (!json.class || !json.title) throw new Error('Kimi: неполный ответ');
  return { ...extract(post.text, post.postedAt), ...json } as Extraction;
}

/** Разбор поста. Без ключа или при ошибке API — эвристики (они не публикуют сами: уверенность < 0.9). */
export async function understand(post: RawPost, key = process.env.ANTHROPIC_API_KEY, kimiKey = process.env.KIMI_API_KEY): Promise<Extraction & { by: 'ai' | 'heuristics' }> {
  if (!key && kimiKey) {
    try { return { ...(await askKimi(post, kimiKey)), by: 'ai' }; } catch (err) {
      console.warn(`  Kimi недоступен (${(err as Error).message}) — эвристики`);
      return { ...extract(post.text, post.postedAt), by: 'heuristics' };
    }
  }
  if (!key) return { ...extract(post.text, post.postedAt), by: 'heuristics' };
  try {
    let out = await ask(MODEL_FAST, post, key);
    if (out.class === 'event' && out.confidence < RETRY_BELOW) out = await ask(MODEL_STRONG, post, key);
    return { ...out, by: 'ai' };
  } catch (err) {
    console.warn(`  ИИ недоступен (${(err as Error).message}) — эвристики`);
    return { ...extract(post.text, post.postedAt), by: 'heuristics' };
  }
}
