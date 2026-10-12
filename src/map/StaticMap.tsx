// Подложка «бумага» без Mapbox: та же картинка MapBase, пины ставятся по Web Mercator.
import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { MapBase } from '../components/MapBase';
import { fitCamera } from './fit';
import { project } from './projection';
import type { MapCanvasHandle, MapCanvasProps } from './types';

export const StaticMap = forwardRef<MapCanvasHandle, MapCanvasProps>(function StaticMap({ theme, camera: initial, markers, onZoom, onCenter }, ref) {
  const [size, setSize] = useState({ w: 390, h: 844 });
  // Подложка тоже умеет «лететь»: сдвигаем камеру (пины пересчитываются, картинка остаётся фоном).
  const [camera, setCamera] = useState(initial);
  useImperativeHandle(ref, () => ({
    fitBounds: (coords, padding) => { const c = fitCamera(coords, size.w, size.h, padding); if (c) setCamera(c); },
    navigateTo: (lat, lon) => { setCamera((c) => ({ ...c, lat, lon, zoom: 16.5 })); },
    flyTo: (lat, lon, zoom) => setCamera((c) => ({ lat, lon, zoom: zoom ?? c.zoom })),
    zoomBy: (d) => setCamera((c) => ({ ...c, zoom: Math.max(10, Math.min(18, c.zoom + d)) })),
    north: () => undefined,
  }));
  useEffect(() => { onZoom?.(camera.zoom); }, [camera.zoom, onZoom]);
  useEffect(() => { onCenter?.(camera.lat, camera.lon); }, [camera.lat, camera.lon, onCenter]);
  return (
    <View style={StyleSheet.absoluteFill} onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none"><MapBase theme={theme} width="100%" height="100%" /></View>
      {[...markers].sort((a, b) => (a.z ?? 0) - (b.z ?? 0)).map((m) => {
        const p = project(m.lat, m.lon, camera, size.w, size.h);
        if (p.x < -60 || p.y < -60 || p.x > size.w + 60 || p.y > size.h + 60) return null;
        return <View key={m.id} style={{ position: 'absolute', left: p.x - (m.id==='me'?36:0), top: p.y - (m.id==='me'?36:0) }}>{m.node}</View>;
      })}
    </View>
  );
});
