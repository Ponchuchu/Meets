// iOS / Android: @rnmapbox/maps (нужен dev build). В Expo Go и без токена — подложка «бумага».
// Android: пины и своя точка в рамке 72×72 (нулевые виды MarkerView пропускает),
// тайлы не пришли за 8 с — один раз перезагружаем стиль, и только потом подложка; ошибки после загрузки не роняют карту.
// Первый кадр (FIX1 И1): камера ставится на стартовую точку ещё раз после загрузки — иначе Android иногда остаётся в (0,0).
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFrameCallback, useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { config } from '../lib/config';
import { MeDot } from './MeDot';
import { colors, mapPalettes } from '../theme';
import { StaticMap } from './StaticMap';
import { mapStyle } from './style';
import { BUILDINGS_MIN_ZOOM, TILT_PITCH, TILT_ZOOM, type MapCanvasHandle, type MapCanvasProps } from './types';

type RNMapbox = typeof import('@rnmapbox/maps');
let Mapbox: RNMapbox['default'] | null = null;
try {
  // В Expo Go нативного модуля нет — тогда require бросит, и мы покажем подложку.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Mapbox = (require('@rnmapbox/maps') as RNMapbox).default;
  if (config.mapboxToken) Mapbox.setAccessToken(config.mapboxToken);
  Mapbox.setTelemetryEnabled(false); // включается в «О карте и данных»
} catch {
  Mapbox = null;
}

const LOAD_TIMEOUT_MS = 8000;

const PIN_BOX = 72;
const PAPER_STYLE = JSON.stringify(mapStyle('paper'));

export const MapCanvas = forwardRef<MapCanvasHandle, MapCanvasProps>(function MapCanvas(props, ref) {
  const { camera, markers, onMode, onZoom, onCenter, bottomInset = 0, showUser = false, traffic, fog, lines = [], onPress, onBearing, follow = false, onFollowEnd, me, meHeading, tilt = false } = props;
  const pitch = useRef(tilt ? TILT_PITCH : 0);
  const cam = useRef<{ setCamera: (o: object) => void; fitBounds: (ne: number[], sw: number[], padding: number[], duration: number) => void } | null>(null);
  const staticRef = useRef<MapCanvasHandle>(null);
  const [failed, setFailed] = useState(!Mapbox || !config.mapboxToken);
  const loaded = useRef(false);
  const moved = useRef(false);
  const z = useRef(camera.zoom);
  const lastStep = useRef(Math.round(camera.zoom * 2) / 2);
  const [attempt, setAttempt] = useState(0);
  // Для конуса моей точки: масштаб (длина в метрах зависит от него) и направление телефона, не чаще ~10 раз в секунду.
  const [ready, setReady] = useState(false);
  const [followZoom, setFollowZoom] = useState(camera.zoom);
  // Тайлы не пришли за 8 с (пустой голубой фон): первый раз — перезагрузить стиль, второй — подложка «бумага».
  useEffect(() => {
    if (failed) { onMode?.('static'); return; }
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
    if (!moved.current) cam.current?.setCamera({ centerCoordinate: [camera.lon, camera.lat], zoomLevel: camera.zoom, pitch: 0, animationDuration: 0 });
  };
  const checkCenter = (lat: number, lon: number) => {
    if (!moved.current && Math.hypot(lat - camera.lat, lon - camera.lon) > 0.5) toStart();
  };

  useImperativeHandle(ref, () => ({
    fitBounds: (coords, padding) => {
      if (!coords.length) return;
      moved.current = true;
      const lons = coords.map(c => c[0]), lats = coords.map(c => c[1]);
      if (cam.current) cam.current.fitBounds([Math.max(...lons), Math.max(...lats)], [Math.min(...lons), Math.min(...lats)], [padding.top, padding.right, padding.bottom, padding.left], 450);
      else staticRef.current?.fitBounds?.(coords, padding);
    },
    navigateTo: (lat, lon, heading) => { moved.current = true; if(cam.current)cam.current.setCamera({ centerCoordinate: [lon, lat], zoomLevel: 16.5, heading, pitch: 35, animationDuration: 500 });else staticRef.current?.navigateTo(lat,lon,heading); },
    flyTo: (lat, lon, zoom, durationMs = 600) => {
      moved.current = true;
      if (zoom != null) z.current = zoom;
      if (cam.current) cam.current.setCamera({ centerCoordinate: [lon, lat], zoomLevel: zoom, pitch: pitch.current, animationDuration: Math.min(350, durationMs) });
      else staticRef.current?.flyTo(lat, lon, zoom);
    },
    zoomBy: (d) => {
      moved.current = true;
      z.current = Math.max(10, Math.min(18, z.current + d));
      if (cam.current) cam.current.setCamera({ zoomLevel: z.current, animationDuration: 300 });
      else staticRef.current?.zoomBy(d);
    },
    north: () => { cam.current?.setCamera({ heading: 0, animationDuration: 350 }); },
  }));
  useEffect(() => {
    pitch.current = tilt ? TILT_PITCH : 0;
    // Дома объёмом видны только вблизи: при включении 3D на обзорном масштабе подлетаем ближе.
    if (tilt && z.current < BUILDINGS_MIN_ZOOM + 1) z.current = TILT_ZOOM;
    cam.current?.setCamera({ pitch: pitch.current, zoomLevel: z.current, animationDuration: 600 });
  }, [tilt]);

  if (failed || !Mapbox) {
    const withMe = me ? [...markers, { id: 'me', lat: me.lat, lon: me.lon, z: 35, node: <MeDot heading={meHeading} /> }] : markers;
    return <StaticMap ref={staticRef} {...props} markers={withMe} />;
  }
  const M = Mapbox;
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: '#DDD8CB' }]}>
      {!ready && <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}><Text style={{ color: colors.muted2 }}>Загружаю карту…</Text></View>}
      <M.MapView
        key={attempt}
        style={[StyleSheet.absoluteFill, { opacity: ready ? 1 : 0 }]}
        styleJSON={PAPER_STYLE}
        surfaceView={false}
        rotateEnabled
        pitchEnabled={tilt}
        scaleBarEnabled={false}
        compassEnabled={false}
        // Жесты (FIX1 И2 п.5): щипок, двойной тап, тап двумя пальцами, двойной тап с ведением — масштаб одним пальцем, поворот.
        gestureSettings={{ pinchZoomEnabled: true, doubleTapToZoomInEnabled: true, doubleTouchToZoomOutEnabled: true, quickZoomEnabled: true, rotateEnabled: true, pitchEnabled: tilt, simultaneousRotateAndPinchZoomEnabled: true }}
        // В предрелизной сборке скрыто; включается EXPO_PUBLIC_MAP_ATTRIBUTION=true.
        logoEnabled={config.mapAttribution}
        logoPosition={{ bottom: bottomInset + 6, left: 10 }}
        attributionEnabled={config.mapAttribution}
        attributionPosition={{ bottom: bottomInset + 2, left: 92 }}
        onCameraChanged={(st: { properties: { zoom: number; center: number[]; heading?: number }; gestures?: { isGestureActive: boolean } }) => {
          if (st.gestures?.isGestureActive) moved.current = true;
          // Масштаб экрану — только шагами по 0,5: при перелёте к точке камера сообщает его десятки раз в секунду,
          // а каждое сообщение заново строит все пины (раньше из-за этого карта «зависала» после нажатия на событие).
          if (!Number.isFinite(st.properties.zoom)) return;
          z.current = st.properties.zoom;
          const step = Math.round(st.properties.zoom * 2) / 2;
          if (step !== lastStep.current) { lastStep.current = step; onZoom?.(step); setFollowZoom(step); }
          if (st.properties.heading != null) onBearing?.(st.properties.heading);
        }}
        onPress={(event: { geometry?: { coordinates?: number[] } }) => { const p = event.geometry?.coordinates; onPress?.(p && p.every(Number.isFinite) ? { lat: p[1], lon: p[0] } : undefined); }}
        onMapIdle={(st: { properties: { center: number[] } }) => { onCenter?.(st.properties.center[1], st.properties.center[0]); checkCenter(st.properties.center[1], st.properties.center[0]); }}
        onDidFinishLoadingStyle={toStart}
        onDidFinishLoadingMap={() => { loaded.current = true; toStart(); setReady(true); onMode?.('mapbox'); }}
        onMapLoadingError={() => {
          if (loaded.current) { console.warn('[map] ошибка тайлов после загрузки — карта остаётся'); return; }
          setFailed(true);
          onMode?.('static');
        }}
      >
        <M.Camera ref={cam as never} defaultSettings={{ centerCoordinate: [camera.lon, camera.lat], zoomLevel: camera.zoom, pitch: 0 }} animationMode="none"
          followUserLocation={follow} followUserMode={'compass' as never} followZoomLevel={Math.max(15, followZoom)}
          onUserTrackingModeChange={(e: { nativeEvent: { payload: { followUserLocation: boolean } } }) => { if (!e.nativeEvent.payload.followUserLocation) onFollowEnd?.(); }} />
        {traffic && (
          <M.RasterSource id="traffic" tileUrlTemplates={[traffic]} tileSize={256}>
            <M.RasterLayer id="traffic-layer" style={{ rasterOpacity: 0.9 }} />
          </M.RasterSource>
        )}
        {fog && (
          <M.ShapeSource id="fog" shape={fog as never}>
            <M.FillLayer id="fog-layer" style={{ fillColor: '#17161A', fillOpacity: 0.70, fillAntialias: false }} />
            {/* Мягкий край открытых мест: размытая линия того же цвета, что туман (FIX1 И2 п.14). */}
            <M.LineLayer id="fog-edge" style={{ lineColor: '#17161A', lineOpacity: 0.70, lineWidth: 26, lineBlur: 18, lineJoin: 'round' }} />
          </M.ShapeSource>
        )}
        {lines.filter(l => l.coords.length >= 2 && l.coords.every(p => p?.length === 2 && p.every(Number.isFinite))).map((l) => (
          <M.ShapeSource key={l.id} id={`line-${l.id}`} shape={{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: l.coords } } as never}>
            <M.LineLayer id={`line-${l.id}-layer`} style={{ lineColor: l.color, lineWidth: l.width ?? 5, lineCap: 'round', lineJoin: 'round', ...(l.dash ? { lineDasharray: [0.6, 1.8] } : {}) }} />
          </M.ShapeSource>
        ))}
        {tilt && (
          <M.FillExtrusionLayer id="buildings-3d" sourceID="streets" sourceLayerID="building" minZoomLevel={BUILDINGS_MIN_ZOOM} maxZoomLevel={22} belowLayerID="street-labels"
            filter={['==', ['get', 'extrude'], 'true']}
            style={{ fillExtrusionColor: mapPalettes.paper.extrude, fillExtrusionHeight: ['get', 'height'], fillExtrusionBase: ['get', 'min_height'], fillExtrusionOpacity: 0.92, fillExtrusionVerticalGradient: true }} />
        )}
        {/* Невидимый стандартный «пак» нужен камере для следования; саму точку рисует экран (MeDot, оранжевая с конусом). */}
        {showUser && <M.LocationPuck visible={false} puckBearingEnabled={false} />}
        {me && <UserLayers M={M} me={me} heading={meHeading} />}
        {markers.filter(m => Number.isFinite(m.lat) && Number.isFinite(m.lon)).slice().sort((a, b) => (a.z ?? 0) - (b.z ?? 0)).map((mk) => (
          <M.MarkerView key={mk.id} coordinate={[mk.lon, mk.lat]} anchor={{ x: 0.5, y: 0.5 }} allowOverlap>
            <View collapsable={false} pointerEvents="box-none" style={styles.pin}>{mk.node}</View>
          </M.MarkerView>
        ))}
      </M.MapView>
    </View>
  );
});

function UserLayers({ M, me, heading }: { M: RNMapbox['default']; me: { lat: number; lon: number }; heading?: import('react-native-reanimated').SharedValue<number> }) {
  const [direction, setDirection] = useState<number | null>(null);
  const last = useSharedValue(0);
  const sent = useSharedValue<number | null>(null);
  const images = useMemo(() => ({ 'me-beam': require('../../assets/map/beam.png') }), []);
  useFrameCallback(frame => {
    const value = heading ? Math.round(heading.get() / 4) * 4 : null;
    if (value != null && Number.isFinite(value) && value !== sent.get() && (sent.get() == null || frame.timestamp - last.get() >= 100)) {
      last.set(frame.timestamp); sent.set(value); scheduleOnRN(setDirection, ((value % 360) + 360) % 360);
    }
  });
  const shape = useMemo(() => ({ type: 'Feature' as const, properties: { heading: direction ?? 0 }, geometry: { type: 'Point' as const, coordinates: [me.lon, me.lat] } }), [me.lon, me.lat, direction]);
  if (!Number.isFinite(me.lat) || !Number.isFinite(me.lon)) return null;
  return <>
    {/* Картинка имеет постоянный экранный размер: при масштабировании луч не скачет. */}
    <M.Images images={images} />
    <M.ShapeSource id="me-src" shape={shape}>
      <M.SymbolLayer id="me-beam-layer" style={{ iconImage: 'me-beam', iconSize: 0.5, iconRotate: ['get', 'heading'], iconRotationAlignment: 'map', iconPitchAlignment: 'viewport', iconAllowOverlap: true, iconIgnorePlacement: true, iconOpacity: direction == null ? 0 : 1 }} />
      <M.CircleLayer id="me-halo" style={{ circleRadius: 24, circleColor: '#F0521F', circleOpacity: 0.16 }} />
      <M.CircleLayer id="me-ring" style={{ circleRadius: 11.5, circleColor: '#EEE9DE', circleStrokeColor: 'rgba(23,22,26,0.22)', circleStrokeWidth: 1 }} />
      <M.CircleLayer id="me-dot" style={{ circleRadius: 8, circleColor: '#F0521F' }} />
    </M.ShapeSource>
  </>;
}

const styles = StyleSheet.create({
  pin: { width: PIN_BOX, height: PIN_BOX, alignItems: 'center', justifyContent: 'center' },
});
