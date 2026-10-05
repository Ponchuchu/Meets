// iOS / Android: @rnmapbox/maps (нужен dev build). В Expo Go и без токена — подложка «бумага».
// Android: пины в рамке 72×72 (нулевые виды MarkerView пропускает), своя точка — LocationPuck,
// тайлы не пришли за 8 с — один раз перезагружаем стиль, и только потом подложка; ошибки после загрузки не роняют карту.
// Первый кадр (FIX1 И1): камера ставится на стартовую точку ещё раз после загрузки — иначе Android иногда остаётся в (0,0).
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { config } from '../lib/config';
import { StaticMap } from './StaticMap';
import { mapStyle } from './style';
import type { MapCanvasHandle, MapCanvasProps } from './types';

type RNMapbox = typeof import('@rnmapbox/maps');
let Mapbox: RNMapbox['default'] | null = null;
try {
  // В Expo Go нативного модуля нет — тогда require бросит, и мы покажем подложку.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Mapbox = (require('@rnmapbox/maps') as RNMapbox).default;
  if (config.mapboxToken) Mapbox.setAccessToken(config.mapboxToken);
} catch {
  Mapbox = null;
}

const LOAD_TIMEOUT_MS = 8000;
const PIN_BOX = 72;

export const MapCanvas = forwardRef<MapCanvasHandle, MapCanvasProps>(function MapCanvas(props, ref) {
  const { theme, camera, markers, onMode, onZoom, onCenter, bottomInset = 0, topInset = 120, showUser = false, traffic, fog, lines = [] } = props;
  const cam = useRef<{ setCamera: (o: object) => void } | null>(null);
  const staticRef = useRef<MapCanvasHandle>(null);
  const [failed, setFailed] = useState(!Mapbox || !config.mapboxToken);
  const loaded = useRef(false);
  const moved = useRef(false);
  const z = useRef(camera.zoom);
  const [attempt, setAttempt] = useState(0);

  // Тайлы не пришли за 8 с (пустой голубой фон): первый раз — перезагрузить стиль, второй — подложка «бумага».
  useEffect(() => {
    if (failed) return;
    const t = setTimeout(() => {
      if (loaded.current) return;
      if (attempt === 0) { console.warn('[map] Mapbox не загрузился за 8 с — перезагружаю стиль'); setAttempt(1); return; }
      console.warn('[map] Mapbox не загрузился и после повтора — подложка');
      setFailed(true);
      onMode?.('static');
    }, LOAD_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [failed, attempt]); // eslint-disable-line react-hooks/exhaustive-deps
  const toStart = () => {
    if (!moved.current) cam.current?.setCamera({ centerCoordinate: [camera.lon, camera.lat], zoomLevel: camera.zoom, animationDuration: 0 });
  };

  useImperativeHandle(ref, () => ({
    flyTo: (lat, lon, zoom) => {
      moved.current = true;
      if (cam.current) cam.current.setCamera({ centerCoordinate: [lon, lat], zoomLevel: zoom, animationDuration: 600 });
      else staticRef.current?.flyTo(lat, lon, zoom);
    },
    zoomBy: (d) => {
      moved.current = true;
      z.current = Math.max(10, Math.min(18, z.current + d));
      if (cam.current) cam.current.setCamera({ zoomLevel: z.current, animationDuration: 300 });
      else staticRef.current?.zoomBy(d);
    },
  }));

  if (failed || !Mapbox) return <StaticMap ref={staticRef} {...props} />;
  const M = Mapbox;
  return (
    <View style={StyleSheet.absoluteFill}>
      <M.MapView
        key={attempt}
        style={StyleSheet.absoluteFill}
        styleJSON={JSON.stringify(mapStyle(theme))}
        surfaceView={false}
        rotateEnabled={false}
        pitchEnabled={false}
        scaleBarEnabled={false}
        logoEnabled
        logoPosition={{ bottom: bottomInset + 8, left: 8 }}
        attributionPosition={{ top: topInset, right: 12 }}
        onCameraChanged={(st: { properties: { zoom: number; center: number[] }; gestures?: { isGestureActive: boolean } }) => { if (st.gestures?.isGestureActive) moved.current = true; z.current = st.properties.zoom; onZoom?.(st.properties.zoom); }}
        onMapIdle={(st: { properties: { center: number[] } }) => onCenter?.(st.properties.center[1], st.properties.center[0])}
        onDidFinishLoadingStyle={toStart}
        onDidFinishLoadingMap={() => { loaded.current = true; toStart(); onMode?.('mapbox'); }}
        onMapLoadingError={() => {
          if (loaded.current) { console.warn('[map] ошибка тайлов после загрузки — карта остаётся'); return; }
          setFailed(true);
          onMode?.('static');
        }}
      >
        <M.Camera ref={cam as never} defaultSettings={{ centerCoordinate: [camera.lon, camera.lat], zoomLevel: camera.zoom }} animationMode="none" />
        {traffic && (
          <M.RasterSource id="traffic" tileUrlTemplates={[traffic]} tileSize={256}>
            <M.RasterLayer id="traffic-layer" style={{ rasterOpacity: 0.9 }} />
          </M.RasterSource>
        )}
        {fog && (
          <M.ShapeSource id="fog" shape={fog as never}>
            <M.FillLayer id="fog-layer" style={{ fillColor: theme === 'night' ? '#0E0E10' : '#F7F5EF', fillOpacity: 0.8, fillAntialias: false }} />
          </M.ShapeSource>
        )}
        {lines.map((l) => (
          <M.ShapeSource key={l.id} id={`line-${l.id}`} shape={{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: l.coords } } as never}>
            <M.LineLayer id={`line-${l.id}-layer`} style={{ lineColor: l.color, lineWidth: l.width ?? 5, lineCap: 'round', lineJoin: 'round', ...(l.dash ? { lineDasharray: [0.6, 1.8] } : {}) }} />
          </M.ShapeSource>
        ))}
        {showUser && <M.LocationPuck puckBearingEnabled puckBearing="heading" pulsing={{ isEnabled: true }} />}
        {[...markers].sort((a, b) => (a.z ?? 0) - (b.z ?? 0)).map((mk) => (
          <M.MarkerView key={mk.id} coordinate={[mk.lon, mk.lat]} anchor={{ x: 0.5, y: 0.5 }} allowOverlap>
            <View collapsable={false} pointerEvents="box-none" style={styles.pin}>{mk.node}</View>
          </M.MarkerView>
        ))}
      </M.MapView>
    </View>
  );
});

const styles = StyleSheet.create({
  pin: { width: PIN_BOX, height: PIN_BOX, alignItems: 'center', justifyContent: 'center' },
});
