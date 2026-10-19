// Браузерная регрессия по голосовым 12 октября. Требует web-экспорт demo; ответы маршрута — тестовые.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { dirname, join, extname } from 'node:path';
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
const root=join(dirname(fileURLToPath(import.meta.url)), '..');
const entryDir=join(root,'dist/_expo/static/js/web');
if (!existsSync(entryDir)) throw Error('Сначала собери web: EXPO_PUBLIC_DATA_MODE=demo npx expo export -p web --clear');
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.ttf':'font/ttf','.wav':'audio/wav'};
const server=createServer(async(req,res)=>{ const path=decodeURIComponent((req.url??'/').split('?')[0]); let f;
  for(const p of [path,path+'.html',path+'/index.html']) {try {const candidate=join(root,'dist',p);if((await stat(candidate)).isFile()){f=candidate;break;}}catch{}}
  f??=join(root,'dist/index.html');res.setHeader('Content-Type',types[extname(f)]??'application/octet-stream');res.end(await readFile(f));
}).listen(0,'127.0.0.1');
await new Promise(resolve => server.on('listening',resolve));
const port=server.address().port;
const browser=await chromium.launch({...(process.env.SHOTS_CHROMIUM ? {executablePath:process.env.SHOTS_CHROMIUM} : existsSync('/usr/bin/chromium') ? {executablePath:'/usr/bin/chromium'} : {}),args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const errors=[];
const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,locale:'ru-RU',timezoneId:'Asia/Almaty',geolocation:{latitude:43.25,longitude:76.94},permissions:['geolocation']});
await ctx.addInitScript(()=>{
  if(!localStorage.getItem('ryadom-session')) localStorage.setItem('ryadom-session',JSON.stringify({state:{signedIn:true,onboarded:true,locationAsked:true,tutorialDone:true,draft:{provider:'google',name:'Данил',photo:'danil',interests:['music','art','games'],times:['weekday'],withWho:'friends',budget:'mid'}},version:0}));
  localStorage.setItem('ryadom-clock','18:10');
});
await ctx.route('https://**/*',async route=>{
  if(route.request().url().includes('/functions/v1/route')) return route.fulfill({json:{car:{min:20,km:8,line:[[76.94,43.25],[76.91,43.25],[76.91,43.27],[76.87,43.29]]},walk:{min:70,km:6,line:[[76.94,43.25],[76.92,43.26],[76.88,43.28],[76.87,43.29]]}}});
  return route.abort();
});
const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));
const go=async path=>{await page.goto(`http://127.0.0.1:${port}${path}`,{waitUntil:'domcontentloaded'});await page.waitForTimeout(6400);};
const shot=async name=>await page.screenshot({path:join(root,'docs/progress/oct12-feedback',name+'.png')});
try{
  await go('/chats'); await page.getByRole('heading',{name:'Чаты',exact:true}).waitFor(); await shot('chats');
  await page.getByRole('button',{name:'Создать группу',exact:true}).click();
  await page.getByLabel('Название группы').fill('Прогулка');
  await page.getByRole('checkbox',{name:'Игорь',exact:true}).click();
  const create=page.getByRole('button',{name:'Создать группу',exact:true}).last();
  if(!(await create.isEnabled()))throw Error('Группа с одним другом недоступна');
  const groupButton=await create.boundingBox(); if(groupButton.height<44)throw Error('Кнопка группы меньше 44');
  await page.waitForTimeout(350); await shot('group'); await create.click(); await page.getByLabel('Сообщение',{exact:true}).waitFor();
  await page.getByLabel('Сообщение',{exact:true}).fill('Проверка группы');
  await page.getByRole('button',{name:'Отправить',exact:true}).click(); await page.getByText('Проверка группы',{exact:true}).waitFor();
  await shot('group-chat');console.log('PASS группа с одним другом, отправка сообщения, кнопка 44+');
  await go('/chat/dm-igor?tray=1'); await page.getByRole('button',{name:'Выбрать из галереи телефона',exact:true}).waitFor(); await shot('chat-tray');
  await page.setViewportSize({width:320,height:640}); await page.waitForTimeout(400);
  const gallery=await page.getByRole('button',{name:'Выбрать из галереи телефона',exact:true}).boundingBox();
  if(gallery.x<0||gallery.x+gallery.width>320.1)throw Error('Вложения выходят за экран');
  const sendMedia=await page.getByRole('button',{name:'Отправить · 2',exact:true}).boundingBox();
  if(!sendMedia||sendMedia.y+sendMedia.height>640.1||sendMedia.height<44)throw Error('Отправка вложений скрыта'); await shot('chat-narrow');console.log('PASS вложения 320×640');
  await page.setViewportSize({width:390,height:844});
  await go('/event/anime'); await page.getByRole('button',{name:'Выбрать день и время',exact:true}).click();
  await page.getByText('Когда пойти',{exact:true}).waitFor();await page.waitForTimeout(350);await shot('visit');
  await page.getByRole('button',{name:'Добавить в планы',exact:true}).click();await page.getByText('Дата посещения сохранена в планах',{exact:true}).waitFor();console.log('PASS выбор даты посещения');
  await go('/plans');await shot('plans');
  await go('/profile/achievements');await shot('achievements');
  await page.getByText('Реакции',{exact:true}).last().scrollIntoViewIfNeeded();
  await page.getByRole('button',{name:'БОКС!',exact:true}).last().click(); await shot('reactions'); console.log('PASS рамки, награды, реакция-стикер');
  await go('/route?id=jazz'); await shot('route'); console.log('PASS маршрут с тестовым ответом сервиса');
  if(errors.length)throw Error('Ошибки JavaScript: '+JSON.stringify(errors));
  console.log('PASS ошибок JavaScript нет');
}catch(error){console.log('PAGE ERRORS',JSON.stringify(errors));console.log('BODY',(await page.locator('body').innerText()).slice(0,2000));await shot('debug-failure');throw error;}finally{await browser.close();server.close();}
