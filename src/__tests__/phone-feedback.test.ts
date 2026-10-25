import {parseProfileLink} from '../profile/qr';
import {validateMeetup,buildMeetup,type MeetupForm} from '../event/meetup';
import {closestInstruction,routeProgress} from '../event/navigation';
import {STICKERS,stickerUnlocked} from '../stickers/catalog';
const now=new Date('2026-10-06T12:00:00+05:00');
const form:MeetupForm={mode:'friends',kind:'dinner',title:'Ужин',note:'',dayOffset:1,time:'19:00',place:'Дом',district:'Алмалы',address:'Есенова 160',invited:['friend'],plusOne:false,items:[],point:{lat:43.25,lon:76.94}};
describe('создание встречи из формы',()=>{
 it('запрещает отсутствующий адрес, невозможное время и GPS',()=>{
  expect(validateMeetup({...form,address:''},now)).toBeTruthy();
  expect(validateMeetup({...form,time:'25:90'},now)).toBeTruthy();
  expect(validateMeetup({...form,point:{lat:NaN,lon:76}},now)).toBeTruthy();
  expect(validateMeetup({...form,dayOffset:0,time:'11:00'},now)).toBeTruthy();
  expect(validateMeetup(form,now)).toBeNull();
 });
 it('сохраняет выбранные координаты и локальное время Алматы',()=>{
  const e=buildMeetup(form,now,'request-1');
  expect(e.startsAt).toBe('2026-10-07T14:00:00.000Z');expect(e.lat).toBe(form.point!.lat);expect(e.lon).toBe(form.point!.lon);expect(e.meetup?.invited).toEqual(['friend']);
 });
});
describe('навигация вдоль пути',()=>{
 const line:[number,number][]=[[76.9,43.25],[76.91,43.25],[76.91,43.26]];
 const steps=[{message:'Поверни',lat:43.25,lon:76.91,distance:810},{message:'Ты на месте',lat:43.26,lon:76.91,distance:1900}];
 it('выбирает следующий поворот после пройденного сегмента',()=>{
  expect(closestInstruction({lat:43.25,lon:76.902},steps,line)?.message).toBe('Поверни');
  expect(closestInstruction({lat:43.255,lon:76.91},steps,line)?.message).toBe('Ты на месте');
 });
 it('не даёт ложную команду вдали от маршрута и обрабатывает пустой путь',()=>{
  expect(closestInstruction({lat:44,lon:76},steps,line)).toBeNull();
  expect(routeProgress({lat:0,lon:0},[])).toBeNull();
  expect(closestInstruction({lat:0,lon:0},[])).toBeNull();
 });
});
it('67 уникальных стикеров открывается по уровням без отправки заблокированных',()=>{
 expect(STICKERS).toHaveLength(67);expect(new Set(STICKERS.map(s=>s.id)).size).toBe(67);expect(new Set(STICKERS.map(s=>s.label)).size).toBe(67);
 expect(STICKERS.filter(s=>stickerUnlocked(s,1))).toHaveLength(33);expect(STICKERS.filter(s=>stickerUnlocked(s,3))).toHaveLength(50);expect(STICKERS.every(s=>stickerUnlocked(s,7))).toBe(true);
});

it('QR открывает профиль только по ссылкам приложения',()=>{
 const id='00000000-0000-4000-8000-000000000001';
 expect(parseProfileLink(`ryadom://person/${id}`)).toEqual({kind:'person',value:id});
 expect(parseProfileLink('https://ryadom.app/u/danil')).toEqual({kind:'handle',value:'danil'});
 expect(parseProfileLink('https://example.com/u/danil')).toBeNull();expect(parseProfileLink('javascript:alert(1)')).toBeNull();
});
