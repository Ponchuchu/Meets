// Линейная иконка из SVG-путей макета: d — один путь или несколько через пробел; c — круги [cx, cy, r].
import Svg, { Circle, Path } from 'react-native-svg';

export function Ic({ d, c = [], size = 20, color, w = 1.8, fill = 'none' }: {
  d: string; c?: [number, number, number][]; size?: number; color: string; w?: number; fill?: string;
}) {
  const p = { stroke: color, strokeWidth: w, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {d ? <Path d={d} {...p} fill={fill} /> : null}
      {c.map(([cx, cy, r]) => <Circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} {...p} fill="none" />)}
    </Svg>
  );
}

export const IC = {
  back: 'M15 5l-7 7 7 7',
  close: 'M6 6l12 12M18 6L6 18',
  share: 'M12 3v12M7 8l5-5 5 5M5 14v5a2 2 0 002 2h10a2 2 0 002-2v-5',
  bookmark: 'M6 3h12v18l-6-4-6 4z',
  clock: 'M12 7v5l3 2',
  pin: 'M12 21s-7-6.2-7-12a7 7 0 0114 0c0 5.8-7 12-7 12z',
  tag: 'M3 12V4h8l10 10-8 8z',
  check: 'M5 12l5 5 9-10',
  chevron: 'M9 5l7 7-7 7',
  userPlus: 'M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5M19 8v6M16 11h6',
  plus: 'M12 5v14M5 12h14',
  lock: 'M8 10V7a4 4 0 018 0v3M5 10h14v11H5z',
  home: 'M4 11l8-7 8 7v9H4zM10 20v-5h4v5',
};
