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

/** Место из справочника (Overture): рисуется слоем карты, а не отдельным элементом — дёшево и при сотне точек. */
export interface MapPlace { id: string; lat: number; lon: number; kind: string; name: string }

/** Цвет точки места по виду — те же тона, что у категорий событий. */
export const PLACE_COLORS: Record<string, string> = {
  cafe: '#B5651D', food: '#D9822B', bar: '#7A3E9D', cinema: '#2447B8', culture: '#5B5BD6', park: '#2F8F5B',
  sport: '#1F9AA8', sight: '#C98A1B', fun: '#E0457B', mall: '#2447B8',
};

export interface MapCanvasProps {
  theme: MapTheme;
  camera: Camera;
  /** Вкладка карты не на экране: карта жива, но рисует раз в секунду (не греет телефон). */
  hidden?: boolean;
  /** Главная карта: при повторном открытии вкладки — там, где её оставили, а не на стартовой точке. */
  remember?: boolean;
  markers: MapMarker[];
  /** Объёмные значки событий, мест и ТРЦ (FIX5): на телефоне — слой самой карты, не отстают при вращении. */
  symbols?: import('./symbols').MapSymbol[];
  onSymbol?: (id: string) => void;
  threeD?: boolean;
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
  /** Граница выбранного парка или места: полупрозрачная заливка и контур (27 окт.). */
  zone?: [number, number][] | null;
  lines?: { id: string; coords: [number, number][]; color: string; width?: number; dash?: boolean }[];
  /** Тап по пустой карте (не по точке) — закрыть шторку события. */
  onPress?: (point?: { lat: number; lon: number }) => void;
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
  /** «В путь»: моя точка — стрелка навигатора, лежит на карте и смотрит по ходу движения. */
  meArrow?: boolean;
  /** Места в кадре (с 15-го масштаба) и тап по месту. */
  places?: MapPlace[];
  onPlace?: (id: string) => void;
  /** Карту двигают пальцем (true) / остановилась (false) — булавка «Новой встречи» приподнимается. */
  onMoving?: (moving: boolean) => void;
  /** Неподвижная мини-карта (карточка события): без жестов, с наклоном камеры. */
  still?: { pitch: number; heading: number };
}

export interface MapCanvasHandle {
  fitBounds?: (coords: [number, number][], padding: { top: number; right: number; bottom: number; left: number }) => void;
  /** Камера навигатора: zoom и pitch — по скорости (FIX3), по умолчанию 17 и 60. */
  navigateTo: (lat: number, lon: number, heading: number, zoom?: number, pitch?: number) => void;
  flyTo: (lat: number, lon: number, zoom?: number, durationMs?: number) => void;
  /** Кнопки «+» и «−»: приблизить или отдалить на шаг. */
  zoomBy: (delta: number) => void;
  /** Компас: повернуть карту севером вверх. */
  north: () => void;
}

// Алматы: стартовая камера — центр так, чтобы джаз на Панфилова был посередине, как в макете.
/** Карта всегда объёмная: наклон камеры, градусы (дома и горы — в стиле, src/map/style.ts). */
export const TILT_PITCH = 50;

export const ALMATY_CAMERA: Camera = { lat: 43.2579, lon: 76.9458, zoom: 13.4 };
