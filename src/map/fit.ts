import type { Camera } from './types';
export interface MapPadding { top: number; right: number; bottom: number; left: number }
const mercator = (lat: number) => { const s = Math.sin(Math.max(-85, Math.min(85, lat)) * Math.PI / 180); return .5 - Math.log((1+s)/(1-s))/(4*Math.PI); };
/** Камера, в которой весь путь помещается между карточками и кнопками. */
export function fitCamera(coords: [number, number][], width: number, height: number, padding: MapPadding): Camera | null {
  const valid = coords.filter(([lon, lat]) => Number.isFinite(lon) && Number.isFinite(lat) && Math.abs(lon)<=180 && Math.abs(lat)<=85);
  if (!valid.length) return null;
  const xs = valid.map(([lon]) => (lon+180)/360), ys=valid.map(([,lat])=>mercator(lat));
  const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
  const w=Math.max(1,width-padding.left-padding.right),h=Math.max(1,height-padding.top-padding.bottom);
  const zoom=Math.max(3,Math.min(18,Math.log2(Math.min(w/(512*Math.max(maxX-minX,1e-8)),h/(512*Math.max(maxY-minY,1e-8))))));
  const scale=512*2**zoom;
  const x=(minX+maxX)/2+(padding.right-padding.left)/(2*scale);
  const y=(minY+maxY)/2+(padding.bottom-padding.top)/(2*scale);
  return { lon:x*360-180,lat:Math.atan(Math.sinh(Math.PI*(1-2*y)))*180/Math.PI,zoom };
}
