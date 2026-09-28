// iOS / Android: @rnmapbox/maps (нужен dev build). В Expo Go и без токена — подложка «бумага».
import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
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

export const MapCanvas = forwardRef<MapCanvasHandle, MapCanvasProps>(function MapCanvas(props, ref) {
  const { theme, camera, markers, onMode, bottomInset = 0 } = props;
  const cam = useRef<{ setCamera: (o: object) => void } | null>(null);
  const staticRef = useRef<MapCanvasHandle>(null);
  const [failed, setFailed] = useState(!Mapbox || !config.mapboxToken);

  useImperativeHandle(ref, () => ({
    flyTo: (lat, lon, zoom) => {
      if (cam.current) cam.current.setCamera({ centerCoordinate: [lon, lat], zoomLevel: zoom, animationDuration: 600 });
      else staticRef.current?.flyTo(lat, lon, zoom);
    },
  }));

  if (failed || !Mapbox) return <StaticMap ref={staticRef} {...props} />;
  const M = Mapbox;
  return (
    <View style={StyleSheet.absoluteFill}>
      <M.MapView
        style={StyleSheet.absoluteFill}
        styleJSON={JSON.stringify(mapStyle(theme))}
        rotateEnabled={false}
        pitchEnabled={false}
        scaleBarEnabled={false}
        logoPosition={{ bottom: bottomInset + 8, left: 8 }}
        attributionPosition={{ bottom: bottomInset + 8, left: 90 }}
        onDidFinishLoadingMap={() => onMode?.('mapbox')}
        onMapLoadingError={() => { setFailed(true); onMode?.('static'); }}
      >
        <M.Camera ref={cam as never} defaultSettings={{ centerCoordinate: [camera.lon, camera.lat], zoomLevel: camera.zoom }} />
        {[...markers].sort((a, b) => (a.z ?? 0) - (b.z ?? 0)).map((mk) => (
          <M.MarkerView key={mk.id} coordinate={[mk.lon, mk.lat]} anchor={{ x: 0.5, y: 0.5 }} allowOverlap>
            <View>{mk.node}</View>
          </M.MarkerView>
        ))}
      </M.MapView>
    </View>
  );
});
