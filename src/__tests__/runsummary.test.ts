import { activeSources } from '../admin/rules';
import { describeRun, keyHelp, keyStatuses, sourceHow, sourceMark, type RunStats } from '../admin/runStats';

const stats = (over: Partial<RunStats> = {}): RunStats => ({
  window: { from: '2026-10-12', to: '2026-10-19' },
  sources: [{ name: 'Яндекс Афиша', found: 65, ok: true }, { name: 'Sxodim', found: 79, ok: true }],
  outside: 81, merged: 3, kept: 60,
  queue: { added: 28, published: 0, duplicates: 32, unclear: 0, past: 0, withPhoto: 28, withPoint: 28, withPrice: 25, needPin: 0 },
  purged: 0,
  ...over,
});

describe('итог поиска простыми словами', () => {
  it('главное: сколько новых, качество плитками, путь событий по шагам', () => {
    const v = describeRun(stats())!;
    expect(v.headline).toBe('Новых в очереди: 28');
    expect(v.sub).toBe('Ждут проверки в разделе «Новые».');
    expect(v.tiles).toEqual([
      { n: '28', label: 'новых в очереди' },
      { n: 'все 28', label: 'с фото', warn: false },
      { n: 'все 28', label: 'с точкой на карте', warn: false },
      { n: '25 из 28', label: 'с ценой', warn: true },
    ]);
    expect(v.steps).toEqual(['Прочитано: Яндекс Афиша 65 · Sxodim 79', 'Дата вне периода: 81', 'Склеено дублей между сайтами: 3', 'Уже были в базе: 32']);
  });

  it('подсказки «что делать»: без фото, без точки, без цены, сайт не открылся', () => {
    const v = describeRun(stats({
      sources: [{ name: 'Яндекс Афиша', found: 10, ok: true }, { name: 'Sxodim', found: 0, ok: false, error: 'timeout' }],
      queue: { added: 10, published: 0, duplicates: 0, unclear: 0, past: 0, withPhoto: 7, withPoint: 8, withPrice: 6, needPin: 2 },
    }))!;
    const titles = v.tips.map((t) => t.title);
    expect(titles).toEqual(['Sxodim не открылся', '3 события без фото', '2 без точки на карте', '4 без цены']);
    expect(v.tips[0].tone).toBe('error');
    expect(v.tips[2].tone).toBe('warn');
    expect(v.tips[1].hint).toContain('Настройки → Фото событий');
  });

  it('ничего нового: объясняет почему', () => {
    const dup = describeRun(stats({ queue: { added: 0, published: 0, duplicates: 12, unclear: 0, past: 0, withPhoto: 0, withPoint: 0, withPrice: 0, needPin: 0 } }))!;
    expect(dup.headline).toBe('Новых событий нет');
    expect(dup.sub).toBe('Всё найденное уже есть в базе (12).');
    expect(dup.tiles).toHaveLength(1);
  });

  it('сразу опубликованные, чистка просрочки, расход ИИ, фото от ИИ', () => {
    const v = describeRun(stats({
      queue: { added: 5, published: 2, duplicates: 0, unclear: 0, past: 0, withPhoto: 5, withPoint: 5, withPrice: 5, needPin: 0 },
      purged: 14, kimiPhotos: 3,
      ai: { model: 'kimi-k2.6', asked: 6, found: 9, kept: 4, tokensIn: 52000, tokensOut: 9000 },
    }))!;
    expect(v.sub).toBe('Из них сразу на карте: 2. Остальные ждут проверки.');
    expect(v.tips.map((t) => t.title)).toEqual(['Убрано просроченных черновиков: 14', 'ИИ потратил около 61 тыс. токенов', 'ИИ нашёл фото для 3 событий']);
    expect(v.steps).toContain('ИИ-поиск (kimi-k2.6): нашёл 9, прошло проверку 4');
  });

  it('Telegram: реклама и мемы видны отдельно', () => {
    const v = describeRun({ telegram: [{ name: 'Telegram @afisha_almaty', posts: 8, events: 3, ad: 3, meme: 1, notAlmaty: 1, duplicates: 0, cancels: 0, unclear: 0 }, { name: 'Telegram @x', posts: 0, events: 0, ad: 0, meme: 0, notAlmaty: 0, duplicates: 0, cancels: 0, unclear: 0 }] })!;
    expect(v.telegram).toEqual(['Telegram @afisha_almaty: 3 события, реклама 3, мемы 1, не Алматы 1', 'Telegram @x: новых постов нет']);
  });

  it('старый запуск без итогов — null (панель покажет короткую плашку)', () => {
    expect(describeRun(null)).toBeNull();
    expect(describeRun({})).toBeNull();
  });
});

describe('ключи и подключения', () => {
  const lines = [
    { text: 'Ключ · Kimi · есть, баланс 0.30 — мало' }, { text: 'Ключ · Gemini · нет' }, { text: 'Ключ · Anthropic (Claude) · нет' },
    { text: 'Ключ · Kimi · есть, баланс 12.00' }, // старая запись, должна проиграть
    { text: 'Поиск запущен' },
  ];
  it('берёт самую свежую запись по имени, остальное в журнале игнорирует', () => {
    const k = keyStatuses(lines);
    expect(k.map((x) => x.name)).toEqual(['Kimi', 'Gemini', 'Anthropic (Claude)']);
    expect(k[0]).toMatchObject({ ok: true, low: true, note: 'баланс 0.30 — мало' });
    expect(k[1]).toMatchObject({ ok: false, note: '' });
  });
  it('подсказки: что делать, если ключа нет, не принят или мало денег', () => {
    const [kimi, gemini] = keyStatuses(lines);
    expect(keyHelp(kimi)).toContain('platform.moonshot.ai');
    expect(keyHelp(gemini)).toBe('Добавь секрет GEMINI_API_KEY: GitHub → Settings → Secrets → Actions.');
    expect(keyHelp({ name: 'Kimi', ok: false, note: 'не принят' })).toContain('Замени секрет KIMI');
    expect(keyHelp({ name: 'Kimi', ok: true, note: 'баланс 20.00' })).toBeNull();
  });
});

describe('источники', () => {
  it('плашки: Sxodim и Яндекс различаются, а не «ЯА» у всех', () => {
    expect(sourceMark('site', 'Sxodim · Алматы', 'sxodim.com/almaty')).toBe('СХ');
    expect(sourceMark('site', 'Яндекс Афиша · Алматы', 'afisha.yandex.kz/almaty')).toBe('ЯА');
    expect(sourceMark('telegram', 'Telegram · @afisha_almaty')).toBe('TG');
    expect(sourceMark('search', 'Поиск · ИИ')).toBe('ИИ');
  });
  it('как читается: сайты, Telegram и Instagram — скриптом, ИИ-поиск — платно', () => {
    expect(sourceHow('site')).toEqual({ label: 'Код читает афишу сам · без ИИ', free: true });
    expect(sourceHow('telegram').free).toBe(true);
    expect(sourceHow('instagram').free).toBe(true);
    expect(sourceHow('search').free).toBe(false);
  });
  it('что читается при поиске: включённые сайты + Telegram + ИИ', () => {
    expect(activeSources('sites', 'gemini-2.5-flash', ['Sxodim'], true)).toEqual(['Sxodim', 'Telegram']);
    expect(activeSources('all', 'kimi-k2.6', ['Яндекс Афиша'], false)).toEqual(['Яндекс Афиша', 'ИИ · Kimi']);
    expect(activeSources('ai', 'kimi-k2.6', undefined, true)).toEqual(['Telegram', 'ИИ · Kimi']);
  });
});
