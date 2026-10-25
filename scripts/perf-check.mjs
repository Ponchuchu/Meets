import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { chromium } from 'playwright';
const dist = '/home/user/ryadom/dist';
const T = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.ttf': 'font/ttf', '.json': 'application/json' };
const s = createServer(async (q, r) => { const c = decodeURIComponent(q.url.split('?')[0]); let f = join(dist, 'index.html'); for (const p of [c, c + '.html']) { try { if ((await stat(join(dist, p))).isFile()) { f = join(dist, p); break; } } catch {} } r.writeHead(200, { 'Content-Type': T[extname(f)] || 'application/octet-stream' }); r.end(await readFile(f)); }).listen(0);
const base = `http://localhost:${s.address().port}`;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await ctx.route(/^https?:\/\/(?!localhost)/, (r) => r.fulfill({ status: 204, body: '' }));
const p = await ctx.newPage();
const cdp = await ctx.newCDPSession(p); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
await p.goto(base + '/+not-found');
await p.evaluate(() => { localStorage.setItem('ryadom-session', JSON.stringify({ state: { signedIn: true, onboarded: true, locationAsked: true, tutorialDone: true, taste: null, draft: { provider: 'google', name: 'Данил', interests: ['music'], times: [], withWho: 'friends', budget: 'mid' } }, version: 0 })); });
for (const r of ['/', '/foryou', '/plans', '/chats', '/me', '/friends', '/profile/steps', '/event/jazz', '/activity', '/dev']) {
  await p.goto(base + r, { waitUntil: 'load' });
  await p.evaluate(() => { window.__lt = 0; new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lt += e.duration; }).observe({ type: 'longtask', buffered: true }); });
  await p.waitForTimeout(2500);
  const lt = await p.evaluate(() => Math.round(window.__lt));
  const n = await p.evaluate(() => document.querySelectorAll('*').length);
  console.log(r.padEnd(16), 'долгие задачи', String(lt).padStart(5), 'мс · элементов', n);
}
await b.close(); s.close();
