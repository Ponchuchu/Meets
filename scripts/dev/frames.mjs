// Кадры анимации: node scripts/dev/frames.mjs <маршрут> <подпись элемента> <файл> <мс,мс> [замедление]
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname } from 'node:path';
const dist = '/home/user/ryadom/dist';
const T = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.ttf': 'font/ttf' };
const srv = createServer(async (req, res) => { let f = join(dist, decodeURIComponent(req.url.split('?')[0])); try { if (!(await stat(f)).isFile()) throw 0; } catch { f = join(dist, 'index.html'); } res.writeHead(200, { 'Content-Type': T[extname(f)] || 'application/octet-stream' }); res.end(await readFile(f)); }).listen(0);
const port = srv.address().port;
const [route, label, out, times, slow] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, locale: 'ru-RU', timezoneId: 'Asia/Almaty', isMobile: true, hasTouch: true });
const p = await ctx.newPage();
p.on('pageerror', e => console.log('err', e.message));
await p.goto(`http://localhost:${port}/+not-found`);
const draft = { provider: 'google', phone: '', name: 'Данил', photo: 'danil', birthDate: '14.03.2001', interests: ['music', 'hike', 'games'], times: ['weekday', 'weekend'], withWho: 'friends', budget: 'mid' };
await p.evaluate((d) => { localStorage.setItem('ryadom-session', JSON.stringify({ state: { signedIn: true, onboarded: true, locationAsked: true, tutorialDone: true, taste: null, draft: d }, version: 0 })); localStorage.setItem('ryadom-clock', '18:10'); }, draft);
await p.goto(`http://localhost:${port}${route}`, { waitUntil: 'networkidle' });
await p.waitForTimeout(6500);
await p.evaluate(k => { globalThis.__animSlow = k; }, Number(slow || 1));
const box = await p.getByLabel(label, { exact: false }).first().boundingBox();
const t0 = Date.now();
await p.touchscreen.tap(box.x + box.width / 2, box.y + Math.min(60, box.height / 2));
for (const t of times.split(',').map(Number)) { const w = t - (Date.now() - t0); if (w > 0) await p.waitForTimeout(w); await p.screenshot({ path: `${out}-${t}.png` }); }
await b.close(); srv.close();
