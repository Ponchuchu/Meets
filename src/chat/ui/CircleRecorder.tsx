// Запись кружка — design/png/V6ChatCircle.png: фронтальная камера в круге 300, кольцо прогресса до 60 с,
// снизу «0:07 ‹ влево — отмена». Держишь кнопку — пишем; отпустил — отправили; увёл влево — отмена.
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, useAnimatedProps, useSharedValue, withTiming, Easing } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { colors, fonts } from '../../theme';

const SIZE = 300;
const R = SIZE / 2 - 4;
const LEN = 2 * Math.PI * R;
export const CIRCLE_MAX_S = 60;
const ARing = Animated.createAnimatedComponent(Circle);

export interface CircleRecorderHandle { stop: (send: boolean) => void }

export const CircleRecorder = forwardRef<CircleRecorderHandle, {
  cancelling: boolean; onDone: (uri: string, seconds: number) => void; onCancel: () => void; onDenied: () => void;
}>(function CircleRecorder({ cancelling, onDone, onCancel, onDenied }, ref) {
  const cam = useRef<CameraView>(null);
  const [camPerm, askCam] = useCameraPermissions();
  const [micPerm, askMic] = useMicrophonePermissions();
  const [ready, setReady] = useState(false);
  const [sec, setSec] = useState(0);
  const alive=useRef(true);
  const started = useRef(0);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
  const sendOnStop = useRef(true);
  const stopped = useRef(false);
  const p = useSharedValue(0);
  const ring = useAnimatedProps(() => ({ strokeDashoffset: LEN * (1 - p.get()) }));

  useEffect(() => {
    (async () => {
      const c = camPerm?.granted || (await askCam()).granted;
      const m = micPerm?.granted || (await askMic()).granted;
      if (!c || !m) onDenied();
    })().catch(onDenied);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Камера готова — начинаем запись. Промис завершится, когда вызовем stopRecording или выйдет 60 с.
  useEffect(() => {
    if (!ready || !cam.current || stopped.current) return;
    const camera=cam.current;
    started.current = Date.now();
    p.set(withTiming(1, { duration: CIRCLE_MAX_S * 1000, easing: Easing.linear }));
    const t = setInterval(() => setSec(Math.floor((Date.now() - started.current) / 1000)), 250);
    camera.recordAsync({ maxDuration: CIRCLE_MAX_S }).then((res) => {
      if(!alive.current)return;
      const s = Math.max(1, Math.round((Date.now() - started.current) / 1000));
      if (res?.uri && sendOnStop.current && s >= 1) onDone(res.uri, s);
      else onCancel();
    }).catch(()=>{if(alive.current)onCancel();});
    return () => { clearInterval(t); camera.stopRecording(); };
  }, [ready]); // eslint-disable-line react-hooks/exhaustive-deps

  useImperativeHandle(ref, () => ({
    stop: (send) => {
      if (stopped.current) return;
      stopped.current = true;
      sendOnStop.current = send;
      if (ready) cam.current?.stopRecording();
      else onCancel();
    },
  }));

  return (
    <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(160)} style={styles.veil} pointerEvents="none">
      <View style={styles.circle}>
        {camPerm?.granted && micPerm?.granted && (
          <CameraView ref={cam} style={StyleSheet.absoluteFill} facing="front" mode="video" zoom={0} videoQuality="480p" onCameraReady={() => setReady(true)} />
        )}
      </View>
      <Svg width={SIZE + 8} height={SIZE + 8} style={styles.ring}>
        <ARing cx={(SIZE + 8) / 2} cy={(SIZE + 8) / 2} r={R + 2} stroke={colors.accent} strokeWidth={5} fill="none" strokeLinecap="round"
          strokeDasharray={`${LEN} ${LEN}`} animatedProps={ring} transform={`rotate(-90 ${(SIZE + 8) / 2} ${(SIZE + 8) / 2})`} />
      </Svg>
      <View style={styles.bar}>
        <View style={styles.dot} />
        <Text style={styles.time}>0:{String(Math.min(59, sec)).padStart(2, '0')}</Text>
        <Text style={[styles.hint, cancelling && { color: colors.accentText }]}>{cancelling ? 'отпусти — отменить' : '‹ влево — отмена'}</Text>
      </View>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  veil: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(23,22,26,0.62)', alignItems: 'center', justifyContent: 'center', zIndex: 50 },
  circle: { width: SIZE, height: SIZE, borderRadius: SIZE / 2, overflow: 'hidden', backgroundColor: '#2A292E' },
  ring: { position: 'absolute' },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 96, paddingHorizontal: 20, paddingBottom: 20, backgroundColor: '#EEE9DE', flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent },
  time: { fontFamily: fonts.mono600, fontSize: 16, color: colors.ink },
  hint: { fontFamily: fonts.body500, fontSize: 14, color: colors.muted },
});
