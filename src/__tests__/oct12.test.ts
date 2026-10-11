import { sourceLines } from '../../worker/src/robot';
import { cleanTitle } from '../admin/api';
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
