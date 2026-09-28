// Линейные иконки 24×24, толщина 1.8 — пути взяты из макета (design/screens).
import Svg, { Circle, Path, Rect } from 'react-native-svg';

export type IconName = 'map' | 'foryou' | 'chats' | 'people' | 'me';

export function Icon({ name, color, size = 24, strokeWidth = 1.8 }: { name: IconName; color: string; size?: number; strokeWidth?: number }) {
  const p = { stroke: color, strokeWidth, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === 'map' && (<><Path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3z" {...p} /><Path d="M9 3v15M15 6v15" {...p} /></>)}
      {name === 'foryou' && (<><Rect x={8.5} y={3} width={12} height={15} rx={2.5} {...p} /><Path d="M5 7.5v10.5a3 3 0 003 3h8" {...p} /></>)}
      {name === 'chats' && <Path d="M4 5h16v11H9l-5 4z" {...p} />}
      {name === 'people' && (<><Circle cx={9} cy={8} r={3.5} {...p} /><Path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5" {...p} /><Path d="M16 4.5a3.5 3.5 0 010 7M18 14.8c1.9.7 3.1 2.5 3.5 5.2" {...p} /></>)}
      {name === 'me' && (<><Circle cx={12} cy={8} r={4} {...p} /><Path d="M4 21c1-4 4.2-6 8-6s7 2 8 6" {...p} /></>)}
    </Svg>
  );
}
