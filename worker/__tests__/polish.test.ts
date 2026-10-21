// Описания карточек: аккуратная обрезка и работа без ключа Kimi.
import { guessLang, LANG_TAG, polishAbouts, tidy } from '../src/polish.ts';

describe('описания карточек', () => {
  it('обрезка — по границе предложения, без обрыва слова', () => {
    const long = 'Первое предложение про концерт. '.repeat(40);
    const t = tidy(long, 200);
    expect(t.length).toBeLessThanOrEqual(200);
    expect(t.endsWith('.')).toBe(true);
    expect(tidy('Коротко.', 200)).toBe('Коротко.');
  });
  it('без ключа Kimi остаётся исходный текст, аккуратно обрезанный', async () => {
    const found = [{ title: 'Джаз', url: 'u', about: 'Слово '.repeat(400) } as never];
    const r = await polishAbouts(found, '');
    expect(r.polished).toBe(0);
    expect((found[0] as { about: string }).about.length).toBeLessThanOrEqual(701);
  });
});

describe('язык события', () => {
  it('казахские буквы — на казахском, латиница — на английском', () => {
    expect(guessLang('Қазақ әні кеші: Абай өлеңдері')).toBe('kk');
    expect(guessLang('Stand-up comedy night in English with the best comedians of the city, open mic after the show')).toBe('en');
    expect(guessLang('Джаз во дворе')).toBe('ru');
    expect(LANG_TAG.kk).toBe('на казахском');
  });
});
