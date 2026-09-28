// Web: mapbox-gl. Пины — обычные React-компоненты, смонтированные в DOM-маркеры Mapbox.
// Сама библиотека (~1 МБ) грузится отдельным куском после первого экрана — запуск быстрее (npm run perf).
import 'mapbox-gl/dist/mapbox-gl.css';
import type mapboxgl from 'mapbox-gl';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { StyleSheet, View } from 'react-native';
import { config } from '../lib/config';
import { StaticMap } from './StaticMap';
import { mapStyle } from './style';
import type { MapCanvasHandle, MapCanvasProps } from './types';

function webglOk(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

export const MapCanvas = forwardRef<MapCanvasHandle, MapCanvasProps>(function MapCanvas(props, ref) {
  const { theme, camera, markers, onMode, bottomInset = 0 } = props;
  const host = useRef<HTMLDivElement | null>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const staticRef = useRef<MapCanvasHandle>(null);
  const elements = useRef(new Map<string, { el: HTMLDivElement; marker: mapboxgl.Marker }>());
  const [failed, setFailed] = useState(() => typeof document === 'undefined' || !config.mapboxToken || !webglOk());
  const [, setTick] = useState(0);
  const [ready, setReady] = useState(false);
  const gl = useRef<typeof mapboxgl | null>(null);

  useImperativeHandle(ref, () => ({
    flyTo: (lat, lon, zoom) => {
      if (map.current) map.current.easeTo({ center: [lon, lat], zoom: zoom ?? map.current.getZoom(), duration: 600 });
      else staticRef.current?.flyTo(lat, lon, zoom);
    },
  }));

  useEffect(() => {
    if (failed || !host.current) { onMode?.('static'); return; }
    let cancelled = false;
    let cleanup: (() => void) | undefined;
    import('mapbox-gl').then(({ default: lib }) => {
      if (cancelled || !host.current) return;
      gl.current = lib;
      lib.accessToken = config.mapboxToken;
      let m: mapboxgl.Map;
      try {
        m = new lib.Map({
          container: host.current,
          style: mapStyle(theme) as unknown as mapboxgl.Style,
          center: [camera.lon, camera.lat],
          zoom: camera.zoom,
          attributionControl: false,
          pitchWithRotate: false,
          dragRotate: false,
        });
      } catch {
        setFailed(true);
        return;
      }
      m.addControl(new lib.AttributionControl({ compact: true }), 'bottom-left');
      host.current.querySelectorAll<HTMLElement>('.mapboxgl-ctrl-bottom-left, .mapboxgl-ctrl-bottom-right').forEach((el) => { el.style.bottom = `${bottomInset}px`; });
      m.touchZoomRotate.disableRotation();
      map.current = m;
      setReady(true);
      const els = elements.current;
      // Нет сети или токен не пустили: через 8 с без загруженного стиля — подложка.
      const t = setTimeout(() => { if (!m.isStyleLoaded()) setFailed(true); }, 8000);
      m.on('load', () => { clearTimeout(t); onMode?.('mapbox'); });
      m.on('error', (e: { error?: unknown }) => {
        const status = (e.error as { status?: number } | undefined)?.status;
        if (status === 401 || status === 403) setFailed(true);
      });
      cleanup = () => { clearTimeout(t); m.remove(); map.current = null; els.clear(); };
    }).catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; cleanup?.(); };
    // Камера и тема применяются отдельно, пересоздавать карту не нужно.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [failed]);

  useEffect(() => { map.current?.setStyle(mapStyle(theme) as unknown as mapboxgl.Style); }, [theme]);

  useEffect(() => {
    host.current?.querySelectorAll<HTMLElement>('.mapboxgl-ctrl-bottom-left, .mapboxgl-ctrl-bottom-right')
      .forEach((el) => { el.style.bottom = `${bottomInset}px`; });
  }, [bottomInset, failed]);

  // Синхронизация маркеров: создаём DOM-элементы, контент рендерим порталом.
  useEffect(() => {
    const m = map.current;
    const lib = gl.current;
    if (!m || !lib || !ready) return;
    const seen = new Set<string>();
    for (const mk of markers) {
      seen.add(mk.id);
      let entry = elements.current.get(mk.id);
      if (!entry) {
        const el = document.createElement('div');
        el.style.width = '0';
        el.style.height = '0';
        const marker = new lib.Marker({ element: el, anchor: 'center' }).setLngLat([mk.lon, mk.lat]).addTo(m);
        entry = { el, marker };
        elements.current.set(mk.id, entry);
      } else {
        entry.marker.setLngLat([mk.lon, mk.lat]);
      }
      entry.el.style.zIndex = String(mk.z ?? 0);
    }
    for (const [id, entry] of elements.current) {
      if (!seen.has(id)) { entry.marker.remove(); elements.current.delete(id); }
    }
    setTick((x) => x + 1);
  }, [markers, ready]);

  if (failed) return <StaticMap ref={staticRef} {...props} />;

  return (
    <View style={StyleSheet.absoluteFill}>
      <div ref={host} style={{ position: 'absolute', inset: 0 }} />
      {markers.map((mk) => {
        const entry = elements.current.get(mk.id);
        return entry ? createPortal(mk.node, entry.el, mk.id) : null;
      })}
    </View>
  );
});
