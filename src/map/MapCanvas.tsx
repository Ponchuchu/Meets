import { useLowPowerMode } from 'expo-battery';
// iOS / Android: @rnmapbox/maps (нужен dev build). В Expo Go и без токена — подложка «бумага».
// Android: пины и своя точка в рамке 128×128 (нулевые виды MarkerView пропускает),
// тайлы не пришли за 8 с — один раз перезагружаем стиль, и только потом подложка; ошибки после загрузки не роняют карту.
// Первый кадр (FIX1 И1): камера ставится на стартовую точку ещё раз после загрузки — иначе Android иногда остаётся в (0,0).
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';
import { useAnimatedReaction, useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { config } from '../lib/config';
import { MeDot } from './MeDot';
import { colors } from '../theme';
import { StaticMap } from './StaticMap';
import { mapStyle } from './style';
import { NO_PLACES, placesGeo } from './placesGeo';
import { SPRITES } from './sprites';
import { NO_SYMBOLS, symbolsGeo } from './symbolsGeo';
import { SPRITE_W, symbolMarkers } from './symbols';
import { linesGeo, okPoint } from './linesGeo';
import { TILT_PITCH, type MapCanvasHandle, type MapCanvasProps } from './types';

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
/** Где главную карту оставили (центр и масштаб) — чтобы при возвращении на вкладку не прыгать на старт. */
let lastView: { lat: number; lon: number; zoom: number } | null = null;
const EMPTY_FC = { type: 'FeatureCollection', features: [] };


// Коробка пина шире самого большого значка («вместе» — до трёх аватарок): Android не передаёт касания за её край.
const PIN_BOX = 128;
const MAP_IMAGES = {
  ...SPRITES,
  tree: require('../../assets/map/tree.png'), pine: require('../../assets/map/pine.png'),
  'tree-gold': require('../../assets/map/tree-gold.png'), 'tree-amber': require('../../assets/map/tree-amber.png'),
};

export const MapCanvas = forwardRef<MapCanvasHandle, MapCanvasProps>(function MapCanvas(props, ref) {
  const lowPower = useLowPowerMode();
  const threeD = props.threeD !== false && !lowPower;
  const styleJSON = useMemo(() => JSON.stringify(mapStyle(props.theme, threeD, true)), [props.theme, threeD]);
  const { camera: startProp, markers, onMode, onZoom, onCenter, bottomInset = 0, showUser = false, traffic, fog, lines = [], zone, onPress, onBearing, follow = false, onFollowEnd, me, meHeading, places = NO_PLACES, onPlace, meArrow = false, still, onMoving, symbols = NO_SYMBOLS, onSymbol } = props;
  const [camera] = useState(() => (props.remember && lastView ? { ...startProp, ...lastView } : startProp));
  // Перелёт, заказанный до загрузки карты (конец заставки), раньше терялся на Android, а «moved» запрещал вернуть камеру —
  // карта открывалась пустой, пока не нажмёшь «Где я». Теперь он ждёт загрузки и выполняется сразу после неё (FIX5).
  const pendingFly = useRef<{ lat: number; lon: number; zoom?: number } | null>(null);
  const movingRef = useRef(false);
  // Кадры: 60 только пока палец на карте или камера летит; в покое 30 — глаз не видит разницы, а телефон не греется (27 окт.).
  const [fps, setFps] = useState(30);
  const fpsTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const boost = () => { setFps((v) => (v === 60 ? v : 60)); clearTimeout(fpsTimer.current); fpsTimer.current = setTimeout(() => setFps(30), 1500); };
  const placeShape = useMemo(() => placesGeo(places), [places]);
  const lineShape = useMemo(() => linesGeo(lines), [lines]);
  const zoneShape = useMemo(() => (zone && zone.length > 3 ? { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [zone] } }] } : EMPTY_FC), [zone]);
  const symShape = useMemo(() => symbolsGeo(symbols, SPRITE_W), [symbols]);
  const cam = useRef<{ setCamera: (o: object) => void; fitBounds: (ne: number[], sw: number[], padding: number[], duration: number) => void } | null>(null);
  const staticRef = useRef<MapCanvasHandle>(null);
  const box = useRef({ w: 390, h: 844 });
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
    if (!okPoint([camera.lon, camera.lat]) || !Number.isFinite(camera.zoom)) return;
    if (!moved.current) cam.current?.setCamera({ centerCoordinate: [camera.lon, camera.lat], zoomLevel: camera.zoom, pitch: still ? still.pitch : threeD ? TILT_PITCH : 0, ...(still ? { heading: still.heading } : {}), animationDuration: 0 });
  };
  // Сторож камеры (пустая голубая карта, шестая попытка): Android теряет центр камеры, оставляя масштаб, — и показывает
  // океан у точки (0, 0). Раньше чинили только «если камеру ещё не двигали», а перелёт после заставки уже ставил «двигали».
  // Теперь помним, куда камера должна смотреть (want), и если она оказалась у (0, 0) или далеко от цели без жеста
  // человека — возвращаем её туда. Проверка — на каждой остановке карты и несколько раз после загрузки.
  const want = useRef<{ lat: number; lon: number; zoom?: number }>({ lat: camera.lat, lon: camera.lon, zoom: camera.zoom });
  const center = useRef<{ lat: number; lon: number } | null>(null);
  const gestured = useRef(false);
  const aim = (lat: number, lon: number, zoom?: number) => { want.current = { lat, lon, zoom: zoom ?? want.current.zoom }; };
  const checkCenter = (lat: number, lon: number) => {
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
    const lost = Math.abs(lat) < 3 && Math.abs(lon) < 3;
    const astray = !gestured.current && Math.hypot(lat - want.current.lat, lon - want.current.lon) > 0.5;
    if (!lost && !astray) return;
    const w = want.current;
    if (!okPoint([w.lon, w.lat])) return;
    console.warn('[map] камера потеряла центр — возвращаю', lat, lon);
    cam.current?.setCamera({ centerCoordinate: [w.lon, w.lat], ...(w.zoom != null && Number.isFinite(w.zoom) ? { zoomLevel: w.zoom } : {}), pitch: still ? still.pitch : threeD ? TILT_PITCH : 0, animationDuration: 0 });
  };
  const recheck = () => { const c = center.current; if (c) checkCenter(c.lat, c.lon); else toStart(); };

  useImperativeHandle(ref, () => ({
    fitBounds: (all, padding) => {
      const coords = all.filter(okPoint);
      if (!coords.length) return;
      moved.current = true;
      const lons = coords.map(c => c[0]), lats = coords.map(c => c[1]);
      // Одна точка или отступы больше карты — Mapbox на Android считал бесконечный масштаб; расширяем рамку и ужимаем отступы.
      const pad = 0.0015;
      const ne = [Math.max(...lons) + pad, Math.max(...lats) + pad], sw = [Math.min(...lons) - pad, Math.min(...lats) - pad];
      aim((ne[1] + sw[1]) / 2, (ne[0] + sw[0]) / 2, undefined);
      const vScale = Math.min(1, (box.current.h * 0.7) / Math.max(1, padding.top + padding.bottom));
      const hScale = Math.min(1, (box.current.w * 0.7) / Math.max(1, padding.left + padding.right));
      const p = [padding.top * vScale, padding.right * hScale, padding.bottom * vScale, padding.left * hScale].map(v => Math.max(0, Math.round(v)));
      if (cam.current) cam.current.fitBounds(ne, sw, p, 450);
      else staticRef.current?.fitBounds?.(coords, padding);
    },
    navigateTo: (lat, lon, heading, zoom = 17, pitch = 60) => { if (!okPoint([lon, lat])) return; moved.current = true; aim(lat, lon, zoom); heading = Number.isFinite(heading) ? heading : 0; if(cam.current)cam.current.setCamera({ centerCoordinate: [lon, lat], zoomLevel: zoom, heading, pitch, animationDuration: 900 });else staticRef.current?.navigateTo(lat,lon,heading); },
    flyTo: (lat, lon, zoom, durationMs = 600) => {
      if (!okPoint([lon, lat])) return;
      aim(lat, lon, zoom);
      if (cam.current && !loaded.current) { pendingFly.current = { lat, lon, zoom }; return; }
      moved.current = true;
      if (zoom != null) z.current = zoom;
      if (cam.current) cam.current.setCamera({ centerCoordinate: [lon, lat], zoomLevel: zoom, pitch: threeD ? TILT_PITCH : 0, animationDuration: Math.min(350, durationMs) });
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

  // Вернулся в приложение: Android иногда оставляет карту пустой (поверхность не перерисована) — лёгкий толчок камеры.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => {
      if (st !== 'active' || !loaded.current) return;
      setTimeout(() => cam.current?.setCamera({ zoomLevel: z.current + 0.001, animationDuration: 0 }), 120);
    });
    return () => sub.remove();
  }, []);

  useEffect(() => { if (!still) cam.current?.setCamera({ pitch: threeD ? TILT_PITCH : 0, animationDuration: 450 }); }, [threeD, failed]); // eslint-disable-line react-hooks/exhaustive-deps

  if (failed || !Mapbox) {
    const withMe = me ? [...markers, { id: 'me', lat: me.lat, lon: me.lon, z: 35, node: <MeDot heading={meHeading} /> }] : markers;
    return <StaticMap ref={staticRef} {...props} markers={[...symbolMarkers(symbols, onSymbol), ...withMe]} />;
  }
  const M = Mapbox;
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: '#DDD8CB' }]} onLayout={(ev) => { box.current = { w: ev.nativeEvent.layout.width, h: ev.nativeEvent.layout.height }; }}>
      {!ready && <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}><Text style={{ color: colors.muted2 }}>Загружаю карту…</Text></View>}
      <M.MapView
        key={attempt}
        style={[StyleSheet.absoluteFill, { opacity: ready ? 1 : 0 }]}
        styleJSON={styleJSON}
        preferredFramesPerSecond={props.hidden ? 1 : lowPower ? 30 : fps}
        surfaceView={false}
        rotateEnabled={!still}
        pitchEnabled={threeD && !still}
        scrollEnabled={!still}
        zoomEnabled={!still}
        scaleBarEnabled={false}
        compassEnabled={false}
        // Жесты (FIX1 И2 п.5): щипок, двойной тап, тап двумя пальцами, двойной тап с ведением — масштаб одним пальцем, поворот.
        gestureSettings={{ pinchZoomEnabled: true, doubleTapToZoomInEnabled: true, doubleTouchToZoomOutEnabled: true, quickZoomEnabled: true, rotateEnabled: true, pitchEnabled: threeD, simultaneousRotateAndPinchZoomEnabled: true }}
        // В предрелизной сборке скрыто; включается EXPO_PUBLIC_MAP_ATTRIBUTION=true.
        logoEnabled={config.mapAttribution}
        logoPosition={{ bottom: bottomInset + 6, left: 10 }}
        attributionEnabled={config.mapAttribution}
        attributionPosition={{ bottom: bottomInset + 2, left: 92 }}
        onCameraChanged={(st: { properties: { zoom: number; center: number[]; heading?: number }; gestures?: { isGestureActive: boolean } }) => {
          if (Array.isArray(st.properties.center)) center.current = { lat: st.properties.center[1], lon: st.properties.center[0] };
          if (st.gestures?.isGestureActive) { boost(); moved.current = true; gestured.current = true; if (!movingRef.current) { movingRef.current = true; onMoving?.(true); } }
          // Масштаб экрану — только шагами по 0,5: при перелёте к точке камера сообщает его десятки раз в секунду,
          // а каждое сообщение заново строит все пины (раньше из-за этого карта «зависала» после нажатия на событие).
          if (!Number.isFinite(st.properties.zoom)) return;
          z.current = st.properties.zoom;
          const step = Math.round(st.properties.zoom * 2) / 2;
          if (step !== lastStep.current) { lastStep.current = step; onZoom?.(step); setFollowZoom(step); }
          if (st.properties.heading != null) onBearing?.(st.properties.heading);
        }}
        onPress={(event: { geometry?: { coordinates?: number[] } }) => { const p = event.geometry?.coordinates; onPress?.(p && p.every(Number.isFinite) ? { lat: p[1], lon: p[0] } : undefined); }}
        onMapIdle={(st: { properties: { center: number[] } }) => { if (movingRef.current) { movingRef.current = false; onMoving?.(false); } onCenter?.(st.properties.center[1], st.properties.center[0]); const lat = st.properties.center[1], lon = st.properties.center[0];
          // Потерянный центр (0, 0) не запоминаем — иначе при следующем входе карта сразу откроется в океане.
          if (props.remember && loaded.current && !(Math.abs(lat) < 3 && Math.abs(lon) < 3)) lastView = { lat, lon, zoom: z.current }; checkCenter(st.properties.center[1], st.properties.center[0]); }}
        onDidFinishLoadingStyle={toStart}
        onDidFinishLoadingMap={() => {
          loaded.current = true; toStart(); setReady(true); onMode?.('mapbox');
          const p = pendingFly.current;
          if (p) { pendingFly.current = null; moved.current = true; if (p.zoom != null) z.current = p.zoom; cam.current?.setCamera({ centerCoordinate: [p.lon, p.lat], zoomLevel: p.zoom, pitch: threeD ? TILT_PITCH : 0, animationDuration: 0 }); }
          // Android может «съесть» и эту установку камеры — проверяем ещё несколько раз, пока карта устаканивается.
          for (const ms of [400, 1200, 2500, 5000]) setTimeout(recheck, ms);
        }}
        onMapLoadingError={() => {
          if (loaded.current) { console.warn('[map] ошибка тайлов после загрузки — карта остаётся'); return; }
          setFailed(true);
          onMode?.('static');
        }}
      >
        {/* Картинки для стиля: деревья (слои trees-* в src/map/style.ts). */}
        <M.Images images={MAP_IMAGES} />
        <M.Camera ref={cam as never} defaultSettings={{ centerCoordinate: okPoint([camera.lon, camera.lat]) ? [camera.lon, camera.lat] : [76.8897, 43.2389], zoomLevel: Number.isFinite(camera.zoom) ? camera.zoom : 12, pitch: still ? still.pitch : threeD ? TILT_PITCH : 0, heading: still?.heading ?? 0 }} animationMode="none"
          followUserLocation={follow} followUserMode={'compass' as never} followZoomLevel={Math.max(15, followZoom)}
          onUserTrackingModeChange={(e: { nativeEvent: { payload: { followUserLocation: boolean } } }) => { if (!e.nativeEvent.payload.followUserLocation) onFollowEnd?.(); }} />
        {traffic && (
          <M.RasterSource id="traffic" tileUrlTemplates={[traffic]} tileSize={256}>
            <M.RasterLayer id="traffic-layer" style={{ rasterOpacity: 0.9 }} />
          </M.RasterSource>
        )}
        {/* Туман тоже держим постоянно: «линза» включает и выключает только данные, не источник. */}
        <M.ShapeSource id="fog" shape={(fog ?? EMPTY_FC) as never}>
            <M.FillLayer id="fog-layer" filter={['==', ['geometry-type'], 'Polygon'] as never} style={{ fillColor: '#17161A', fillOpacity: 0.62, fillAntialias: true }} />
            {/* Край открытых мест — тонкая светящаяся линия цвета акцента. Ширина растёт с приближением:
                прежняя размытая линия 26 px на мелком масштабе превращалась в «чёрную дыру из пикселей». */}
            <M.LineLayer id="fog-glow" filter={['==', ['get', 'edge'], true] as never} style={{ lineColor: '#F0521F', lineOpacity: 0.28, lineBlur: 3, lineJoin: 'round', lineWidth: ['interpolate', ['linear'], ['zoom'], 10, 2, 15, 7] as never }} />
            <M.LineLayer id="fog-edge" filter={['==', ['get', 'edge'], true] as never} style={{ lineColor: '#F0521F', lineOpacity: 0.85, lineJoin: 'round', lineWidth: ['interpolate', ['linear'], ['zoom'], 10, 0.6, 15, 1.6] as never }} />
        </M.ShapeSource>
        {/* Линии маршрута и друзей — один постоянный источник: слои не создаются и не удаляются при смене способа
            (на Android удаление источника во время отрисовки роняло приложение — FIX3 Ф1). */}
        <M.ShapeSource id="zone" shape={zoneShape as never}>
          <M.FillLayer id="zone-fill" style={{ fillColor: '#F0521F', fillOpacity: 0.16 }} />
          <M.LineLayer id="zone-line" style={{ lineColor: '#F0521F', lineWidth: 2.4, lineOpacity: 0.9, lineJoin: 'round', lineDasharray: [2, 1.4] }} />
        </M.ShapeSource>
        <M.ShapeSource id="lines" shape={lineShape as never}>
          <M.LineLayer id="lines-solid" filter={['!=', ['get', 'dash'], true]} style={{ lineColor: ['get', 'color'], lineWidth: ['get', 'width'], lineCap: 'round', lineJoin: 'round' }} />
          <M.LineLayer id="lines-dash" filter={['==', ['get', 'dash'], true]} style={{ lineColor: ['get', 'color'], lineWidth: ['get', 'width'], lineCap: 'round', lineJoin: 'round', lineDasharray: [0.6, 1.8] }} />
        </M.ShapeSource>
        {/* Невидимый стандартный «пак» нужен камере для следования; саму точку рисует экран (MeDot, оранжевая с конусом). */}
        {showUser && <M.LocationPuck visible={false} puckBearingEnabled={false} />}
        {places.length > 0 && (
          <M.ShapeSource id="places" shape={placeShape as never} onPress={(e) => { const id = e.features?.[0]?.properties?.id; if (typeof id === "string") onPlace?.(id); }} hitbox={{ width: 24, height: 24 }}>
            <M.CircleLayer id="places-dot" minZoomLevel={15} style={{ circleRadius: ['interpolate', ['linear'], ['zoom'], 15, 3.5, 17, 6], circleColor: ['get', 'color'], circleStrokeColor: '#FCFBF8', circleStrokeWidth: 1.5, circlePitchAlignment: 'map' }} />
            <M.SymbolLayer id="places-name" minZoomLevel={16.5} style={{ textField: ['get', 'name'], textSize: 11, textColor: '#3A3833', textHaloColor: '#FCFBF8', textHaloWidth: 1.2, textOffset: [0, 1.1], textAnchor: 'top', textMaxWidth: 8, textFont: ['DIN Pro Medium', 'Arial Unicode MS Regular'], textOptional: true }} />
          </M.ShapeSource>
        )}
        {/* Значки событий, мест и ТРЦ (FIX5) — картинки движка карты: стоят к зрителю, пришиты к точке и при повороте, и при наклоне.
            Источник постоянный: меняются только данные (удаление источника во время отрисовки роняло Android). */}
        <M.ShapeSource id="syms" shape={symShape as never} hitbox={{ width: 40, height: 40 }}
          onPress={(e) => { const id = e.features?.[0]?.properties?.id; if (typeof id === 'string') onSymbol?.(id); }}>
          {/* Точки издалека (26 октября): мягкая тень под точкой, белый ободок, точка растёт с приближением —
              от бусинки на весь город до 7 px у границы, где её сменяет значок. Одинаково у событий, ТРЦ и мест. */}
          <M.CircleLayer id="syms-dot-shadow" filter={['!=', ['get', 'dot'], ''] as never} style={{ circleRadius: ['interpolate', ['linear'], ['zoom'], 9, 4.5, 12.5, 9] as never, circleColor: '#17161A', circleOpacity: ['*', 0.22, ['get', 'op']] as never, circleBlur: 0.7, circleTranslate: [0, 1.5], circlePitchAlignment: 'viewport' }} />
          <M.CircleLayer id="syms-dot" filter={['!=', ['get', 'dot'], ''] as never} style={{ circleRadius: ['interpolate', ['linear'], ['zoom'], 9, 3, 12.5, 6.5] as never, circleColor: ['get', 'dot'] as never, circleStrokeColor: '#FFFFFF', circleStrokeWidth: ['interpolate', ['linear'], ['zoom'], 9, 1.5, 12.5, 2.2] as never, circleOpacity: ['get', 'op'] as never, circleStrokeOpacity: ['get', 'op'] as never, circlePitchAlignment: 'viewport', circleSortKey: ['get', 'sort'] as never }} />
          <M.SymbolLayer id="syms-icon" filter={['==', ['get', 'dot'], ''] as never} style={{
            iconImage: ['get', 'icon'] as never, iconSize: ['get', 'sz'] as never, iconAnchor: 'bottom',
            iconPitchAlignment: 'viewport', iconRotationAlignment: 'viewport',
            // Налезают — карта оставляет важный (меньший ключ ставится первым), остальные появляются при приближении.
            iconAllowOverlap: false, iconPadding: 1, iconOpacity: ['get', 'op'] as never, symbolSortKey: ['-', 0, ['get', 'sort']] as never,
            // Подпись маленькая и тихая; не помещается — прячется, значок остаётся.
            textField: ['get', 'text'] as never, textSize: 10, textColor: ['get', 'tc'] as never, textHaloColor: ['get', 'th'] as never, textHaloWidth: 1.4,
            textAnchor: 'top', textOffset: [0, 0.25], textOptional: true, textFont: ['DIN Pro Medium', 'Arial Unicode MS Regular'], textOpacity: ['get', 'op'] as never,
          }} />
        </M.ShapeSource>
        {me && <UserLayers M={M} me={me} heading={meHeading} arrow={meArrow} />}
        {markers.filter(m => Number.isFinite(m.lat) && Number.isFinite(m.lon)).slice().sort((a, b) => (a.z ?? 0) - (b.z ?? 0)).map((mk) => (
          <M.MarkerView key={mk.id} coordinate={[mk.lon, mk.lat]} anchor={{ x: 0.5, y: 0.5 }} allowOverlap>
            <View collapsable={false} pointerEvents="box-none" style={styles.pin}>{mk.node}</View>
          </M.MarkerView>
        ))}
      </M.MapView>
    </View>
  );
});

function UserLayers({ M, me, heading, arrow }: { M: RNMapbox['default']; me: { lat: number; lon: number }; heading?: import('react-native-reanimated').SharedValue<number>; arrow: boolean }) {
  const [direction, setDirection] = useState<number | null>(null);
  const last = useSharedValue(0);
  const sent = useSharedValue<number | null>(null);
  const images = useMemo(() => ({ 'me-beam': require('../../assets/map/beam.png'), 'me-arrow': require('../../assets/map/arrow.png'), 'me-puck': require('../../assets/map/puck.png') }), []);
  // Только когда компас действительно повернулся (шаг 4°, не чаще 10 раз в секунду). Раньше проверка шла
  // на каждом кадре всегда, пока открыта карта, — UI-поток не засыпал, и телефон грелся.
  useAnimatedReaction(() => (heading ? Math.round(heading.get() / 4) * 4 : null), (value) => {
    const now = Date.now();
    if (value != null && Number.isFinite(value) && value !== sent.get() && (sent.get() == null || now - last.get() >= 100)) {
      last.set(now); sent.set(value); scheduleOnRN(setDirection, ((value % 360) + 360) % 360);
    }
  });
  const shape = useMemo(() => ({ type: 'Feature' as const, properties: { heading: direction ?? 0 }, geometry: { type: 'Point' as const, coordinates: [me.lon, me.lat] } }), [me.lon, me.lat, direction]);
  if (!Number.isFinite(me.lat) || !Number.isFinite(me.lon)) return null;
  return <>
    {/* Картинка имеет постоянный экранный размер: при масштабировании луч не скачет. */}
    <M.Images images={images} />
    <M.ShapeSource id="me-src" shape={shape}>
      <M.SymbolLayer id="me-beam-layer" style={{ iconImage: 'me-beam', iconSize: 0.5, iconRotate: ['get', 'heading'], iconRotationAlignment: 'map', iconPitchAlignment: 'viewport', iconAllowOverlap: true, iconIgnorePlacement: true, iconOpacity: direction == null || arrow ? 0 : 1 }} />
      <M.CircleLayer id="me-halo" style={{ circleRadius: arrow ? 30 : 26, circleColor: '#F0521F', circleOpacity: arrow ? 0.1 : 0.15, circleBlur: 0.4, circlePitchAlignment: 'map' }} />
      {/* Объёмная точка: глянцевый шар в белом кольце с тенью (assets/map/puck.png); стоит к камере и при наклоне. */}
      <M.SymbolLayer id="me-puck-layer" style={{ iconImage: 'me-puck', iconSize: 0.15, iconPitchAlignment: 'viewport', iconAllowOverlap: true, iconIgnorePlacement: true, iconOpacity: arrow ? 0 : 1 }} />
      {/* Стрелка навигатора с двумя гранями и белой кромкой лежит на карте и смотрит по ходу. */}
      <M.SymbolLayer id="me-arrow-layer" style={{ iconImage: 'me-arrow', iconSize: 0.13, iconRotate: ['get', 'heading'], iconRotationAlignment: 'map', iconPitchAlignment: 'map', iconAllowOverlap: true, iconIgnorePlacement: true, iconOpacity: arrow ? 1 : 0 }} />
    </M.ShapeSource>
  </>;
}

const styles = StyleSheet.create({
  pin: { width: PIN_BOX, height: PIN_BOX, alignItems: 'center', justifyContent: 'center' },
});
