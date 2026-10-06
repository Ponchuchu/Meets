export type StickerPack = 'nearby' | 'city' | 'afterhours';
export interface Sticker { id: string; label: string; pack: StickerPack; level: number; bg: string; fg: string; rot: number; pose: number; look: 'solid' | 'outline' | 'tape' | 'big' }
export const PACKS = [
  {id:'nearby' as const,title:'Рядом',level:1,bg:'#F5D9C7'},
  {id:'city' as const,title:'Город',level:3,bg:'#DDE8D9'},
  {id:'afterhours' as const,title:'После заката',level:7,bg:'#E7DFF4'},
];
const LABELS = [
  ['ГО?','ТЫ ГДЕ?','ВЫХОДИ','КОФЕ?','ЖДУ','ОПАЗДЫВАЮ','Я ТУТ','ЕДУ','БАЗА','КРИНЖ','ХАЙП','АЛЛО??','ШАШЛЫК?','ТАНЦУЕМ','СКУЧАЮ','ПРИВЕТ','РЯДОМ!'],
  ['В ГОРЫ','НА ПРОГУЛКУ','НОВЫЙ МАРШРУТ','ПОШЛИ ПЕШКОМ','ПИКНИК','ЛОВИ МОМЕНТ','ПОЕХАЛИ','ВЕЛО?','ВСТРЕТИМСЯ','НА МЕСТЕ','ОГО!','ПЛАН ЕСТЬ','ПАУЗА','СВЕЖИЙ ВОЗДУХ','ХОЧУ НА МАРКЕТ','ПО СВОИМ','ГОРОД НАШ'],
  ['ЕЩЁ ПЯТЬ МИНУТ','ПОСЛЕ РАБОТЫ','МУЗЫКУ!','ЗАЖИГАЕМ','НЕ СПЛЮ','УЖЕ ДОМА','ОБНИМАШКИ','МОЙ ВАЙБ','КИНО?','ТОП','НУ КРАСИВО','ТЫ ЛЕГЕНДА','ВЕЧЕР НАШ','ЕЩЁ РАУНД','МНЕ НРАВИТСЯ','УВИДИМСЯ','ДО ЗАВТРА'],
];
const POSES=[
  [2,5,2,1,5,5,0,3,2,5,6,0,1,6,4,0,4],
  [7,3,7,3,1,2,3,3,4,0,2,5,8,7,1,3,2],
  [5,3,6,6,8,8,4,6,1,2,4,2,6,6,4,0,8],
];
export const STICKERS: Sticker[] = PACKS.flatMap((p,j)=>LABELS[j].map((label,i)=>({id:`${p.id}-${i}`,label,pack:p.id,level:p.level,bg:p.bg,fg:'#17161A',rot:[-4,3,-2,4][i%4],pose:POSES[j][i],look:'solid' as const})));
export const stickerUnlocked = (s: Pick<Sticker,'level'>,level:number) => level >= s.level;
