import { distM } from '../live/geo';
export interface Instruction { message: string; lat: number; lon: number; distance: number }
/** Положение вдоль маршрута по ближайшему сегменту, включая извилистые дороги. */
export function routeProgress(pos:{lat:number;lon:number},line:[number,number][]):{metres:number;away:number}|null {
  if(line.length<2)return null;
  let covered=0,best={metres:0,away:Infinity};
  const scale=Math.cos(pos.lat*Math.PI/180);
  for(let i=1;i<line.length;i++){
    const [x0,y0]=line[i-1],[x1,y1]=line[i];
    const dx=(x1-x0)*scale,dy=y1-y0;
    const t=Math.max(0,Math.min(1,((pos.lon-x0)*scale*dx+(pos.lat-y0)*dy)/(dx*dx+dy*dy||1)));
    const a={lat:y0,lon:x0},b={lat:y1,lon:x1};const length=distM(a,b);
    const away=distM(pos,{lat:y0+(y1-y0)*t,lon:x0+(x1-x0)*t});
    if(away<best.away)best={metres:covered+length*t,away};covered+=length;
  }
  return best;
}
export function closestInstruction(pos:{lat:number;lon:number},steps:Instruction[],line:[number,number][]=[]):Instruction|null {
  const valid=steps.filter(s=>Number.isFinite(s.lat)&&Number.isFinite(s.lon)&&s.message);
  if(!valid.length)return null;
  const progress=routeProgress(pos,line);
  if(progress){if(progress.away>150)return null;return valid.find(s=>s.distance>progress.metres+15)??valid.at(-1)!;}
  const distances=valid.map(s=>distM(pos,s));const i=distances.indexOf(Math.min(...distances));
  return valid[distances[i]<25&&i+1<valid.length?i+1:i];
}

export type Mode = 'walk' | 'car' | 'bus';
export type ManeuverKind = 'flag' | 'uturn' | 'left' | 'right' | 'soft-left' | 'soft-right' | 'straight';
/** Вид манёвра по тексту подсказки TomTom («Поверните направо…», «Сделайте разворот…», «Вы прибыли»). */
export function maneuverKind(message: string): ManeuverKind {
  const t = message.toLowerCase();
  if (/прибы|назначени|финиш/.test(t)) return 'flag';
  if (/разворот|развернит/.test(t)) return 'uturn';
  const left = /лев/.test(t);
  const right = /прав/.test(t);
  const soft = /слегка|плавно|держитесь|примите/.test(t);
  if (left && !right) return soft ? 'soft-left' : 'left';
  if (right && !left) return soft ? 'soft-right' : 'right';
  return 'straight';
}

/** Что лучше: пешком, если близко; иначе самый быстрый способ с поправкой на парковку и ожидание. */
export function bestMode(walkMin: number | null, carMin: number | null, busMin: number | null): Mode | null {
  if (walkMin != null && walkMin <= 15) return 'walk';
  const options: [Mode, number][] = [];
  if (walkMin != null) options.push(['walk', walkMin]);
  if (carMin != null) options.push(['car', carMin + 8]); // парковка и дорога от неё
  if (busMin != null) options.push(['bus', busMin]);
  return options.sort((a, b) => a[1] - b[1])[0]?.[0] ?? null;
}

