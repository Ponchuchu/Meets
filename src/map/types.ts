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
  /** Отступ снизу для логотипа и атрибуции Mapbox — чтобы их не закрывала карточка (требование Mapbox). */
  bottomInset?: number;
}

export interface MapCanvasHandle {
  flyTo: (lat: number, lon: number, zoom?: number) => void;
}

// Алматы: стартовая камера — центр так, чтобы джаз на Панфилова был посередине, как в макете.
export const ALMATY_CAMERA: Camera = { lat: 43.2579, lon: 76.9458, zoom: 13.4 };
