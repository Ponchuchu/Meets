// Подложка «бумага» без Mapbox: та же картинка MapBase, пины ставятся по Web Mercator.
import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { MapBase } from '../components/MapBase';
import { project, unproject } from './projection';
import type { MapCanvasHandle, MapCanvasProps } from './types';

export const StaticMap = forwardRef<MapCanvasHandle, MapCanvasProps>(function StaticMap({ theme, camera: initial, markers, onZoom, onCenter, onPress, fog }, ref) {
  const [size, setSize] = useState({ w: 390, h: 844 });
  // Подложка тоже умеет «лететь»: сдвигаем камеру (пины пересчитываются, картинка остаётся фоном).
  const [camera, setCamera] = useState(initial);
  useImperativeHandle(ref, () => ({
    navigateTo: (lat, lon) => { setCamera((c) => ({ ...c, lat, lon, zoom: 16.5 })); },
    flyTo: (lat, lon, zoom) => setCamera((c) => ({ lat, lon, zoom: zoom ?? c.zoom })),
    zoomBy: (d) => setCamera((c) => ({ ...c, zoom: Math.max(10, Math.min(18, c.zoom + d)) })),
    north: () => undefined,
  }));
  useEffect(() => { onZoom?.(camera.zoom); }, [camera.zoom, onZoom]);
  useEffect(() => { onCenter?.(camera.lat, camera.lon); }, [camera.lat, camera.lon, onCenter]);
  return (
    <View style={StyleSheet.absoluteFill} onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      <Pressable style={StyleSheet.absoluteFill} onPress={ev => onPress?.(unproject(ev.nativeEvent.locationX, ev.nativeEvent.locationY, camera, size.w, size.h))} accessibilityLabel="Карта"><View style={StyleSheet.absoluteFill} pointerEvents="none"><MapBase theme={theme} width="100%" height="100%" /></View></Pressable>
      {fog && <Svg width="100%" height="100%" style={StyleSheet.absoluteFill} pointerEvents="none"><Path d={((fog as {geometry?:{coordinates?:number[][][]}}).geometry?.coordinates ?? []).map(ring => ring.map(([lon,lat],i) => { const p = project(lat,lon,camera,size.w,size.h); return `${i?'L':'M'}${p.x} ${p.y}`; }).join(' ')+'Z').join(' ')} fill="#17161A" fillOpacity={0.7} fillRule="evenodd" /></Svg>}
      {[...markers].sort((a, b) => (a.z ?? 0) - (b.z ?? 0)).map((m) => {
        const p = project(m.lat, m.lon, camera, size.w, size.h);
        if (p.x < -60 || p.y < -60 || p.x > size.w + 60 || p.y > size.h + 60) return null;
        return <View key={m.id} style={{ position: 'absolute', left: p.x - (m.id==='me'?36:0), top: p.y - (m.id==='me'?36:0) }}>{m.node}</View>;
      })}
    </View>
  );
});
