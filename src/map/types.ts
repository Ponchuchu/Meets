import type { ReactNode } from 'react';
import type { SharedValue } from 'react-native-reanimated';
import type { MapTheme } from '../theme';

export interface MapMarker {
  id: string;
  lat: number;
  lon: number;
  node: ReactNode;
  z?: number;
}

export interface Camera {
  lat: number;
  lon: number;
  zoom: number;
}

export interface MapCanvasProps {
  theme: MapTheme;
  camera: Camera;
  markers: MapMarker[];
  /** Сообщает, получилось ли показать настоящую карту (false — работает подложка). */
  onMode?: (mode: 'mapbox' | 'static') => void;
  /** Отступ снизу для кнопки атрибуции Mapbox — чтобы её не закрывала карточка. */
  bottomInset?: number;
  /** Масштаб карты меняется — пины подстраивают размер и подписи. */
  onZoom?: (zoom: number) => void;
  /** Центр карты после перемещения — для выбора точки «как в доставке». */
  onCenter?: (lat: number, lon: number) => void;
  /** Показать мою точку (синяя с направлением). Разрешение на геолокацию спрашивает экран. */
  showUser?: boolean;
  /** Отступ сверху для кнопки «i» Mapbox — под кнопками верха карты, а не под пальцем. */
  topInset?: number;
  /** Линзы (V6MapLens): плитки пробок и туман «Где я был» (GeoJSON-полигон с дырками). */
  traffic?: string | null;
  fog?: object | null;
  /** Линии маршрута (V6Route): путь [[lon, lat], …], цвет, толщина, пунктир. */
  lines?: { id: string; coords: [number, number][]; color: string; width?: number; dash?: boolean }[];
  /** Тап по пустой карте (не по точке) — закрыть шторку события. */
  onPress?: () => void;
  /** Поворот карты в градусах (0 — север вверх) — для стрелки компаса. */
  onBearing?: (deg: number) => void;
  /** Компас, второй тап: камера следует за мной и поворачивается по направлению телефона. */
  follow?: boolean;
  /** Следование выключилось (человек сдвинул карту). */
  onFollowEnd?: () => void;
  /** Моя точка. На телефоне рисуется слоями самой карты (оранжевая, с конусом направления) — не зависит от маркеров. */
  me?: { lat: number; lon: number } | null;
  /** Куда смотрит телефон, градусы (0 — север). Нет значения — конус не рисуем. */
  meHeading?: SharedValue<number>;
}

export interface MapCanvasHandle {
  navigateTo: (lat: number, lon: number, heading: number) => void;
  flyTo: (lat: number, lon: number, zoom?: number, durationMs?: number) => void;
  /** Кнопки «+» и «−»: приблизить или отдалить на шаг. */
  zoomBy: (delta: number) => void;
  /** Компас: повернуть карту севером вверх. */
  north: () => void;
}

// Алматы: стартовая камера — центр так, чтобы джаз на Панфилова был посередине, как в макете.
export const ALMATY_CAMERA: Camera = { lat: 43.2579, lon: 76.9458, zoom: 13.4 };
