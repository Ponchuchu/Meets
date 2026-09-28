// «Маршрут»: не строим сами, а открываем приложение, которым пользуются в Алматы. Нет приложения — веб-ссылка.
export type RouteApp = '2gis' | 'yandex' | 'google' | 'apple';

export interface RouteLink {
  app: RouteApp;
  label: string;
  native: string | null;
  web: string;
}

export function routeLinks(lat: number, lon: number, name: string, ios: boolean): RouteLink[] {
  const q = encodeURIComponent(name);
  const links: RouteLink[] = [
    { app: '2gis', label: '2ГИС', native: `dgis://2gis.ru/routeSearch/rsType/car/to/${lon},${lat}`, web: `https://2gis.kz/almaty/directions/points/%7C${lon}%2C${lat}` },
    { app: 'yandex', label: 'Яндекс Карты', native: `yandexmaps://maps.yandex.ru/?rtext=~${lat},${lon}&rtt=auto`, web: `https://yandex.kz/maps/?rtext=~${lat}%2C${lon}&rtt=auto` },
    { app: 'google', label: 'Google Maps', native: null, web: `https://www.google.com/maps/dir/?api=1&destination=${lat}%2C${lon}&destination_place_id=&travelmode=driving&q=${q}` },
  ];
  if (ios) links.push({ app: 'apple', label: 'Apple Карты', native: null, web: `https://maps.apple.com/?daddr=${lat},${lon}&q=${q}` });
  return links;
}
