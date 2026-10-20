// Форма аватарки отдельно от рамки (FIX3, 20 октября вечер): любую рамку можно поставить в любой форме.
// «Как у рамки» — своя форма рамки (у большинства круг; у «Капли» и «Лавы» — живая клякса, у «Короны» — сквиркл).
export type ShapeId = 'auto' | 'circle' | 'squircle' | 'blob' | 'heart' | 'hex' | 'star' | 'flower' | 'drop';
export const SHAPES: { id: ShapeId; name: string }[] = [
  { id: 'auto', name: 'Как у рамки' }, { id: 'circle', name: 'Круг' }, { id: 'squircle', name: 'Сквиркл' },
  { id: 'blob', name: 'Клякса' }, { id: 'drop', name: 'Капля' }, { id: 'heart', name: 'Сердце' },
  { id: 'hex', name: 'Соты' }, { id: 'star', name: 'Звезда' }, { id: 'flower', name: 'Цветок' },
];
export const shapeOf = (id?: string | null): ShapeId => (SHAPES.some(s => s.id === id) ? (id as ShapeId) : 'auto');

const polar = (k: (t: number) => number, r: number, cx: number, cy: number, n = 120) => {
  const pts: string[] = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    pts.push(`${(cx + r * k(t) * Math.cos(t)).toFixed(2)} ${(cy + r * k(t) * Math.sin(t)).toFixed(2)}`);
  }
  return `M${pts.join('L')}Z`;
};

/** Контур формы радиусом r вокруг (cx, cy) в координатах 64×64. */
export function shapePath(shape: Exclude<ShapeId, 'auto'>, r: number, cx = 32, cy = 32): string {
  switch (shape) {
    case 'circle': return `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;
    case 'squircle': return polar(t => 0.97 / Math.pow(Math.abs(Math.cos(t)) ** 4 + Math.abs(Math.sin(t)) ** 4, 0.25), r, cx, cy);
    case 'blob': return polar(t => 1 + 0.07 * Math.sin(3 * t) + 0.045 * Math.cos(5 * t + 1), r * 0.97, cx, cy);
    case 'drop': return polar(t => 0.9 + 0.22 * Math.pow((1 - Math.sin(t)) / 2, 3), r * 0.95, cx, cy + r * 0.06);
    case 'hex': return polar(t => { const a = ((t + Math.PI / 6) % (Math.PI / 3)) - Math.PI / 6; return 0.86 * Math.cos(Math.PI / 6) / Math.cos(a) + 0.12; }, r, cx, cy);
    case 'star': return polar(t => 0.9 + 0.12 * Math.cos(5 * (t + Math.PI / 2)), r, cx, cy);
    case 'flower': return polar(t => 1 + 0.075 * Math.cos(10 * t), r * 0.95, cx, cy);
    case 'heart': {
      const pts: string[] = [];
      for (let i = 0; i < 120; i++) {
        const t = (i / 120) * Math.PI * 2;
        const x = 16 * Math.sin(t) ** 3, y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
        pts.push(`${(cx + (x / 16.5) * r).toFixed(2)} ${(cy + ((y - 2.5) / 15.5) * r).toFixed(2)}`);
      }
      return `M${pts.join('L')}Z`;
    }
  }
}
