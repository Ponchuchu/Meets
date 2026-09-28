// npm run shots -- <этап> [маршрут=имя …]
// Собирает web-версию (если нет dist/), раздаёт её локально и снимает экраны 390×844 через Playwright
// в docs/progress/<этап>/. Пример: npm run shots -- stage-1 /start=SignUp /about=SignUpProfile@google
// Состояние сессии: @fresh (не вошёл), @google (вошёл через Google), @onboarded (по умолчанию для вкладок).
import { createServer } from 'node:http';
import { readFile, mkdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const [stage = 'latest', ...pairs] = process.argv.slice(2);
const AUTH = ['/start', '/code', '/about', '/interests', '/rhythm'];
const routes = pairs.length
  ? pairs.map((p) => {
    const [route, rest] = p.split('=');
    const [name, preset] = rest.split('@');
    return [route, name, preset || (AUTH.includes(route) ? 'fresh' : 'onboarded')];
  })
  : [['/', 'Map'], ['/foryou', 'ForYou'], ['/chats', 'Chats'], ['/people', 'People'], ['/me', 'Me']].map((r) => [...r, 'onboarded']);

const draft = { provider: null, phone: '', name: '', photo: null, birthDate: '', interests: ['music', 'hike', 'games'], times: ['weekday', 'weekend'], withWho: 'friends', budget: 'mid' };
const PRESETS = {
  fresh: null,
  google: { signedIn: true, onboarded: false, locationAsked: false, taste: null, draft: { ...draft, provider: 'google', name: 'Данил', photo: 'danil' } },
  onboarded: { signedIn: true, onboarded: true, locationAsked: true, taste: null, draft: { ...draft, provider: 'google', name: 'Данил', photo: 'danil', birthDate: '14.03.2001' } },
};

if (!existsSync(dist) || process.env.REBUILD) execSync('npx expo export -p web', { cwd: root, stdio: 'inherit' });

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.ttf': 'font/ttf', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

async function resolveFile(urlPath) {
  const clean = decodeURIComponent(urlPath.split('?')[0]);
  for (const p of [clean, `${clean}.html`, join(clean, 'index.html')]) {
    const f = join(dist, p);
    try { if ((await stat(f)).isFile()) return f; } catch { /* дальше */ }
  }
  return join(dist, 'index.html');
}

const server = createServer(async (req, res) => {
  const f = await resolveFile(req.url || '/');
  res.writeHead(200, { 'Content-Type': TYPES[extname(f)] || 'application/octet-stream' });
  res.end(await readFile(f));
}).listen(0);
const port = server.address().port;

const out = join(root, 'docs/progress', stage);
await mkdir(out, { recursive: true });
// В облачной среде Chromium лежит в /opt/pw-browsers/chromium; локально Playwright найдёт свой.
const preinstalled = '/opt/pw-browsers/chromium';
const browser = await chromium.launch(existsSync(preinstalled) && (await stat(preinstalled)).isFile() ? { executablePath: preinstalled } : {});
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'ru-RU', timezoneId: 'Asia/Almaty',
  isMobile: true, hasTouch: true,
});
// Внешние запросы (Supabase, Mapbox) идут через fetch Node: в облачной среде он знает прокси и его сертификат,
// а встроенный Chromium — нет. Проверка TLS при этом остаётся включённой.
if (process.env.HTTPS_PROXY) {
  await ctx.route(/^https:\/\/(?!localhost)/, async (route) => {
    const req = route.request();
    try {
      const res = await fetch(req.url(), { method: req.method(), headers: req.headers(), body: req.postDataBuffer() ?? undefined });
      const headers = Object.fromEntries(res.headers);
      delete headers['content-encoding'];
      delete headers['content-length'];
      await route.fulfill({ status: res.status, headers, body: Buffer.from(await res.arrayBuffer()) });
    } catch {
      await route.abort();
    }
  });
}
const page = await ctx.newPage();
for (const [route, name, preset] of routes) {
  const state = PRESETS[preset];
  await page.goto(`http://localhost:${port}/+not-found`);
  await page.evaluate((st) => {
    localStorage.clear();
    if (st) localStorage.setItem('ryadom-session', JSON.stringify({ state: st, version: 0 }));
  }, state);
  await page.goto(`http://localhost:${port}${route}`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  // Ждём, пока уйдут индикаторы загрузки (данные из Supabase или демо).
  await page.waitForFunction(() => !document.querySelector('[role="progressbar"]'), null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await page.screenshot({ path: join(out, `${name}.png`) });
  console.log(`✓ docs/progress/${stage}/${name}.png`);
}
await browser.close();
server.close();
