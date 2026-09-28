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
    // Формат: маршрут=Имя[~высота][@сессия][!нажать на элемент с такой подписью[!ещё]]
    const cut = p.lastIndexOf('=');
    const route = p.slice(0, cut);
    const rest = p.slice(cut + 1);
    const [head, ...clicks] = rest.split('!');
    const [nameH, preset] = head.split('@');
    const [name, h] = nameH.split('~');
    return [route, name, preset || (AUTH.includes(route) ? 'fresh' : 'onboarded'), clicks, Number(h) || 844];
  })
  : [['/', 'Map'], ['/foryou', 'ForYou'], ['/chats', 'Chats'], ['/people', 'People'], ['/me', 'Me']].map((r) => [...r, 'onboarded']);

const draft = { provider: null, phone: '', name: '', photo: null, birthDate: '', interests: ['music', 'hike', 'games'], times: ['weekday', 'weekend'], withWho: 'friends', budget: 'mid' };
const CLOCK = process.env.SHOTS_CLOCK || '18:10';
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
// WebGL для Mapbox в headless-режиме — программный рендер SwiftShader.
const args = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const browser = await chromium.launch({ args, ...(existsSync(preinstalled) && (await stat(preinstalled)).isFile() ? { executablePath: preinstalled } : {}) });
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
for (const [route, name, preset, clicks = [], height = 844] of routes) {
  await page.setViewportSize({ width: 390, height });
  const state = PRESETS[preset];
  await page.goto(`http://localhost:${port}/+not-found`);
  await page.evaluate(([st, clock]) => {
    localStorage.clear();
    if (st) localStorage.setItem('ryadom-session', JSON.stringify({ state: st, version: 0 }));
    // Демо-планы Данила — как на макете Me: иду на джаз, выставку, стендап и поход, концерт сохранён.
    if (st && st.onboarded) {
      const at = new Date(Date.now() - 86400e3).toISOString();
      localStorage.setItem('ryadom-plans', JSON.stringify({ state: { going: { jazz: at, anime: new Date().toISOString(), standup: at, hike: at }, saved: { concert: true }, company: {}, invites: [], meetups: [], declined: {}, newChats: { day: '', people: [] } }, version: 0 }));
    }
    // Демо-часы: на скриншотах «сейчас» — 18:10 по Алматы, как в макете (SHOTS_CLOCK=off — настоящее время).
    if (clock !== 'off') localStorage.setItem('ryadom-clock', clock);
  }, [state, CLOCK]);
  await page.goto(`http://localhost:${port}${route}`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  // Ждём, пока уйдут индикаторы загрузки (данные из Supabase или демо).
  await page.waitForFunction(() => !document.querySelector('[role="progressbar"]'), null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(Number(process.env.SHOTS_WAIT || 2500));
  for (const label of clicks) {
    const byLabel = page.getByLabel(label, { exact: false });
    const target = (await byLabel.count()) ? byLabel.first() : page.getByText(label, { exact: true }).last();
    await target.click({ force: true });
    await page.waitForTimeout(700);
  }
  await page.screenshot({ path: join(out, `${name}.png`) });
  console.log(`✓ docs/progress/${stage}/${name}.png`);
}
await browser.close();
server.close();
