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
import { NO_PLACES, placesGeo } from './placesGeo';
import { TILT_PITCH, type MapCanvasHandle, type MapCanvasProps } from './types';

function webglOk(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

const asUri = (m: unknown) => (typeof m === 'string' ? m : (m as { uri?: string; default?: string })?.uri ?? (m as { default?: string })?.default ?? '');
const WEB_IMAGES: Record<string, string> = { tree: asUri(require('../../assets/map/tree.png')), pine: asUri(require('../../assets/map/pine.png')) };

export const MapCanvas = forwardRef<MapCanvasHandle, MapCanvasProps>(function MapCanvas(props, ref) {
  const { theme, camera, markers, onMode, onZoom, onCenter, bottomInset = 0, traffic, fog, lines, onPress, onBearing } = props;
  const threeD = props.threeD !== false;
  const host = useRef<HTMLDivElement | null>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const staticRef = useRef<MapCanvasHandle>(null);
  const elements = useRef(new Map<string, { el: HTMLDivElement; marker: mapboxgl.Marker }>());
  const [failed, setFailed] = useState(() => typeof document === 'undefined' || !config.mapboxToken || !webglOk());
  const [, setTick] = useState(0);
  const [ready, setReady] = useState(false);
  const gl = useRef<typeof mapboxgl | null>(null);
  const onPressRef = useRef(onPress);
  const places = props.places ?? NO_PLACES;
  const onPlaceRef = useRef(props.onPlace);
  useEffect(() => { onPlaceRef.current = props.onPlace; }, [props.onPlace]);

  useEffect(() => { onPressRef.current = onPress; }, [onPress]);

  useImperativeHandle(ref, () => ({
    fitBounds: (coords, padding) => {
      if (!coords.length) return;
      const lons=coords.map(c=>c[0]), lats=coords.map(c=>c[1]);
      if (map.current) map.current.fitBounds([[Math.min(...lons),Math.min(...lats)],[Math.max(...lons),Math.max(...lats)]], { padding, duration:450, maxZoom:18 });
      else staticRef.current?.fitBounds?.(coords, padding);
    },
    navigateTo: (lat, lon, heading, zoom = 17, pitch = 60) => { if(map.current)map.current.easeTo({ center: [lon, lat], zoom, bearing: heading, pitch, duration: 500 });else staticRef.current?.navigateTo(lat,lon,heading); },
    flyTo: (lat, lon, zoom, durationMs = 250) => {
      if (map.current) map.current.easeTo({ center: [lon, lat], zoom: zoom ?? map.current.getZoom(), pitch: threeD ? TILT_PITCH : 0, duration: durationMs });
      else staticRef.current?.flyTo(lat, lon, zoom);
    },
    zoomBy: (d) => {
      if (map.current) map.current.easeTo({ zoom: map.current.getZoom() + d, duration: 300 });
      else staticRef.current?.zoomBy(d);
    },
    north: () => { map.current?.easeTo({ bearing: 0, duration: 350 }); },
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
          style: mapStyle(theme, threeD) as unknown as mapboxgl.Style,
          center: [camera.lon, camera.lat],
          zoom: camera.zoom,
          pitch: props.still ? props.still.pitch : threeD ? TILT_PITCH : 0,
          bearing: props.still?.heading ?? 0,
          interactive: !props.still,
          attributionControl: false,
          logoPosition: config.mapAttribution ? 'bottom-left' : undefined,
          pitchWithRotate: false,
          dragRotate: true,
        });
      } catch {
        setFailed(true);
        return;
      }
      if (config.mapAttribution) m.addControl(new lib.AttributionControl({ compact: true }), 'bottom-left');
      if (!config.mapAttribution) (host.current.querySelector('.mapboxgl-ctrl-logo') as HTMLElement | null)?.style.setProperty('display', 'none');
      // Масштаб — наружу, не чаще кадра: пины меняют размер и подписи.
      let raf = 0;
      m.on('moveend', () => { const c = m.getCenter(); props.onMoving?.(false); onCenter?.(c.lat, c.lng); });
      m.on('dragstart', () => props.onMoving?.(true));
      m.on('zoom', () => {
        if (raf) return;
        raf = requestAnimationFrame(() => { raf = 0; onZoom?.(m.getZoom()); });
      });
      host.current.querySelectorAll<HTMLElement>('.mapboxgl-ctrl-bottom-left, .mapboxgl-ctrl-bottom-right').forEach((el) => { el.style.bottom = `${bottomInset}px`; });
      m.on('click', (ev) => { if (!(ev.originalEvent.target as HTMLElement | null)?.closest('.mapboxgl-marker')) onPressRef.current?.({ lat: ev.lngLat.lat, lon: ev.lngLat.lng }); });
      m.on('rotate', () => onBearing?.(m.getBearing()));
      // Деревья стиля (tree / pine): на web картинки подгружаются по требованию.
      m.on('styleimagemissing', (ev: { id: string }) => {
        const src = WEB_IMAGES[ev.id];
        if (!src || m.hasImage(ev.id)) return;
        m.loadImage(src, (err, img) => { if (!err && img && !m.hasImage(ev.id)) m.addImage(ev.id, img, { pixelRatio: 2 }); });
      });
      m.on('click', 'places-dot', (ev) => { const id = ev.features?.[0]?.properties?.id; if (id) onPlaceRef.current?.(String(id)); });
      map.current = m;
      setReady(true);
      const els = elements.current;
      // Локальный style JSON может загрузиться даже при недоступных тайлах.
      // Успешным запуском считаем получение самой карты, иначе остаётся пустой фон с пинами.
      let receivedTile = false;
      const t = setTimeout(() => { if (!receivedTile) setFailed(true); }, 8000);
      m.on('sourcedata', e => {
        if (!receivedTile && e.sourceId === 'streets' && e.sourceDataType === 'content' && e.tile) {
          receivedTile = true;
          clearTimeout(t);
          onMode?.('mapbox');
        }
      });
      m.on('error', (e: { error?: unknown; sourceId?: string }) => {
        const status = (e.error as { status?: number } | undefined)?.status;
        // Отказ необязательного DEM не должен выключать доступную базовую карту.
        if (!receivedTile && e.sourceId === 'streets' && (status === 401 || status === 403)) setFailed(true);
      });
      cleanup = () => { clearTimeout(t); m.remove(); map.current = null; els.clear(); };
    }).catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; cleanup?.(); };
    // Камера и тема применяются отдельно, пересоздавать карту не нужно.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [failed]);

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    m.setStyle(mapStyle(theme, threeD) as unknown as mapboxgl.Style);
    m.easeTo({ pitch: threeD ? TILT_PITCH : 0, duration: 450 });
  }, [theme, threeD]);

  // Линзы: пробки (растровые плитки) и туман «Где я был». После смены стиля слои добавляем заново.
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    const apply = () => {
      const style = m.getStyle();
      for (const l of style?.layers ?? []) if (l.id.startsWith('line-')) m.removeLayer(l.id);
      for (const id of Object.keys(style?.sources ?? {})) if (id.startsWith('line-')) m.removeSource(id);
      for (const id of ['traffic-layer', 'fog-edge', 'fog-glow', 'fog-layer', 'places-dot', 'places-name']) if (m.getLayer(id)) m.removeLayer(id);
      for (const id of ['traffic', 'fog', 'places']) if (m.getSource(id)) m.removeSource(id);
      for (const l of (lines ?? []).filter(l=>l.coords.length>=2)) {
        m.addSource(`line-${l.id}`, { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: l.coords } } });
        m.addLayer({ id: `line-${l.id}-layer`, type: 'line', source: `line-${l.id}`, layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': l.color, 'line-width': l.width ?? 5, ...(l.dash ? { 'line-dasharray': [0.6, 1.8] } : {}) } });
      }
      if (traffic) {
        m.addSource('traffic', { type: 'raster', tiles: [traffic], tileSize: 256 });
        m.addLayer({ id: 'traffic-layer', type: 'raster', source: 'traffic', paint: { 'raster-opacity': 0.9 } });
      }
      if (fog) {
        m.addSource('fog', { type: 'geojson', data: fog as never });
        const fogC = '#17161A';
        m.addLayer({ id: 'fog-layer', type: 'fill', source: 'fog', filter: ['==', ['geometry-type'], 'Polygon'], paint: { 'fill-color': fogC, 'fill-opacity': 0.62 } });
        m.addLayer({ id: 'fog-glow', type: 'line', source: 'fog', filter: ['==', ['get', 'edge'], true], paint: { 'line-color': '#F0521F', 'line-opacity': 0.28, 'line-blur': 3, 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 2, 15, 7] }, layout: { 'line-join': 'round' } });
        m.addLayer({ id: 'fog-edge', type: 'line', source: 'fog', filter: ['==', ['get', 'edge'], true], paint: { 'line-color': '#F0521F', 'line-opacity': 0.85, 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 0.6, 15, 1.6] }, layout: { 'line-join': 'round' } });
      }
      if (places.length) {
        m.addSource('places', { type: 'geojson', data: placesGeo(places) as never });
        m.addLayer({ id: 'places-dot', type: 'circle', source: 'places', minzoom: 15, paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 15, 3.5, 17, 6], 'circle-color': ['get', 'color'], 'circle-stroke-color': '#FCFBF8', 'circle-stroke-width': 1.5, 'circle-pitch-alignment': 'map' } });
        m.addLayer({ id: 'places-name', type: 'symbol', source: 'places', minzoom: 16.5, layout: { 'text-field': ['get', 'name'], 'text-size': 11, 'text-offset': [0, 1.1], 'text-anchor': 'top', 'text-max-width': 8, 'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'], 'text-optional': true }, paint: { 'text-color': '#3A3833', 'text-halo-color': '#FCFBF8', 'text-halo-width': 1.2 } });
      }
    };
    // Стиль ещё грузится — применим, как только загрузится (и после каждой смены стиля).
    if (m.isStyleLoaded()) apply(); else m.once('load', apply);
    m.on('style.load', apply);
    return () => { m.off('style.load', apply); m.off('load', apply); };
  }, [traffic, fog, lines, theme, ready, places]);

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
        el.style.width = mk.id==='me'?'72px':'0';
        el.style.height = mk.id==='me'?'72px':'0';
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
      {/* Логотип Mapbox спрятан по просьбе владельца; атрибуция остаётся в кнопке «i». */}
      {!config.mapAttribution&&<style>{'.mapboxgl-ctrl-logo{display:none!important}'}</style>}
      <div ref={host} style={{ position: 'absolute', inset: 0 }} />
      {markers.map((mk) => {
        const entry = elements.current.get(mk.id);
        return entry ? createPortal(mk.node, entry.el, mk.id) : null;
      })}
    </View>
  );
});
