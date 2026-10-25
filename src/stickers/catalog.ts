import type { MemeKind } from './MemeArt';

export type StickerPack = 'memes' | 'nearby' | 'city' | 'afterhours' | 'reactions';
export interface Sticker { effect?: 'punch' | 'squeak' | 'heart' | 'confetti'; id: string; label: string; pack: StickerPack; level: number; bg: string; fg: string; rot: number; pose: number; look: 'solid' | 'outline' | 'tape' | 'big'; art?: MemeKind }
export const PACKS = [
  {id:'reactions' as const,title:'Реакции',level:1,bg:'#D9C7F2'},
  {id:'memes' as const,title:'Мемы',level:1,bg:'#FFE08A'},
  {id:'nearby' as const,title:'Рядом',level:1,bg:'#FFC9A8'},
  {id:'city' as const,title:'Город',level:3,bg:'#BFE3B4'},
  {id:'afterhours' as const,title:'После заката',level:7,bg:'#C9C2F5'},
];
const LABELS = [
  ['Я УМЕР','КЛОУН','СОТКА','ОГОНЬ','ПЕРСИК','ЛЕГЕНДА','ХА-ХА','ХМ…','ШОК','ПИЦЦА?','ПРИЗРАК','ЛЮБЛЮ'],
  ['ГО?','ТЫ ГДЕ?','ВЫХОДИ','КОФЕ?','ЖДУ','ОПАЗДЫВАЮ','Я ТУТ','ЕДУ','БАЗА','КРИНЖ','ХАЙП','АЛЛО??','ШАШЛЫК?','ТАНЦУЕМ','СКУЧАЮ','ПРИВЕТ','РЯДОМ!'],
  ['В ГОРЫ','НА ПРОГУЛКУ','НОВЫЙ МАРШРУТ','ПОШЛИ ПЕШКОМ','ПИКНИК','ЛОВИ МОМЕНТ','ПОЕХАЛИ','ВЕЛО?','ВСТРЕТИМСЯ','НА МЕСТЕ','ОГО!','ПЛАН ЕСТЬ','ПАУЗА','СВЕЖИЙ ВОЗДУХ','ХОЧУ НА МАРКЕТ','ПО СВОИМ','ГОРОД НАШ'],
  ['ЕЩЁ ПЯТЬ МИНУТ','ПОСЛЕ РАБОТЫ','МУЗЫКУ!','ЗАЖИГАЕМ','НЕ СПЛЮ','УЖЕ ДОМА','ОБНИМАШКИ','МОЙ ВАЙБ','КИНО?','ТОП','НУ КРАСИВО','ТЫ ЛЕГЕНДА','ВЕЧЕР НАШ','ЕЩЁ РАУНД','МНЕ НРАВИТСЯ','УВИДИМСЯ','ДО ЗАВТРА'],
];
// Картинка к каждой подписи (FIX5): мемные рожицы и предметы вместо оранжевых персонажей.
const ARTS: MemeKind[][] = [
  ['skull','clown','hundred','fire','peach','crown','laugh','think','shock','pizza','ghost','love'],
  ['rocket','eyes','wave','coffee','clock','sweat','pin','car','cool','cringe','fire','think','skewer','disco','sad','wave','love'],
  ['mountain','house','sparkles','mountain','popcorn','sparkles','rocket','bike','pin','pin','shock','trophy','ghost','mountain','pizza','house','hundred'],
  ['clock','house','music','fire','moon','house','hug','cool','popcorn','trophy','sparkles','crown','moon','disco','love','wave','moon'],
];
const POSES=[
  [0,0,0,0,0,0,0,0,0,0,0,0],
  [2,5,2,1,5,5,0,3,2,5,6,0,1,6,4,0,4],
  [7,3,7,3,1,2,3,3,4,0,2,5,8,7,1,3,2],
  [5,3,6,6,8,8,4,6,1,2,4,2,6,6,4,0,8],
];
export const STICKERS: Sticker[] = PACKS.filter(p => p.id !== 'reactions').flatMap((p,j)=>LABELS[j].map((label,i)=>({id:`${p.id}-${i}`,label,pack:p.id,level:p.level,bg:p.bg,fg:'#17161A',rot:[-4,3,-2,4][i%4],pose:POSES[j][i],look:'solid' as const,art:ARTS[j][i]})));
export const stickerUnlocked = (s: Pick<Sticker,'level'>,level:number) => level >= s.level;

STICKERS.push(...(['punch', 'squeak', 'heart', 'confetti'] as const).map((effect, i) => ({ id: `reaction-${effect}`, label: ['БОКС!', 'БАКЛАЖАН', 'ОБНЯЛ', 'САЛЮТ!'][i], pack: 'reactions' as const, level: 1, effect, bg: '#D9C7F2', fg: '#17161A', rot: 0, pose: 0, look: 'big' as const })));
