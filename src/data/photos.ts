// Фото для демо-данных из design/assets. Ключ — имя файла без расширения.
import type { ImageSourcePropType } from 'react-native';

export const photos: Record<string, ImageSourcePropType> = {
  danil: require('../../design/assets/danil.jpg'),
  igor: require('../../design/assets/igor.jpg'),
  igor1: require('../../design/assets/igor1.jpg'),
  igor2: require('../../design/assets/igor2.jpg'),
  igor3: require('../../design/assets/igor3.jpg'),
  igor4: require('../../design/assets/igor4.jpg'),
  denis: require('../../design/assets/denis.jpg'),
  anton: require('../../design/assets/anton.jpg'),
  ainura: require('../../design/assets/ainura.jpg'),
  hike: require('../../design/assets/hike.jpg'),
  krug: require('../../design/assets/krug.jpg'),
};

/** Ключ демо-фото ('igor') или адрес картинки (галерея, Storage). */
export function photo(key: string | null | undefined): ImageSourcePropType | undefined {
  if (!key) return undefined;
  return photos[key] ?? remote(key);
}

/** Wikimedia отклоняет запросы без подписи приложения (их правила User-Agent) — фото мест подписываем. */
const UA = { 'User-Agent': 'Ryadom/1.0 (Almaty events app; https://ryadom.app)' };
export function remote(uri: string): ImageSourcePropType {
  return uri.includes('wikimedia.org') ? { uri, headers: UA } : { uri };
}
