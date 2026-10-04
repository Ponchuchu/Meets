import type { ReactNode } from 'react';
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
}

export interface MapCanvasHandle {
  flyTo: (lat: number, lon: number, zoom?: number) => void;
  /** Кнопки «+» и «−»: приблизить или отдалить на шаг. */
  zoomBy: (delta: number) => void;
}

// Алматы: стартовая камера — центр так, чтобы джаз на Панфилова был посередине, как в макете.
export const ALMATY_CAMERA: Camera = { lat: 43.2579, lon: 76.9458, zoom: 13.4 };
