// Demo-only navigation and responsive checks. No production session or writes.
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import assert from 'node:assert/strict';
const dist = resolve('dist');
const out = resolve('docs/progress/glass-apk45');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.ttf': 'font/ttf' };
const server = createServer(async (req, res) => {
  const clean = decodeURIComponent((req.url || '/').split('?')[0]);
  for (const suffix of ['', '.html', '/index.html']) {
    const file = resolve(dist, `.${clean}${suffix}`);
    if (!file.startsWith(`${dist}/`)) continue;
    try { const body = await readFile(file); res.setHeader('Content-Type', types[extname(file)] || 'application/octet-stream'); res.end(body); return; } catch { /* next candidate */ }
  }
  res.setHeader('Content-Type', 'text/html'); res.end(await readFile(`${dist}/index.html`));
}).listen(0);
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || '/usr/bin/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  await mkdir(out, { recursive: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route(/^https:\/\//, route => route.abort());
  await page.addInitScript(() => {
    localStorage.setItem('ryadom-session', JSON.stringify({ state: { signedIn: true, onboarded: true, locationAsked: true, tutorialDone: true, taste: null, draft: { name: 'Данил', photo: 'danil', interests: ['music', 'hike', 'games'], times: ['weekday', 'weekend'], withWho: 'friends', budget: 'mid' } }, version: 0 }));
  });
  await page.goto(`http://localhost:${server.address().port}/foryou`, { waitUntil: 'domcontentloaded' });
  const splash = page.getByRole('button', { name: 'Пропустить заставку' });
  await splash.waitFor({ state: 'visible', timeout: 15000 }).then(() => splash.click()).catch(() => {});
  await page.getByRole('heading', { name: 'Куда пойдём?', exact: true }).waitFor();
  assert.equal(await page.getByRole('tab').count(), 4);
  const checks = [];
  for (const [width, height, name] of [[320, 568, 'Recommendations-small'], [390, 844, 'Recommendations'], [768, 1024, 'Recommendations-tablet']]) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(500);
    const plan = page.getByRole('button', { name: /^Пойду:/ }).first();
    await plan.scrollIntoViewIfNeeded();
    const action = await plan.boundingBox();
    const tabs = await page.getByRole('tablist').boundingBox();
    assert(action && tabs && action.y + action.height <= tabs.y, `Actions overlap tabs at ${width}x${height}`);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: `${out}/${name}.png` });
    checks.push({ width, height, actionsReachableAfterScroll: true, horizontalOverflow: false });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Планы', exact: true }).click();
  await page.getByRole('heading', { name: 'Планы', exact: true }).waitFor();
  await page.screenshot({ path: `${out}/Plans.png` });
  await page.getByRole('tab', { name: 'Рекомендации', exact: true }).click();
  await page.getByRole('heading', { name: 'Куда пойдём?', exact: true }).waitFor();
  await page.getByRole('tab', { name: 'Настройки', exact: true }).click();
  await page.getByRole('heading', { name: 'Настройки', exact: true }).waitFor();
  await page.screenshot({ path: `${out}/Settings.png` });
  await page.getByRole('button', { name: /Мой профиль/ }).click();
  await page.waitForURL('**/me');
  await page.getByRole('tab', { name: 'Настройки', exact: true }).click();
  await page.getByRole('heading', { name: 'Настройки', exact: true }).waitFor();
  assert.deepEqual(errors, []);
  await writeFile(`${out}/checks.json`, JSON.stringify({ mode: 'demo', checks, tabs: 4, calendarRoundTrip: true, profileRoundTrip: true, pageErrors: errors, limitation: 'Remote requests blocked; no live Supabase or native Android performance verification.' }, null, 2));
  console.log('Passed: four tabs, calendar/profile round trips, 3 screen sizes, no page errors.');
} finally { await browser.close(); server.close(); }
