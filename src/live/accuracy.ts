// Точность геолокации (21 октября, после жалобы тестера: «окно "разрешите точную геолокацию" всплывает снова и снова»).
// Причина: на Android, если в телефоне выключена «Точность определения местоположения» Google, каждый старт слежения
// показывал системное окно. «Нет» → ошибка → повтор через 5 с → снова окно; само окно уводит приложение в фон,
// при возврате слежение стартует заново — круг без конца, в приложение не войти.
// Теперь системное окно само не всплывает никогда (все запросы — через noDialog). Если точность приблизительная,
// на карте одна мягкая карточка: что даёт точность и что батарея почти не страдает. «Не сейчас» запоминается
// на 30 дней и переживает обновление приложения; системное окно — только по кнопке «Включить точность».
import * as Location from 'expo-location';
import { Linking, Platform } from 'react-native';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { deviceStorage } from '../state/storage';

export const LATER_MS = 30 * 24 * 3600_000;

interface GeoAskState {
  /** Когда сами показали системный запрос разрешения на геолокацию (автоматически — один раз). */
  permAskedAt: number | null;
  /** «Не сейчас» на карточке о точности. */
  laterAt: number | null;
  markPermAsked: () => void;
  later: () => void;
}

export const useGeoAsk = create<GeoAskState>()(persist(
  (set) => ({
    permAskedAt: null,
    laterAt: null,
    markPermAsked: () => set({ permAskedAt: Date.now() }),
    later: () => set({ laterAt: Date.now() }),
  }),
  { name: 'ryadom-geo-ask', storage: deviceStorage(), partialize: (s) => ({ permAskedAt: s.permAskedAt, laterAt: s.laterAt }) as GeoAskState },
));

/** Любые опции геолокации — без системного окна Google «Повысить точность». */
export const noDialog = <T extends object>(o: T): T & { mayShowUserSettingsDialog: false } => ({ ...o, mayShowUserSettingsDialog: false });

export type Precision = 'precise' | 'approx' | 'none';

/** Точная ли геолокация: разрешение «Точно» и включённая точность Google (сеть + GPS). */
export async function precision(): Promise<Precision> {
  const perm = await Location.getForegroundPermissionsAsync().catch(() => null);
  if (!perm?.granted) return 'none';
  if (Platform.OS !== 'android') return 'precise';
  if (perm.android?.accuracy === 'coarse') return 'approx';
  const st = await Location.getProviderStatusAsync().catch(() => null);
  return st && st.networkAvailable === false ? 'approx' : 'precise';
}

/** Показывать ли карточку о точности: приблизительно и «Не сейчас» не нажимали последние 30 дней. */
export const shouldExplain = (p: Precision, laterAt: number | null, now = Date.now()) =>
  p === 'approx' && (laterAt == null || now - laterAt > LATER_MS);

/** Автоматически спросить разрешение можно только раз; дальше — только по кнопке. */
export const mayAutoAsk = (permAskedAt: number | null) => permAskedAt == null;

/** Кнопка «Включить точность»: сначала разрешение «Точно», затем — точность Google. Только по нажатию. */
export async function improveAccuracy(): Promise<Precision> {
  const perm = await Location.getForegroundPermissionsAsync().catch(() => null);
  if (perm?.granted && perm.android?.accuracy === 'coarse') {
    if (perm.canAskAgain) await Location.requestForegroundPermissionsAsync().catch(() => null);
    else await Linking.openSettings().catch(() => undefined);
  } else if (perm?.granted) {
    await Location.enableNetworkProviderAsync().catch(() => undefined);
  }
  return precision();
}
