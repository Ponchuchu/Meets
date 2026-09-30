// Линейная иконка по SVG-пути из макета. Толщина по умолчанию 1.8, как в DESIGN.md.
import Svg, { Circle, Path, Rect } from 'react-native-svg';

export const GLYPHS = {
  back: 'M15 5l-7 7 7 7',
  chevronDown: 'M6 9l6 6 6-6',
  chat: 'M4 5h16v11H9l-5 4z',
  lock: 'M8 10V7a4 4 0 018 0v3',
  gallery: 'M4 5h16v14H4zM4 15l5-5 4 4 3-3 4 4',
  camera: 'M4 8h3l2-3h6l2 3h3v11H4z',
  send: 'M20 4L4 11l7 2 2 7z',
  note: 'M9 18V5l11-2v13',
  peak: 'M3 20l6-10 4 6 3-4 5 8z',
  mic: 'M5 11a7 7 0 0014 0M12 18v3',
  // Интересы регистрации (Onboarding)
  music: 'M9 18V5l11-2v13M6 21a3 3 0 100-6 3 3 0 000 6zM17 19a3 3 0 100-6 3 3 0 000 6z',
  standup: 'M9 3h6v11H9zM5 11a7 7 0 0014 0M12 18v3',
  hike: 'M3 20l6-10 4 6 3-4 5 8z',
  sport: 'M5.5 20.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM18.5 20.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM5.5 17L9 9h6l3.5 8M9 9L7.5 6H5.5',
  people: 'M9 11.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5M16 4.5a3.5 3.5 0 010 7M18 14.8c1.9.7 3.1 2.5 3.5 5.2',
  games: 'M4 4h16v16H4zM9 9h.01M15 15h.01M15 9h.01M9 15h.01',
  art: 'M12 3l2.6 5.6L20 9.3l-4 4 1 5.7-5-2.8-5 2.8 1-5.7-4-4 5.4-.7z',
  food: 'M4 8h13v5a5 5 0 01-5 5H9a5 5 0 01-5-5V8zM17 10h1.5a2.5 2.5 0 010 5H17',
  party: 'M4 20l5-14 9 9zM14 4l1 2M19 7l2-1M18 3l-1 2',
  talks: 'M4 5h16v14H4zM8 5v14M16 5v14M4 9h4M4 15h4M16 9h4M16 15h4',
} as const;

export type GlyphName = keyof typeof GLYPHS;

export function Glyph({ name, size = 24, color, strokeWidth = 1.8 }: { name: GlyphName; size?: number; color: string; strokeWidth?: number }) {
  const p = { stroke: color, strokeWidth, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d={GLYPHS[name]} {...p} />
      {name === 'lock' && <Rect x={5} y={10} width={14} height={11} rx={2.5} {...p} />}
      {name === 'camera' && <Circle cx={12} cy={13} r={3.5} {...p} />}
      {name === 'note' && (<><Circle cx={6} cy={18} r={3} {...p} /><Circle cx={17} cy={16} r={3} {...p} /></>)}
      {name === 'mic' && <Rect x={9} y={3} width={6} height={11} rx={3} {...p} />}
    </Svg>
  );
}

export function InstagramGlyph({ size = 15, color }: { size?: number; color: string }) {
  const p = { stroke: color, strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x={3.5} y={3.5} width={17} height={17} rx={5} {...p} />
      <Circle cx={12} cy={12} r={4} {...p} />
    </Svg>
  );
}
