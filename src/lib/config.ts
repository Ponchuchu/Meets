// Публичные ключи. Переменные окружения EXPO_PUBLIC_* важнее файла config/public-keys.json.
import keys from '../../config/public-keys.json';

export const config = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL || keys.supabaseUrl,
  supabaseKey: process.env.EXPO_PUBLIC_SUPABASE_KEY || keys.supabasePublishableKey,
  mapboxToken: process.env.EXPO_PUBLIC_MAPBOX_TOKEN || keys.mapboxPublicToken,
  /** 'demo' — принудительно без сети; 'auto' — Supabase, при ошибке демо. */
  dataMode: (process.env.EXPO_PUBLIC_DATA_MODE as 'demo' | 'auto' | undefined) || 'auto',
};

/** Адрес для ссылок «Поделиться»: страница события открывает приложение или web-версию. */
export const APP_URL = process.env.EXPO_PUBLIC_APP_URL || 'https://ryadom.app';
