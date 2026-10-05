// Телеметрия Mapbox (Настройки → «О карте и данных»): по умолчанию выключена, включает сам человек.
type RNMapbox = typeof import('@rnmapbox/maps');

export function setMapTelemetry(on: boolean) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require('@rnmapbox/maps') as RNMapbox).default.setTelemetryEnabled(on);
  } catch {
    // Expo Go / нет нативного модуля — нечего выключать
  }
}
