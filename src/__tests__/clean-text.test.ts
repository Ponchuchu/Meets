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

describe('площадка и название', () => {
  it('обрывок адреса не название, код убирается из адреса, префикс площадки из названия', () => {
    const { cleanPlaceName, cleanAddress, stripVenuePrefix, cleanAbout } = jest.requireActual('../lib/cleanText') as typeof import('../lib/cleanText');
    expect(cleanPlaceName('36, Алматы')).toBeNull();
    expect(cleanPlaceName('Театр Лермонтова')).toBe('Театр Лермонтова');
    expect(cleanAddress('23b769, 36, Алматы')).toBe('36, Алматы');
    expect(stripVenuePrefix('Театр 2act: Мне не смешно', 'Театр 2act')).toBe('Мне не смешно');
    expect(stripVenuePrefix('Мастер-класс: гончарное дело', 'Театр 2act')).toBe('Мастер-класс: гончарное дело');
    expect(cleanAbout('25 ноября - 20:00\n«Мне не смешно»\nкомедия о цензуре', 'Мне не смешно')).toBe('комедия о цензуре');
  });
});
