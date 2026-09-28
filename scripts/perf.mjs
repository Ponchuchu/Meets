// npm run perf — грубая проверка «слабого Android» в браузере: процессор замедлен в 6 раз (CDP),
// экран 390×844. Меряем: когда появился контент, сколько длинных задач при загрузке, кадры в секунду
// и самый долгий кадр при перетаскивании карточки «Для тебя» и карты. Итог — docs/progress/stage-10/perf.json.
// Карта в headless рисуется программным WebGL (SwiftShader) — её кадры заметно хуже, чем на телефоне с GPU.
import { chromium } from 'playwright';
import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const RATE = Number(process.env.CPU_RATE || 6);
if (!existsSync(dist)) throw new Error('Сначала npm run build:web');

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.ttf': 'font/ttf' };
const server = createServer(async (req, res) => {
  const clean = decodeURIComponent((req.url || '/').split('?')[0]);
  let f = join(dist, 'index.html');
  for (const p of [clean, `${clean}.html`, join(clean, 'index.html')]) {
    try { if ((await stat(join(dist, p))).isFile()) { f = join(dist, p); break; } } catch { /* дальше */ }
  }
  res.writeHead(200, { 'Content-Type': TYPES[extname(f)] || 'application/octet-stream' });
  res.end(await readFile(f));
}).listen(0);
const port = server.address().port;

/** Размер JS: весь и тот, что нужен до первого экрана (entry). */
async function jsSize() {
  const dir = join(dist, '_expo/static/js/web');
  let total = 0;
  let entry = 0;
  for (const f of await readdir(dir)) {
    if (!f.endsWith('.js')) continue;
    const size = (await stat(join(dir, f))).size;
    total += size;
    if (f.startsWith('entry')) entry = size;
  }
  return { totalKB: Math.round(total / 1024), entryKB: Math.round(entry / 1024) };
}

const preinstalled = '/opt/pw-browsers/chromium';
const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  ...(existsSync(preinstalled) ? { executablePath: preinstalled } : {}),
});
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'ru-RU', timezoneId: 'Asia/Almaty', isMobile: true, hasTouch: true });
// Внешние запросы — через fetch Node (прокси облачной среды), как в scripts/shots.mjs.
if (process.env.HTTPS_PROXY) {
  await ctx.route(/^https:\/\/(?!localhost)/, async (route) => {
    const r = route.request();
    try {
      const res = await fetch(r.url(), { method: r.method(), headers: r.headers(), body: r.postDataBuffer() ?? undefined });
      const headers = Object.fromEntries(res.headers);
      delete headers['content-encoding'];
      delete headers['content-length'];
      await route.fulfill({ status: res.status, headers, body: globalThis.Buffer.from(await res.arrayBuffer()) });
    } catch { await route.abort(); }
  });
}
await ctx.addInitScript(() => {
  window.__long = [];
  new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__long.push(e.duration))).observe({ type: 'longtask', buffered: true });
  const draft = { provider: 'google', phone: '', name: 'Данил', photo: 'danil', birthDate: '14.03.2001', interests: ['music', 'hike', 'games'], times: ['weekday', 'weekend'], withWho: 'friends', budget: 'mid' };
  if (!localStorage.getItem('ryadom-session')) {
    localStorage.setItem('ryadom-session', JSON.stringify({ state: { signedIn: true, onboarded: true, locationAsked: true, taste: null, draft }, version: 0 }));
    localStorage.setItem('ryadom-clock', '18:10');
  }
});

/**
 * Жест проигрывается внутри страницы: pointer-события на каждом кадре в течение 1,2 с (как палец),
 * одновременно считаем кадры и самый долгий кадр. Так не мешают задержки Playwright между событиями.
 */
async function dragFps(page, x, y, dx, dy) {
  return page.evaluate(([x, y, dx, dy]) => new Promise((resolve) => {
    const target = document.elementFromPoint(x, y);
    const ev = (type, px, py) => target.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 1, pointerType: 'touch', isPrimary: true, clientX: px, clientY: py, buttons: type === 'pointerup' ? 0 : 1 }));
    ev('pointerdown', x, y);
    const t0 = performance.now();
    let frames = 0;
    let last = t0;
    let worst = 0;
    const tick = (t) => {
      frames++;
      worst = Math.max(worst, t - last);
      last = t;
      const k = Math.min(1, (t - t0) / 1200);
      ev('pointermove', x + dx * k, y + dy * k);
      if (k < 1) requestAnimationFrame(tick);
      else {
        ev('pointerup', x + dx, y + dy);
        resolve({ fps: Math.round(frames / ((t - t0) / 1000)), worstFrameMs: Math.round(worst) });
      }
    };
    requestAnimationFrame(tick);
  }), [x, y, dx, dy]);
}

const results = { cpuSlowdown: RATE, js: await jsSize(), screens: {} };
for (const [route, ready, drag] of [
  ['/', () => document.body.innerText.includes('Сегодня'), [200, 500, -120, 80]],
  ['/foryou', () => !!document.querySelector('[aria-label*="Пойду"], [aria-label*="пойду"]') || document.body.innerText.includes('Пойду'), [195, 420, 90, 0]],
]) {
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: RATE });
  const t0 = Date.now();
  await page.goto(`http://localhost:${port}${route}`);
  await page.waitForFunction(ready, null, { timeout: 60000, polling: 50 });
  const contentMs = Date.now() - t0;
  // Пауза, пока догрузятся карта (отдельный кусок mapbox-gl) и плитки: меряем жест, а не загрузку.
  await page.waitForTimeout(6000);
  const long = await page.evaluate(() => window.__long);
  const d = await dragFps(page, ...drag);
  results.screens[route] = { contentMs, longTasks: long.length, longTaskMs: Math.round(long.reduce((a, b) => a + b, 0)), fpsWhileDragging: d.fps, worstFrameMs: d.worstFrameMs };
  console.log(route, results.screens[route]);
  await page.close();
}
await browser.close();
server.close();

const out = join(root, 'docs/progress/stage-10');
await mkdir(out, { recursive: true });
await writeFile(join(out, 'perf.json'), `${JSON.stringify(results, null, 2)}\n`);
console.log(`JS: ${results.js.entryKB} КБ до первого экрана, ${results.js.totalKB} КБ всего · итог в docs/progress/stage-10/perf.json`);
