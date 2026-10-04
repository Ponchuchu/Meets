// Публичные ключи. Переменные окружения EXPO_PUBLIC_* важнее файла config/public-keys.json.
import keys from '../../config/public-keys.json';

export const config = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL || keys.supabaseUrl,
  supabaseKey: process.env.EXPO_PUBLIC_SUPABASE_KEY || keys.supabasePublishableKey,
  mapboxToken: process.env.EXPO_PUBLIC_MAPBOX_TOKEN || keys.mapboxPublicToken,
  /** 'live' — только настоящая база, без демо (альфа и по умолчанию); 'demo' — макет для тестов и показа;
   *  'auto' — старое поведение: Supabase, при ошибке демо. */
  dataMode: (process.env.EXPO_PUBLIC_DATA_MODE as 'live' | 'demo' | 'auto' | undefined) || 'live',
  /** TomTom: слой «Пробки» (ключ из GitHub TOPTOP_TOKEN при сборке). Нет ключа — слоя нет. */
  tomtomKey: process.env.EXPO_PUBLIC_TOMTOM_KEY || '',
};

/** Адрес для ссылок «Поделиться»: страница события открывает приложение или web-версию. */
export const APP_URL = process.env.EXPO_PUBLIC_APP_URL || 'https://ryadom.app';
