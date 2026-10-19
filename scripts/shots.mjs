// npm run shots -- <этап> [маршрут=имя …]
// Собирает web-версию (если нет dist/), раздаёт её локально и снимает экраны 390×844 через Playwright
// в docs/progress/<этап>/. Пример: npm run shots -- stage-1 /start=SignUp /about=SignUpProfile@google
// Состояние сессии: @fresh (не вошёл), @google (вошёл через Google), @onboarded (по умолчанию для вкладок).
// Альфа (live): @live — настоящая сессия тестера (номер и код — только в переменных SHOTS_PHONE и SHOTS_CODE,
// в репозиторий не пишем), @livenew — вошёл, но анкета не пройдена, @livetut — анкета есть, обучение ещё нет.
import { Buffer } from 'node:buffer';
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
const AUTH = ['/hello', '/phone', '/code', '/name', '/taste', '/allow', '/done'];
const routes = pairs.length
  ? pairs.map((p) => {
    // Формат: маршрут=Имя[~высота или ~ширинаxвысота][@сессия][!нажать на элемент с такой подписью[!ещё]]
    const cut = p.lastIndexOf('=');
    const route = p.slice(0, cut);
    const rest = p.slice(cut + 1);
    const [head, ...clicks] = rest.split('!');
    const [nameH, preset] = head.split('@');
    const [name, h] = nameH.split('~');
    const [w, hh] = h?.includes('x') ? h.split('x').map(Number) : [390, Number(h)];
    return [route, name, preset || (AUTH.includes(route) ? 'fresh' : 'onboarded'), clicks, hh || 844, w || 390];
  })
  : [['/', 'Map'], ['/foryou', 'ForYou'], ['/chats', 'Chats'], ['/plans', 'Plans'], ['/me', 'Me']].map((r) => [...r, 'onboarded']);

const draft = { provider: null, phone: '', name: '', photo: null, birthDate: '', interests: ['music', 'hike', 'games'], times: ['weekday', 'weekend'], withWho: 'friends', budget: 'mid' };
const CLOCK = process.env.SHOTS_CLOCK || '18:10';
const PRESETS = {
  fresh: null,
  google: { signedIn: true, onboarded: false, locationAsked: false, taste: null, draft: { ...draft, provider: 'google', name: 'Данил', photo: 'danil' } },
  onboarded: { signedIn: true, onboarded: true, locationAsked: true, tutorialDone: true, taste: null, draft: { ...draft, provider: 'google', name: 'Данил', photo: 'danil', birthDate: '14.03.2001' } },
  live: { signedIn: true, onboarded: true, locationAsked: true, tutorialDone: true, taste: null, draft: { ...draft, provider: 'phone', name: 'Данил' } },
  livenew: { signedIn: true, onboarded: false, locationAsked: false, tutorialDone: false, taste: null, draft: { ...draft, provider: 'phone', name: '' } },
  livetut: { signedIn: true, onboarded: true, locationAsked: true, tutorialDone: false, taste: null, draft: { ...draft, provider: 'phone', name: 'Данил' } },
};

/** Настоящая сессия Supabase для live-скриншотов — через alpha-login, как в приложении. */
async function liveSession() {
  const phone = process.env.SHOTS_PHONE;
  const code = process.env.SHOTS_CODE;
  if (!phone || !code) return null;
  const keys = JSON.parse(await readFile(join(root, 'config/public-keys.json'), 'utf8'));
  const url = keys.supabase?.url ?? keys.supabaseUrl;
  const key = keys.supabase?.publishableKey ?? keys.supabasePublishableKey ?? keys.supabase?.anonKey;
  const h = { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}` };
  const r = await (await fetch(`${url}/functions/v1/alpha-login`, { method: 'POST', headers: h, body: JSON.stringify({ phone, code }) })).json();
  if (!r.access_token) throw new Error(`alpha-login: ${JSON.stringify(r)}`);
  const user = await (await fetch(`${url}/auth/v1/user`, { headers: { apikey: key, Authorization: `Bearer ${r.access_token}` } })).json();
  const ref = new URL(url).hostname.split('.')[0];
  const now = Math.floor(Date.now() / 1000);
  return { key: `sb-${ref}-auth-token`, value: JSON.stringify({ access_token: r.access_token, refresh_token: r.refresh_token, token_type: 'bearer', expires_in: 3600, expires_at: now + 3600, user }) };
}
const live = routes.some((r) => String(r[2]).startsWith('live')) ? await liveSession() : null;

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
const preinstalled = process.env.SHOTS_CHROMIUM || '/opt/pw-browsers/chromium';
// WebGL для Mapbox в headless-режиме — программный рендер SwiftShader.
const args = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const browser = await chromium.launch({ args, ...(existsSync(preinstalled) && (await stat(preinstalled)).isFile() ? { executablePath: preinstalled } : {}) });
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'ru-RU', timezoneId: 'Asia/Almaty',
  isMobile: true, hasTouch: true,
  // SHOTS_GEO=lat,lon — «телефон» стоит в этой точке (экраны маршрута, моя точка).
  ...(process.env.SHOTS_GEO ? { geolocation: { latitude: Number(process.env.SHOTS_GEO.split(',')[0]), longitude: Number(process.env.SHOTS_GEO.split(',')[1]) }, permissions: ['geolocation'] } : {}),
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
page.on('pageerror', (e) => console.log('  pageerror:', e.message));
// SHOTS_NET=часть-адреса — печатать ответы на такие запросы (отладка).
if (process.env.SHOTS_NET) page.on('response', (r) => { if (r.url().includes(process.env.SHOTS_NET)) console.log('  net:', r.request().method(), r.status(), r.url().slice(0, 90)); });
if (process.env.SHOTS_NET) page.on('requestfailed', (r) => { if (r.url().includes(process.env.SHOTS_NET)) console.log('  failed:', r.method(), r.failure()?.errorText, r.url().slice(0, 90)); });
for (const [route, name, preset, clicks = [], height = 844, width = 390] of routes) {
  await page.setViewportSize({ width, height });
  const state = PRESETS[preset];
  await page.goto(`http://localhost:${port}/+not-found`);
  await page.evaluate(([st, clock, auth]) => {
    localStorage.clear();
    if (st) localStorage.setItem('ryadom-session', JSON.stringify({ state: st, version: 0 }));
    if (auth) localStorage.setItem(auth.key, auth.value);
    // Демо-планы Данила — как на макете Me: иду на джаз, выставку, стендап и поход, концерт сохранён.
    if (st && st.onboarded && !auth) {
      const at = new Date(Date.now() - 86400e3).toISOString();
      localStorage.setItem('ryadom-plans', JSON.stringify({ state: { going: { jazz: at, anime: new Date().toISOString(), standup: at, hike: at }, saved: { concert: true }, company: {}, invites: [], meetups: [], declined: {}, newChats: { day: '', people: [] } }, version: 0 }));
    }
    // Демо-часы: на скриншотах «сейчас» — 18:10 по Алматы, как в макете (SHOTS_CLOCK=off — настоящее время).
    if (clock !== 'off') localStorage.setItem('ryadom-clock', clock);
  }, [state, CLOCK, preset.startsWith('live') ? live : null]);
  await page.goto(`http://localhost:${port}${route}`, { waitUntil: process.env.SHOTS_UNTIL || 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  // Ждём, пока уйдут индикаторы загрузки (данные из Supabase или демо).
  await page.waitForFunction(() => !document.querySelector('[role="progressbar"]'), null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(Number(process.env.SHOTS_WAIT || 2500));
  for (const label of clicks) {
    const byLabel = page.getByLabel(label, { exact: false });
    const target = (await byLabel.count()) ? byLabel.first() : page.getByText(label, { exact: true }).last();
    await target.click({ force: true });
    await page.waitForTimeout(Number(process.env.SHOTS_CLICK_WAIT || 700));
  }
  // SHOTS_EVAL=выражение — напечатать результат в странице (отладка).
  if (process.env.SHOTS_EVAL) console.log('  eval:', JSON.stringify(await page.evaluate(process.env.SHOTS_EVAL)));
  await page.screenshot({ path: join(out, `${name}.png`) });
  console.log(`✓ docs/progress/${stage}/${name}.png`);
}
await browser.close();
server.close();
