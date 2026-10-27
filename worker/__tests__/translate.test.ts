import { chunks, detectLang, parseTranslation, translateKk } from '../src/translate.ts';

describe('язык карточки', () => {
  it('казахское название — kk, русское — ru, английское — en', () => {
    expect(detectLang('Алматы Аренада ARO концерті өтеді')).toBe('kk');
    expect(detectLang('Тотальный театр: Гретель und Гензель', 'Спектакль для всей семьи')).toBe('ru');
    expect(detectLang('Zumba party', 'Join us for an evening of music and dance with the best DJs in the city')).toBe('en');
  });
  it('русское описание с казахским словом остаётся русским', () => {
    expect(detectLang('Концерт Тыныш', 'Большой вечер музыки в Алматы. Билеты на сайте, вход с 6 лет, начало в 19:00, двери в 18:00, парковка рядом. Қош келдіңіздер')).toBe('ru');
  });
});

describe('перевод', () => {
  const src = { title: 'ARO концерті', about: 'Сүйікті әндер мен ерекше әсерге толы ұмытылмас кеш. Билеттер сайтта.' };
  it('достаёт JSON из ответа модели', () => {
    expect(parseTranslation('Вот перевод:\n```json\n{"title":"Концерт ARO","about":"Любимые песни и незабываемый вечер, полный ярких впечатлений. Билеты на сайте."}\n```', src))
      .toEqual({ title: 'Концерт ARO', about: 'Любимые песни и незабываемый вечер, полный ярких впечатлений. Билеты на сайте.' });
  });
  it('не принимает пустое, обрезанное и непереведённое', () => {
    expect(parseTranslation('не JSON', src)).toBeNull();
    expect(parseTranslation('{"title":"","about":"x"}', src)).toBeNull();
    expect(parseTranslation('{"title":"Концерт ARO","about":"Вечер"}', src)).toBeNull();
    expect(parseTranslation('{"title":"ARO концерті","about":"Сүйікті әндер мен ерекше әсерге толы ұмытылмас кеш өтеді"}', src)).toBeNull();
  });
  it('длинный текст режется по абзацам', () => {
    const text = Array.from({ length: 6 }, (_, i) => `${i}`.repeat(700)).join('\n');
    const parts = chunks(text, 1500);
    expect(parts.length).toBe(3);
    expect(parts.every((p) => p.length <= 1500)).toBe(true);
    expect(parts.join('\n')).toBe(text);
  });
  it('цепочка: Gemini ответил — дальше не идём', async () => {
    const realFetch = globalThis.fetch;
    const calls: string[] = [];
    globalThis.fetch = (async (u: string) => {
      calls.push(String(u));
      return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: '{"title":"Концерт ARO","about":"Любимые песни и незабываемый вечер, полный ярких впечатлений. Билеты на сайте."}' }] } }] }) };
    }) as unknown as typeof fetch;
    try {
      const r = await translateKk(src, { GEMINI_API_KEY: 'k' });
      expect(r?.by).toBe('Gemini');
      expect(calls).toHaveLength(1);
    } finally { globalThis.fetch = realFetch; }
  });
});
