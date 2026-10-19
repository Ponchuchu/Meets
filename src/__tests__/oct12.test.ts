import { sourceLines } from '../../worker/src/robot';
import { cleanTitle } from '../admin/api';
import { sourceLabel } from '../admin/model';
import { describeRun, keyStatuses, keyHelp } from '../admin/runStats';
import { activeSources, elapsed, isReliable, searchProblem, sourceResults } from '../admin/rules';

const ok = { sources: 'sites' as const, model: 'gemini-2.5-flash', topics: ['music'], days: 7 };
const future = new Date(Date.now() + 86400e3).toISOString();

describe('условия запуска поиска', () => {
  it('«Скрипт» не требует ни модели, ни тем', () => {
    expect(searchProblem({ ...ok, model: '', topics: [] })).toBeNull();
  });
  it('ИИ и «Оба» требуют модель и хотя бы одну тему', () => {
    expect(searchProblem({ ...ok, sources: 'ai', topics: [] })).toMatch(/тему/);
    expect(searchProblem({ ...ok, sources: 'all', model: 'gpt-4' })).toMatch(/модель/);
    expect(searchProblem({ ...ok, sources: 'all' })).toBeNull();
  });
  it('период — от 1 до 30 дней', () => {
    expect(searchProblem({ ...ok, days: 0 })).toMatch(/Период/);
    expect(searchProblem({ ...ok, days: 31 })).toMatch(/Период/);
    expect(searchProblem({ ...ok, days: 30 })).toBeNull();
  });
  it('что читает поиск', () => {
    expect(activeSources('sites', 'gemini-2.5-flash')).toEqual(['Яндекс Афиша', 'Sxodim']);
    expect(activeSources('ai', 'kimi-k2.6')).toEqual(['ИИ · Kimi']);
    expect(activeSources('all', 'gemini-2.5-flash')).toHaveLength(3);
  });
});

describe('«надёжные»', () => {
  const base = { flags: [], confidence: 95, source: 'SXODIM', startsAt: future };
  it('без пометок, 90%+, в будущем', () => expect(isReliable(base)).toBe(true));
  it('с пометкой, низкой уверенностью, из прошлого, от человека — нет', () => {
    expect(isReliable({ ...base, flags: ['needs_pin'] })).toBe(false);
    expect(isReliable({ ...base, confidence: 80 })).toBe(false);
    expect(isReliable({ ...base, startsAt: '2020-01-01T10:00:00Z' })).toBe(false);
    expect(isReliable({ ...base, source: 'ПРЕДЛОЖИЛ ПОЛЬЗОВАТЕЛЬ · ДАНИЛ', confidence: null })).toBe(false);
  });
  it('событие, прочитанное кодом (без процента), надёжное', () => expect(isReliable({ ...base, confidence: null })).toBe(true));
});

describe('итог по источникам', () => {
  it('из лога робота', () => {
    const log = `  Яндекс Афиша: 18 событий с 2026-10-12 (4 с)\n  ✕ Sxodim: timeout\nИИ нашёл 12 (30 с), после проверки страниц 9. Расход: ...`;
    expect(sourceLines(log)).toEqual(['Источник · Яндекс Афиша · 18', 'Источник · Sxodim · не открылся', 'Источник · ИИ-поиск · 9 из 12']);
  });
  it('в панели порядок как в запуске, ошибки помечены', () => {
    const r = sourceResults([{ text: 'Источник · Sxodim · не открылся' }, { text: 'Источник · Яндекс Афиша · 18' }, { text: 'Готово' }]);
    expect(r).toEqual([{ name: 'Яндекс Афиша', result: '18', bad: false }, { name: 'Sxodim', result: 'не открылся', bad: true }]);
  });
  it('таймер', () => {
    expect(elapsed('2026-10-12T10:00:00Z', Date.parse('2026-10-12T10:01:05Z'))).toBe('1:05');
    expect(elapsed('2026-10-12T10:00:00Z', Date.parse('2026-10-12T09:59:00Z'))).toBe('0:00');
  });
});

describe('название события', () => {
  it('чистит пробелы и проверяет длину', () => {
    expect(cleanTitle('  Джаз   во дворе ')).toBe('Джаз во дворе');
    expect(cleanTitle(' а ')).toBeNull();
    expect(cleanTitle('я'.repeat(121))).toBeNull();
    expect(cleanTitle('я'.repeat(120))).not.toBeNull();
  });
});

describe('афиши в «Новые»: источник и «надёжные»', () => {
  it('подпись источника без города, поиск — «ИИ-поиск»', () => {
    expect(sourceLabel('site', 'afisha.yandex.kz/almaty', 'Яндекс Афиша · Алматы')).toBe('ЯНДЕКС АФИША');
    expect(sourceLabel('site', 'sxodim.com/almaty', 'Sxodim · Алматы')).toBe('SXODIM');
    expect(sourceLabel('search', 'gemini', 'Поиск · ИИ')).toBe('ИИ-ПОИСК');
    expect(sourceLabel('telegram', 'afisha_almaty', '')).toBe('TELEGRAM · @AFISHA_ALMATY');
  });
  // В базе уверенность хранится долей (0.9, 0.95, 0.85), в панели — Math.round(x * 100).
  const pct = (x: number) => Math.round(x * 100);
  const row = { flags: [] as never[], source: 'SXODIM', startsAt: future };
  it('афиша 90% и два сайта 95% проходят, ИИ-поиск 85% и Telegram-эвристики — нет', () => {
    expect(isReliable({ ...row, confidence: pct(0.9) })).toBe(true);
    expect(isReliable({ ...row, source: 'ЯНДЕКС АФИША', confidence: pct(0.95) })).toBe(true);
    expect(isReliable({ ...row, source: 'ИИ-ПОИСК', confidence: pct(0.85) })).toBe(false);
    expect(isReliable({ ...row, source: 'TELEGRAM · @AFISHA_ALMATY', confidence: pct(0.7) })).toBe(false);
  });
  it('любая пометка (точка, цена, отмена) — не надёжное, даже при 95%', () => {
    for (const f of ['needs_pin', 'check_price', 'cancel_reported'] as const) expect(isReliable({ ...row, confidence: 95, flags: [f] as never[] })).toBe(false);
  });
  it('идущая выставка (началась давно, не закончилась) — надёжное; закончившаяся — нет', () => {
    const past = '2026-01-01T10:00:00Z';
    expect(isReliable({ ...row, confidence: 90, startsAt: past, endsAt: future })).toBe(true);
    expect(isReliable({ ...row, confidence: 90, startsAt: past, endsAt: '2026-01-05T10:00:00Z' })).toBe(false);
    expect(isReliable({ ...row, confidence: 90, startsAt: past })).toBe(false);
  });
});

// Данные взяты из настоящей базы (запуск 11 октября, вход по расписанию).
describe('итог настоящего запуска', () => {
  const stats = { kept: 40, queue: { past: 0, added: 3, needPin: 0, unclear: 0, published: 0, withPhoto: 3, withPoint: 3, withPrice: 3, duplicates: 37 }, merged: 6, purged: 0, outside: 75,
    sources: [{ ok: true, name: 'Яндекс Афиша', found: 65 }, { ok: true, name: 'Sxodim', found: 79 }],
    telegram: [{ name: 'Telegram @afisha_almaty', posts: 0, events: 0, ad: 0, meme: 0, notAlmaty: 0, duplicates: 0, cancels: 0, unclear: 0 }] };
  it('главное — одной строкой, плитки, шаги и Telegram без постов', () => {
    const v = describeRun(stats)!;
    expect(v.headline).toBe('Новых в очереди: 3');
    expect(v.tiles.map((t) => t.n)).toEqual(['3', 'все 3', 'все 3', 'все 3']);
    expect(v.steps[0]).toBe('Прочитано: Яндекс Афиша 65 · Sxodim 79');
    expect(v.steps).toContain('Дата вне периода: 75');
    expect(v.telegram).toEqual(['Telegram @afisha_almaty: новых постов нет']);
    expect(v.tips.filter((t) => t.tone === 'error')).toHaveLength(0);
  });
  it('повторный запуск: ничего нового, но всё уже прочитано раньше — так и пишем', () => {
    const v = describeRun({ ...stats, queue: { ...stats.queue, added: 0, duplicates: 0, withPhoto: 0, withPoint: 0, withPrice: 0 } })!;
    expect(v.headline).toBe('Новых событий нет');
    expect(v.sub).toBe('Все 40 найденных уже были в базе или в прошлых запусках.');
  });
  it('ключи из журнала: Kimi и Gemini есть, у Claude ключа нет', () => {
    const k = keyStatuses([{ text: 'Ключ · Kimi · есть, баланс 12.27' }, { text: 'Ключ · Anthropic (Claude) · нет' }, { text: 'Ключ · Gemini · есть' }]);
    expect(k.map((x) => [x.name, x.ok, x.note])).toEqual([['Kimi', true, 'баланс 12.27'], ['Anthropic (Claude)', false, ''], ['Gemini', true, '']]);
    expect(keyHelp(k[0])).toBeNull();
    expect(keyHelp(k[1])).toMatch(/ANTHROPIC_API_KEY/);
  });
});
