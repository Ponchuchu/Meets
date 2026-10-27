import { cleanAbout, cleanTitle, looksKazakh, stripEmoji } from '../lib/cleanText';

describe('очистка текста карточек', () => {
  it('эмодзи убираются', () => {
    expect(stripEmoji('🏔️ Скай шыңы 📅')).toBe('Скай шыңы');
    expect(cleanTitle('😊 «Психологические защиты»')).toBe('«Психологические защиты»');
  });
  it('повторы названия, даты, времени, места и цены уходят из описания', () => {
    const about = '🏔️ Скай шыңы / Пик Скай / Sky Peak\n📅 31 қазан / 31 октября (суббота) / October 31\n📍 Медеу субұрқақ / фонтан на Медеу\n⏰ 07:00\n💸 Тегін / Бесплатно / Free\n\nОтмечаем Хэллоуин вместе, приходите в костюмах и масках 🎃\n\nҚатысу / Заявка / Apply: https://kudaidem.kz';
    const out = cleanAbout(about, 'Скай шыңы / Пик Скай / Sky Peak');
    expect(out).toContain('Отмечаем Хэллоуин');
    expect(out).not.toMatch(/07:00|31 октября|Sky Peak|🎃|Тегін/);
  });
  it('если после чистки пусто — остаётся исходный текст без эмодзи', () => {
    expect(cleanAbout('📅 31 октября', 'x')).toBe('31 октября');
  });
  it('казахский текст узнаётся, русский нет', () => {
    expect(looksKazakh('Концерт Ани Лорак өтеді, билеттер сатылымда, қатысыңыз')).toBe(true);
    expect(looksKazakh('Валерий Меладзе впервые за долгое время — в Алматы')).toBe(false);
  });
});
